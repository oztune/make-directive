(function () {
    'use strict';

    var extend, forEach, isFunction, noConstruct = {};

    if (typeof _ !== 'undefined') {
        extend = _.extend;
    } else {
        // The node version
        extend = function (obj) {
            Array.prototype.forEach.call(Array.prototype.slice.call(arguments, 1), function(source) {
                if (source) {
                    for (var prop in source) {
                        obj[prop] = source[prop];
                    }
                }
            });
            return obj;
        };
    }

    forEach = angular.forEach;
    isFunction = function (value) {
        return typeof value === 'function';
    };

    function sub (SuperClass, instanceMembers, classMembers) {
        function SubClass() {
            if (arguments[0] === noConstruct) return;
            if (this.constructor) this.constructor.apply(this, arguments);
        }

        function Surrogate() { }
        Surrogate.prototype = SuperClass.prototype;
        SubClass.prototype = new Surrogate();

        // Apply instance members
        extend(SubClass.prototype, instanceMembers);

        // Apply static members
        extend(SubClass, SuperClass, classMembers);

        // Wrap all methods so they have this.super inside
        addSupers(SubClass, SuperClass);
        addSupers(SubClass.prototype, SuperClass.prototype);

        return SubClass;
    }

    function addSupers(subMembers, superMembers) {
        forEach(subMembers, function (memberValue, memberName) {
            if (!isFunction(memberValue)) return;
            subMembers[memberName] = overrideMethod(memberName, memberValue, superMembers);
        });
    }

    function overrideMethod(methodName, originalMethod, superMembers) {
        return function () {
            var prevSuper = this.super,
                args = Array.prototype.slice.call(arguments),
                returnValue;

            this.super = function () {
                return superMembers[methodName].apply(this, arguments);
            };
            returnValue = originalMethod.apply(this, args);

            if (prevSuper) {
                this.super = prevSuper;
            } else {
                delete this.super;
            }

            return returnValue;
        };
    }

    // The base class (aka Object in Java) uses sub to get
    // anything that method may add to the prototype.
    sub.Base = sub(function () {}, {
        constructor: function () {
            /** Override **/
        }
    });
    sub.Base.sub = function (instanceMembers, classMembers) {
        return sub(this, instanceMembers, classMembers);
    };
    // TODO: How hacky is this?
    sub.Base.allocate = function () {
        var MyType = this;
        return new MyType(noConstruct);
    };

    // Export

    if (typeof window !== 'undefined') {
        window.sub = sub;
    } else if (typeof module !== 'undefined') {
        module.exports = sub;
    }
}());