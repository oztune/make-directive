angular.module('widgets', ['makeDirective'])
.directive('slider', ['makeDirective', function (makeDirective) {
    var Slider = makeDirective.Component.sub({
        percent: 0.4,
        min: 0,
        max: 48,
        interval: 10,

        // Private
        lastValue: null,

        constructor: function (el) {
            this.setupUI(el);
            // this.watch('min', 'onBoundsChange');
        },
        // onBoundsChange: function () {
        //     console.log(this.min);
        //     this.setValue(this.lastValue);
        // },
        setupUI: function (el) {
            var scrubber = el.find('.scrubber'),
                that = this;

            scrubber.on('mousedown', function (e) {
                var $window = $(window),
                    startX = e.screenX;
                    startDX = startX - scrubber.offset().left;

                console.log(startDX);

                e.preventDefault();

                $window
                .on('mousemove.slider', function (e) {
                    // that.setPercent(((e.screenX - startX + startDX) - el.offset().left) / el.width());
                    // console.log(e.screenX - el.offset().left + startDX);
                    that.setPercent((e.screenX - startDX - el.offset().left) / el.width());
                    el.trigger('change')

                    // Trigger a change event

                    that.$apply();
                })
                .on('mouseup.slider', function (e) {
                    $window.off('.slider');
                });
            });
        },
        setPercent: function (percent) {
            if (percent < 0) percent = 0;
            if (percent > 1) percent = 1;

            this.percent = percent;
        },
        setValue: function (value) {
            var divider;
            if (typeof value !== 'number') return;

            // divider = (this.max - this.min) / this.interval;

            // Clamp to interval
            // value = Math.round(value / divider) * divider;

            // this.lastValue = value;

            this.setPercent((value - this.min) / (this.max - this.min));
        },
        getValue: function () {
            return this.min + this.percent * (this.max - this.min);
        }
    });

    return makeDirective({
        publish: {
            value: {}
        },
        template: makeDirective.inline('<div class="slider"><div class="scrubber" style="left: {{percent * 100}}%"></div></div>')
    }, Slider);
}]);