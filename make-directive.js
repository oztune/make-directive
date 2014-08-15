(function () {
    angular.module('makeDirective', [])
    .factory('makeDirective', ['$parse', function ($parse) {
        function makeDirective(annotations, Type) {
            var directive = {},
                template;

            annotations = extend({
                events: null,
                template: null,
                type: null,
                selector: null,
                require: null,
                style: null,
                publish: null,
            }, annotations);

            // TODO: Check type
            // TODO: Use .style?
            // TODO: Parse selector
            // TODO: Make events work

            directive.restrict = 'E';
            directive.replace = true;
            directive.require = annotations.require;
            directive.scope = {};

            template = annotations.template;

            if (template) {
                if (typeof template === 'string') {
                    directive.templateUrl = template;
                } else if (template instanceof InlineTemplate) {
                    directive.template = template.template;
                } else {
                    throw 'Invalid template type';
                }
            }

            directive.link = function (scope, el, attrs, controllers) {
                var boundProperties = [],
                    instance;

                // Decided to make the scope the instance because
                // - It makes it easier to define default values
                // - More like the new angular + polymer
                turnIntoInstance(scope, Type);
                instance = scope;
                instance.constructor(el, attrs, controllers);

                // Connect the attributes to the scope
                forEach(annotations.publish, function (propertyOptions, propertyName) {
                    var expression = attrs[prefixWithCase('bind', propertyName)];

                    // If the user didn't bind to this property, don't worry about it.
                    if (!expression) return;

                    boundProperties.push(bindProperty(propertyName, {
                        expression: expression,
                        scope: scope.$parent,
                        instance: instance
                    }, propertyOptions));
                });

                // Connect the events
                forEach(annotations.events, function (eventName) {
                    var expression = attrs[prefixWithCase('on', eventName)];

                    if (!expression) return;

                    bindEvent(el, eventName, scope.$parent);
                });

                // Cleanup setup
                scope.$on('$destroy', function () {
                    if (instance.detach) instance.detach();
                    forEach(boundProperties, function (fn) { fn(); });
                });

                // Wait until everything settles
                // TODO: Write a test to prove this.
                if (instance.attach) {
                    whenScopeSettles(scope, function () {
                        instance.attach();
                        scope.$apply();
                    });
                }
            };

            return directive;
        }

        makeDirective.inline = function (string) {
            return new InlineTemplate(string);
        };

        // Helper base class for all directives.
        // Important: This is just a helper, it's
        // not required to use.
        makeDirective.Component = sub.Base.sub({
            // Utility
            watch: function (expression, callback, deep) {
                return this.$watch(
                    isFunction(expression) ? this.proxy(expression) : expression,
                    this.proxy(callback),
                    deep
                );
            },
            proxy: function (fn) {
                var that;

                if (typeof fn === 'string') {
                    fn = this[fn];
                }

                if (!isFunction(fn)) throw 'Cannot proxy a non-function';

                that = this;
                return function () {
                    return fn.apply(that, arguments);
                };
            },
            trigger: function () {
                // TODO: Implement
            }
        });

        function bindEvent(el, eventName, scope, expression) {
            var parsedExpression = $parse(expression);
            el.on(eventName, function (e) {
                parsedExpression(scope, {$event: e});
            });
        }

        function bindProperty(name, params, userOptions) {
            var parsedExpression,
                watchFn,
                watcher,
                instance,
                trigger, expression;
                watchers = [];

            params = extend({
                // The item that getters/setters
                // will use as context.
                instance: null,
                expression: null,
                // The outer scope that this
                // property talks to
                scope: null,
            }, params);

            instance = params.instance;

            // TODO: Accept a string version of user options
            // <, >, =, &

            // Validate the user options
            forEach(['setter', 'getter'], function (verb) {
                var value = userOptions[verb],
                    fn;

                if (!value) return;
                if (typeof value !== 'string') throw name + '.' + verb + ' must be a string (method name) or null';

                fn = instance[value];

                if (!isFunction(fn)) throw value + ' referenced by ' + name + '.' + verb + ' isn\'t a method';
                userOptions[verb] = fn;
            });

            // TODO: Accept an 'internalName' property for use in the default setter/getter?
            userOptions = extend({
                trigger: 'reference',
                // the setter/getter only accepts a string or null.
                // this way all implementations have to be defined on the body of the class
                // this is more like es6...
                //
                // getter/setter order preference
                // - If an explicit getter/setter name is defined use it. null means it should
                //   be a noop.
                // - If instance has a setPropertyName/getPropertyName method on it, use it.
                // - If getter/setter isn't provided at all, use the default implementation
                //   (reading, writing from instance.propertyName).
                setter: instance[prefixWithCase('set', name)] || function (value) {
                    this[name] = value;
                },
                getter: instance[prefixWithCase('get', name)] || function (value) {
                    return this[name];
                }
            }, userOptions);

            trigger = userOptions.trigger;
            expression = params.expression;

            parsedExpression = $parse(expression);

            if (trigger === 'reference' || trigger === 'collection') {

                if (trigger === 'reference') watchFn = '$watch';
                if (trigger === 'collection') watchFn = '$watchCollection';

                if (userOptions.setter) {
                    // outside -> in
                    watcher = params.scope[watchFn](expression, function (value, oldValue) {
                        // At this point the instance has had a chance to set its
                        // default values.
                        // If this is the first watch trigger and the new value hasn't been
                        // defined, we don't want to override our defaults.

                        // TODO: Write a test that proves this works.
                        if (value === undefined && oldValue === undefined) return;
                        // console.log('->', name, value, '(was', oldValue);
                        userOptions.setter.call(instance, value);
                    });
                    watchers.push(watcher);
                }

                if (userOptions.getter) {
                    if (!parsedExpression.assign) {
                        throw 'Cannot assign value of property \'' + name + '\' to read-only expression \'' + expression + '\'';
                    }
                    // Let the scope settle before we start writing
                    // our values out (so our default values don't
                    // overwrite the passed in values.

                    // TODO: Write a test that proves this works.
                    whenScopeSettles(params.scope, function () {
                        // inside -> out
                        watcher = params.scope[watchFn](function () {
                            return userOptions.getter.call(instance);
                        }, function (value, oldValue) {
                            // We don't check value === oldValue
                            // because we want any default values
                            // to be propagated out.
                            // console.log('<-', name, value, '(was', oldValue);
                            parsedExpression.assign(params.scope, value);
                        });
                        watchers.push(watcher);
                        params.scope.$apply();
                    });
                }
            } else if (trigger === 'deferred') {
                // Use it once
                userOptions.setter.call(instance, function (locals) {
                    parsedExpression(params.scope, locals);
                });
            } else {
                throw 'Invalid property trigger. ' + name + '.trigger = ' + trigger;
            }

            return function disposeProperty () {
                forEach(watchers, function (fn) {
                    fn();
                });
            };
        }

        return makeDirective;
    }]);

    // Logic

    function InlineTemplate (string) {
        this.template = string;
    }

    function turnIntoInstance(source, Type) {
        extend(source, Type.allocate());
    }

    var extend = function (obj) {
        Array.prototype.forEach.call(Array.prototype.slice.call(arguments, 1), function(source) {
            if (source) {
                for (var prop in source) {
                    obj[prop] = source[prop];
                }
            }
        });
        return obj;
    };
    var forEach = angular.forEach;
    var isFunction = angular.isFunction;

    // Utils

    function whenScopeSettles(scope, callback) {
        // If the scope.$apply isn't called for a single
        // frame, we say it settled.
        var deregisterWatch = scope.$watch(debounce(function () {
            deregisterWatch();
            callback();
        }, 0));

        return deregisterWatch;
    }

    function prefixWithCase(prefix, value) {
        value = value.charAt(0).toUpperCase() + value.substr(1);
        return prefix + value;
    }

    // From underscore.js
    function debounce (func, wait, immediate) {
        var timeout, args, context, timestamp, result;

        var _ = {
            now: function () {
                return (new Date()).getTime();
            }
        };

        var later = function() {
          var last = _.now() - timestamp;
          if (last < wait) {
            timeout = setTimeout(later, wait - last);
          } else {
            timeout = null;
            if (!immediate) {
              result = func.apply(context, args);
              context = args = null;
            }
          }
        };

        return function() {
          context = this;
          args = arguments;
          timestamp = _.now();
          var callNow = immediate && !timeout;
          if (!timeout) {
            timeout = setTimeout(later, wait);
          }
          if (callNow) {
            result = func.apply(context, args);
            context = args = null;
          }

          return result;
        };
    }

}());