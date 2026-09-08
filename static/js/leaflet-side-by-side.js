(function (L) {
    if (typeof L === 'undefined') return;

    function on(el, types, fn, ctx) {
        types.split(' ').forEach(function (t) {
            L.DomEvent.on(el, t, fn, ctx);
        });
    }

    L.Control.SideBySide = L.Control.extend({
        options: {
            thumbSize: 42,
            padding: 0
        },

        initialize: function (leftLayers, rightLayers, options) {
            this.setLeftLayers(leftLayers);
            this.setRightLayers(rightLayers);
            L.setOptions(this, options);
        },

        getPosition: function () {
            var rangeValue = this._range.value;
            var offset = (0.5 - rangeValue) * (2 * this.options.padding + this.options.thumbSize);
            return this._map.getSize().x * rangeValue + offset;
        },

        setPosition: function (pos) {
            if (!this._map) return this;
            this._range.value = pos;
            this._updateLayers();
            return this;
        },

        setLeftLayers: function (leftLayers) {
            this._leftLayers = Array.isArray(leftLayers) ? leftLayers : [leftLayers];
            this._updateLayers();
            return this;
        },

        setRightLayers: function (rightLayers) {
            this._rightLayers = Array.isArray(rightLayers) ? rightLayers : [rightLayers];
            this._updateLayers();
            return this;
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-sbs', map._container);

            this._divider = L.DomUtil.create('div', 'leaflet-sbs-divider', container);
            this._range = L.DomUtil.create('input', 'leaflet-sbs-range', container);
            this._range.type = 'range';
            this._range.min = 0;
            this._range.max = 1;
            this._range.step = 'any';
            this._range.value = 0.5;
            this._range.style.paddingLeft = this._range.style.paddingRight = this.options.padding + 'px';

            this._addEvents();
            this._updateLayers();
            return container;
        },

        onRemove: function () {
            this._removeEvents();
            if (this._container && this._container.parentNode) {
                this._container.parentNode.removeChild(this._container);
            }
        },

        _addEvents: function () {
            var self = this;
            this._map.on('move', this._updateLayers, this);
            this._map.on('layeradd layerremove', this._updateLayers, this);

            on(this._range, 'input change', this._updateLayers, this);

            on(this._range, 'mousedown touchstart', function () {
                self._map.dragging.disable();
            });
            on(this._range, 'mouseup touchend', function () {
                self._map.dragging.enable();
            });
        },

        _removeEvents: function () {
            this._map.off('move', this._updateLayers, this);
            this._map.off('layeradd layerremove', this._updateLayers, this);
        },

        _updateLayers: function () {
            if (!this._map) return;
            var pos = this.getPosition();
            var size = this._map.getSize();

            var nw = this._map.containerPointToLayerPoint([0, 0]);
            var se = this._map.containerPointToLayerPoint(size);
            var clipX = nw.x + pos;

            this._divider.style.left = pos + 'px';

            var leftClip = 'rect(' + [nw.y, clipX, se.y, nw.x].join('px,') + 'px)';
            var rightClip = 'rect(' + [nw.y, se.x, se.y, clipX].join('px,') + 'px)';

            this._leftLayers.forEach(function (layer) {
                if (layer && layer.getContainer) {
                    var container = layer.getContainer();
                    if (container) container.style.clip = leftClip;
                }
            });

            this._rightLayers.forEach(function (layer) {
                if (layer && layer.getContainer) {
                    var container = layer.getContainer();
                    if (container) container.style.clip = rightClip;
                }
            });
        }
    });

    L.control.sideBySide = function (leftLayers, rightLayers, options) {
        return new L.Control.SideBySide(leftLayers, rightLayers, options);
    };
})(window.L);
