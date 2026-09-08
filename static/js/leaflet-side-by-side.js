(function (L) {
    if (!L) return;

    L.Control.SideBySide = L.Control.extend({
        options: {
            position: 'topright',
            thumbSize: 42,
            padding: 0
        },

        initialize: function (leftLayers, rightLayers, options) {
            this.setLeftLayers(leftLayers);
            this.setRightLayers(rightLayers);
            L.setOptions(this, options);
        },

        getPosition: function () {
            if (!this._range || !this._map) return 0;
            var rangeValue = parseFloat(this._range.value);
            return this._map.getSize().x * rangeValue;
        },

        setPosition: function (pos) {
            if (!this._map || !this._range) return this;
            this._range.value = pos;
            this._updateLayers();
            return this;
        },

        setLeftLayers: function (leftLayers) {
            this._leftLayers = Array.isArray(leftLayers) ? leftLayers : (leftLayers ? [leftLayers] : []);
            this._updateLayers();
            return this;
        },

        setRightLayers: function (rightLayers) {
            this._rightLayers = Array.isArray(rightLayers) ? rightLayers : (rightLayers ? [rightLayers] : []);
            this._updateLayers();
            return this;
        },

        onAdd: function (map) {
            this._map = map;
            var container = L.DomUtil.create('div', 'leaflet-sbs');

            this._divider = L.DomUtil.create('div', 'leaflet-sbs-divider', container);
            this._range = L.DomUtil.create('input', 'leaflet-sbs-range', container);
            this._range.type = 'range';
            this._range.min = 0;
            this._range.max = 1;
            this._range.step = 0.001;
            this._range.value = 0.5;

            var self = this;
            this._onUpdate = function () {
                self._updateLayers();
            };

            map.on('move', this._onUpdate);
            map.on('zoom', this._onUpdate);
            map.on('layeradd', this._onUpdate);
            map.on('layerremove', this._onUpdate);

            L.DomEvent.on(this._range, 'input', this._onUpdate);
            L.DomEvent.on(this._range, 'change', this._onUpdate);

            L.DomEvent.on(this._range, 'mousedown', function () {
                map.dragging.disable();
            });
            L.DomEvent.on(this._range, 'touchstart', function () {
                map.dragging.disable();
            });
            L.DomEvent.on(document, 'mouseup', function () {
                map.dragging.enable();
            });
            L.DomEvent.on(document, 'touchend', function () {
                map.dragging.enable();
            });

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableClickPropagation(this._range);

            setTimeout(function () {
                self._updateLayers();
            }, 50);

            return container;
        },

        onRemove: function (map) {
            if (this._onUpdate) {
                map.off('move', this._onUpdate);
                map.off('zoom', this._onUpdate);
                map.off('layeradd', this._onUpdate);
                map.off('layerremove', this._onUpdate);
            }
            if (this._leftLayers) {
                this._leftLayers.forEach(function (l) {
                    if (l && l.getContainer && l.getContainer()) {
                        l.getContainer().style.clip = '';
                    }
                });
            }
            if (this._rightLayers) {
                this._rightLayers.forEach(function (l) {
                    if (l && l.getContainer && l.getContainer()) {
                        l.getContainer().style.clip = '';
                    }
                });
            }
        },

        _updateLayers: function () {
            if (!this._map || !this._range) return;
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
                    var c = layer.getContainer();
                    if (c) c.style.clip = leftClip;
                }
            });

            this._rightLayers.forEach(function (layer) {
                if (layer && layer.getContainer) {
                    var c = layer.getContainer();
                    if (c) c.style.clip = rightClip;
                }
            });
        }
    });

    L.control.sideBySide = function (leftLayers, rightLayers, options) {
        return new L.Control.SideBySide(leftLayers, rightLayers, options);
    };
})(window.L);
