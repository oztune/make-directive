angular.module('app', ['makeDirective', 'widgets'])
.controller('main', function ($scope) {
    $scope.options = {
        name: 'hey there',
        age: -20
    };

    $scope.show = false;

    $scope.slideValue = 0;
    $scope.min = 10;

    setTimeout(function () {
        // Change the value a few times to see if attach
        // works properly.
        $scope.$watch('options.name', function (value) {
            // if (value < 10) causes a
            // maximum digest loop reached error
            // as it should.
            if (value.length < 'hey there'.length + 5) {
                $scope.options.name = value + '0';
            }
        });

        $scope.show = true;
        $scope.$apply();

        // Remove
        // setTimeout(function () {
        //     $scope.show = false;
        //     $scope.$apply();
        // }, 1000);
    }, 500);
})
.directive('test2', ['makeDirective', function (makeDirective) {
    var annotations, Test;

    annotations = {
        type: 'component',
        template: makeDirective.inline('<div>This is a test. Name = {{name}}. Color = {{color}}. Age = {{age}}</div>'),
        publish: {
            name: {},
            height: {},
            age: {}
        }
    };
    Test = makeDirective.Component.sub({
        color: 'Purple',
        age: 10,

        constructor: function () {
            this.name = 'default name';
        },
        setAge: function (value) {
            if (value < 1) value = 1;
            this.age = value;
        },
        attach: function () {
            // console.log('Attached', this.name);
        },
        detach: function () {
            // alert('a');
        }
    });

    var T = Test.sub({
        constructor: function () {
            this.super();
        },
        setAge: function (value) {
            this.super.setAge(value);
        }
    });

    // TODO: Now how do we extend a directive?

    return makeDirective(annotations, Test);
}]);

// Sub test

var Point = sub.Base.sub({
    x: 0,
    y: 0
});

var Shape = sub.Base.sub({
    position: null,
    constructor: function () {
        this.position = new Point();
    },
    hitTest: function (x, y) { /* */ }
});

var Circle = Shape.sub({
    radius: 0,
    constructor: function () {
        this.super();
        this.radius = 10;
    },
    hitTest: function (x, y) {
        var xd = x - this.position.x,
            yd = y - this.position.y,
            d2 = xd * xd + yd * yd;

        return d2 < (this.radius * this.radius);
    }
});

var Doughnut = Circle.sub({
    innerRadius: 0,
    hitTest: function (x, y) {
        if (!this.super(x, y)) return false;
        // return ...
    }
});

var circle = new Circle();