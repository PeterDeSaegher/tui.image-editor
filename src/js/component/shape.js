/**
 * @author NHN Ent. FE Development Team <dl_javascript@nhn.com>
 * @fileoverview Shape component
 */
import fabric from 'fabric';
import Component from '../interface/component';
import {
    rejectMessages,
    eventNames,
    keyCodes as KEY_CODES,
    componentNames,
    fObjectOptions,
    SHAPE_DEFAULT_OPTIONS
} from '../consts';
import resizeHelper from '../helper/shapeResizeHelper';
import {
    getfillImageFromShape,
    rePositionFilterTypeFillImage,
    reMakePatternImageSource,
    makeFillPatternForFilter
} from '../helper/shapeFilterFillHelper';
import {Promise, changeOriginOfObject, getCustomProperty} from '../util';
import {extend, inArray} from 'tui-code-snippet';

const SHAPE_INIT_OPTIONS = extend({
    strokeWidth: 1,
    stroke: '#000000',
    fill: '#ffffff',
    width: 1,
    height: 1,
    rx: 0,
    ry: 0
}, SHAPE_DEFAULT_OPTIONS);

const DEFAULT_TYPE = 'rect';
const DEFAULT_WIDTH = 20;
const DEFAULT_HEIGHT = 20;

const shapeType = ['rect', 'circle', 'triangle'];

/**
 * Shape
 * @class Shape
 * @param {Graphics} graphics - Graphics instance
 * @extends {Component}
 * @ignore
 */
export default class Shape extends Component {
    constructor(graphics) {
        super(componentNames.SHAPE, graphics);

        /**
         * Object of The drawing shape
         * @type {fabric.Object}
         * @private
         */
        this._shapeObj = null;

        /**
         * Type of the drawing shape
         * @type {string}
         * @private
         */
        this._type = DEFAULT_TYPE;

        /**
         * Options to draw the shape
         * @type {Object}
         * @private
         */
        this._options = extend({}, SHAPE_INIT_OPTIONS);

        /**
         * Whether the shape object is selected or not
         * @type {boolean}
         * @private
         */
        this._isSelected = false;

        /**
         * Pointer for drawing shape (x, y)
         * @type {Object}
         * @private
         */
        this._startPoint = {};

        /**
         * Using shortcut on drawing shape
         * @type {boolean}
         * @private
         */
        this._withShiftKey = false;

        /**
         * Event handler list
         * @type {Object}
         * @private
         */
        this._handlers = {
            mousedown: this._onFabricMouseDown.bind(this),
            mousemove: this._onFabricMouseMove.bind(this),
            mouseup: this._onFabricMouseUp.bind(this),
            keydown: this._onKeyDown.bind(this),
            keyup: this._onKeyUp.bind(this)
        };
    }

    /**
     * Start to draw the shape on canvas
     * @ignore
     */
    start() {
        const canvas = this.getCanvas();

        this._isSelected = false;

        canvas.defaultCursor = 'crosshair';
        canvas.selection = false;
        canvas.uniScaleTransform = true;
        canvas.on({
            'mouse:down': this._handlers.mousedown
        });

        fabric.util.addListener(document, 'keydown', this._handlers.keydown);
        fabric.util.addListener(document, 'keyup', this._handlers.keyup);
    }

    /**
     * End to draw the shape on canvas
     * @ignore
     */
    end() {
        const canvas = this.getCanvas();

        this._isSelected = false;

        canvas.defaultCursor = 'default';

        canvas.selection = true;
        canvas.uniScaleTransform = false;
        canvas.off({
            'mouse:down': this._handlers.mousedown
        });

        fabric.util.removeListener(document, 'keydown', this._handlers.keydown);
        fabric.util.removeListener(document, 'keyup', this._handlers.keyup);
    }

    /**
     * Set states of the current drawing shape
     * @ignore
     * @param {string} type - Shape type (ex: 'rect', 'circle')
     * @param {Object} [options] - Shape options
     *      @param {string} [options.fill] - Shape foreground color (ex: '#fff', 'transparent')
     *      @param {string} [options.stoke] - Shape outline color
     *      @param {number} [options.strokeWidth] - Shape outline width
     *      @param {number} [options.width] - Width value (When type option is 'rect', this options can use)
     *      @param {number} [options.height] - Height value (When type option is 'rect', this options can use)
     *      @param {number} [options.rx] - Radius x value (When type option is 'circle', this options can use)
     *      @param {number} [options.ry] - Radius y value (When type option is 'circle', this options can use)
     */
    setStates(type, options) {
        this._type = type;

        if (options) {
            this._options = extend(this._options, options);
        }
    }

    /**
     * Add the shape
     * @ignore
     * @param {string} type - Shape type (ex: 'rect', 'circle')
     * @param {Object} options - Shape options
     *      @param {string} [options.fill] - Shape foreground color (ex: '#fff', 'transparent')
     *      @param {string} [options.stroke] - Shape outline color
     *      @param {number} [options.strokeWidth] - Shape outline width
     *      @param {number} [options.width] - Width value (When type option is 'rect', this options can use)
     *      @param {number} [options.height] - Height value (When type option is 'rect', this options can use)
     *      @param {number} [options.rx] - Radius x value (When type option is 'circle', this options can use)
     *      @param {number} [options.ry] - Radius y value (When type option is 'circle', this options can use)
     *      @param {number} [options.isRegular] - Whether scaling shape has 1:1 ratio or not
     * @returns {Promise}
     */
    add(type, options) {
        return new Promise(resolve => {
            const canvas = this.getCanvas();
            options = this._extendOptions(options);

            const shapeObj = this._createInstance(type, options);

            this._bindEventOnShape(shapeObj);

            canvas.add(shapeObj).setActiveObject(shapeObj);

            this._rePositionFillFilter(shapeObj);

            const objectProperties = this.graphics.createObjectProperties(shapeObj);

            resolve(objectProperties);
        });
    }

    /**
     * Change the shape
     * @ignore
     * @param {fabric.Object} shapeObj - Selected shape object on canvas
     * @param {Object} options - Shape options
     *      @param {string} [options.fill] - Shape foreground color (ex: '#fff', 'transparent')
     *      @param {string} [options.stroke] - Shape outline color
     *      @param {number} [options.strokeWidth] - Shape outline width
     *      @param {number} [options.width] - Width value (When type option is 'rect', this options can use)
     *      @param {number} [options.height] - Height value (When type option is 'rect', this options can use)
     *      @param {number} [options.rx] - Radius x value (When type option is 'circle', this options can use)
     *      @param {number} [options.ry] - Radius y value (When type option is 'circle', this options can use)
     *      @param {number} [options.isRegular] - Whether scaling shape has 1:1 ratio or not
     * @returns {Promise}
     */
    change(shapeObj, options) {
        return new Promise((resolve, reject) => {
            if (inArray(shapeObj.get('type'), shapeType) < 0) {
                reject(rejectMessages.unsupportedType);
            }

            shapeObj.set(this._makeShapeOption(options));
            this.getCanvas().renderAll();
            resolve();
        });
    }

    /**
     * Check if the object is a shape object.
     * @param {fabric.Object} obj - fabric object
     * @returns {boolean}
     */
    isShape(obj) {
        return inArray(obj.get('type'), shapeType) >= 0;
    }

    /**
     * Get fill type
     * @param {Object | string} fillOption - shape fill option
     * @returns {string} 'transparent' or 'color' or 'filter'
     */
    getFillTypeFromOption(fillOption = {}) {
        const {type = 'color'} = fillOption;
        let fillType = type;

        if (!fillOption || fillOption === 'transparent') {
            fillType = 'transparent';
        } else if (type === 'filter') {
            fillType = 'filter';
        }

        return fillType;
    }

    /**
     * Get fill option
     * @param {Object | string} fillOption - shape fill option
     * @returns {string} 'transparent' or 'color' or 'filter'
     */
    getFilterOption(fillOption) {
        return fillOption.filter;
    }

    /**
     * Get fill type of shape type object
     * @param {fabric.Object} shapeObj - fabric object
     * @returns {string} 'transparent' or 'color' or 'filter'
     */
    getFillTypeFromObject(shapeObj) {
        const {fill} = shapeObj;
        if (fill.source) {
            return 'filter';
        }

        return fill === 'transparent' ? fill : 'color';
    }

    /**
     * Copy object handling.
     * @param {fabric.Object} shapeObj - Shape object
     */
    processForCopiedObject(shapeObj) {
        this._bindEventOnShape(shapeObj);

        if (this.getFillTypeFromObject(shapeObj) === 'filter') {
            const {filterOption} = getCustomProperty(shapeObj, 'filterOption');

            shapeObj.set(makeFillPatternForFilter(this.graphics.canvasImage, filterOption));
            this._rePositionFillFilter(shapeObj);
        }
    }

    /**
     * Make shape option
     * @param {Object} options - Options to creat the shape
     * @returns {Object} - shape option
     * @private
     */
    _makeShapeOption(options) {
        const fillType = this.getFillTypeFromOption(options.fill);
        let extOption = {};

        if (fillType === 'filter') {
            extOption = makeFillPatternForFilter(this.graphics.canvasImage, this.getFilterOption(options.fill));
        }

        return extend({}, options, extOption);
    }

    /**
     * Create the instance of shape
     * @param {string} type - Shape type
     * @param {Object} options - Options to creat the shape
     * @returns {fabric.Object} Shape instance
     * @private
     */
    _createInstance(type, options) {
        const shapeOptions = this._makeShapeOption(options);
        let instance;

        switch (type) {
            case 'rect':
                instance = new fabric.Rect(shapeOptions);
                break;
            case 'circle':
                shapeOptions.type = 'circle';
                instance = new fabric.Ellipse(shapeOptions);
                break;
            case 'triangle':
                instance = new fabric.Triangle(shapeOptions);
                break;
            default:
                instance = {};
        }

        return instance;
    }

    /**
     * Get the options to create the shape
     * @param {Object} options - Options to creat the shape
     * @returns {Object} Shape options
     * @private
     */
    _extendOptions(options) {
        const selectionStyles = fObjectOptions.SELECTION_STYLE;

        options = extend({}, SHAPE_INIT_OPTIONS, this._options, selectionStyles, options);

        if (options.isRegular) {
            options.lockUniScaling = true;
        }

        return options;
    }

    /**
     * Bind fabric events on the creating shape object
     * @param {fabric.Object} shapeObj - Shape object
     * @private
     */
    _bindEventOnShape(shapeObj) {
        const self = this;
        const canvas = this.getCanvas();

        shapeObj.on({
            added() {
                self._shapeObj = this;
                resizeHelper.setOrigins(self._shapeObj);
            },
            selected() {
                self._isSelected = true;
                self._shapeObj = this;
                canvas.uniScaleTransform = true;
                canvas.defaultCursor = 'default';
                resizeHelper.setOrigins(self._shapeObj);
            },
            deselected() {
                self._isSelected = false;
                self._shapeObj = null;
                canvas.defaultCursor = 'crosshair';
                canvas.uniScaleTransform = false;
            },
            modified() {
                const currentObj = self._shapeObj;

                resizeHelper.adjustOriginToCenter(currentObj);
                resizeHelper.setOrigins(currentObj);
            },
            modifiedInGroup(activeSelection) {
                self._fillFilterRePositionInGroupSelection(shapeObj, activeSelection);
            },
            moving() {
                self._rePositionFillFilter(this);
            },
            rotating() {
                self._rePositionFillFilter(this);
            },
            scaling(fEvent) {
                const pointer = canvas.getPointer(fEvent.e);
                const currentObj = self._shapeObj;

                canvas.setCursor('crosshair');
                resizeHelper.resize(currentObj, pointer, true);

                self._rePositionFillFilter(this);
            }
        });
    }

    /**
     * MouseDown event handler on canvas
     * @param {{target: fabric.Object, e: MouseEvent}} fEvent - Fabric event object
     * @private
     */
    _onFabricMouseDown(fEvent) {
        if (!fEvent.target) {
            this._isSelected = false;
            this._shapeObj = false;
        }

        if (!this._isSelected && !this._shapeObj) {
            const canvas = this.getCanvas();
            this._startPoint = canvas.getPointer(fEvent.e);

            canvas.on({
                'mouse:move': this._handlers.mousemove,
                'mouse:up': this._handlers.mouseup
            });
        }
    }

    /**
     * MouseDown event handler on canvas
     * @param {{target: fabric.Object, e: MouseEvent}} fEvent - Fabric event object
     * @private
     */
    _onFabricMouseMove(fEvent) {
        const canvas = this.getCanvas();
        const pointer = canvas.getPointer(fEvent.e);
        const startPointX = this._startPoint.x;
        const startPointY = this._startPoint.y;
        const width = startPointX - pointer.x;
        const height = startPointY - pointer.y;
        const shape = this._shapeObj;

        if (!shape) {
            this.add(this._type, {
                left: startPointX,
                top: startPointY,
                width,
                height
            }).then(objectProps => {
                this.fire(eventNames.ADD_OBJECT, objectProps);
            });
        } else {
            this._shapeObj.set({
                isRegular: this._withShiftKey
            });

            resizeHelper.resize(shape, pointer);
            canvas.renderAll();

            this._rePositionFillFilter(shape);
        }
    }

    /**
     * MouseUp event handler on canvas
     * @private
     */
    _onFabricMouseUp() {
        const canvas = this.getCanvas();
        const startPointX = this._startPoint.x;
        const startPointY = this._startPoint.y;
        const shape = this._shapeObj;

        if (!shape) {
            this.add(this._type, {
                left: startPointX,
                top: startPointY,
                width: DEFAULT_WIDTH,
                height: DEFAULT_HEIGHT
            }).then(objectProps => {
                this.fire(eventNames.ADD_OBJECT, objectProps);
            });
        } else if (shape) {
            resizeHelper.adjustOriginToCenter(shape);
            this.fire(eventNames.ADD_OBJECT_AFTER, this.graphics.createObjectProperties(shape));
        }

        canvas.off({
            'mouse:move': this._handlers.mousemove,
            'mouse:up': this._handlers.mouseup
        });
    }

    /**
     * Keydown event handler on document
     * @param {KeyboardEvent} e - Event object
     * @private
     */
    _onKeyDown(e) {
        if (e.keyCode === KEY_CODES.SHIFT) {
            this._withShiftKey = true;

            if (this._shapeObj) {
                this._shapeObj.isRegular = true;
            }
        }
    }

    /**
     * Keyup event handler on document
     * @param {KeyboardEvent} e - Event object
     * @private
     */
    _onKeyUp(e) {
        if (e.keyCode === KEY_CODES.SHIFT) {
            this._withShiftKey = false;

            if (this._shapeObj) {
                this._shapeObj.isRegular = false;
            }
        }
    }

    /**
     * Reset shape position and internal proportions in the filter type fill area.
     * @param {fabric.Object} shapeObj - Shape object
     * @private
     */
    _rePositionFillFilter(shapeObj) {
        if (this.getFillTypeFromObject(shapeObj) !== 'filter') {
            return;
        }

        const fillImage = getfillImageFromShape(shapeObj);
        const {originalAngle} = getCustomProperty(fillImage, 'originalAngle');

        if (this.graphics.canvasImage.angle !== originalAngle) {
            reMakePatternImageSource(shapeObj, this.graphics.canvasImage);
        }
        const {originX, originY} = shapeObj;

        resizeHelper.adjustOriginToCenter(shapeObj);

        shapeObj.width *= shapeObj.scaleX;
        shapeObj.height *= shapeObj.scaleY;
        shapeObj.rx *= shapeObj.scaleX;
        shapeObj.ry *= shapeObj.scaleY;
        shapeObj.scaleX = 1;
        shapeObj.scaleY = 1;

        rePositionFilterTypeFillImage(shapeObj);

        changeOriginOfObject(shapeObj, {
            originX,
            originY
        });
    }

    /**
     * Reset filter area position within group selection.
     * @param {fabric.Object} shapeObj - Shape object
     * @param {fabric.ActiveSelection} activeSelection - Shape object
     * @private
     */
    _fillFilterRePositionInGroupSelection(shapeObj, activeSelection) {
        if (activeSelection.scaleX !== 1 || activeSelection.scaleY !== 1) {
            // This is necessary because the group's scale transition state affects the relative size of the fill area.
            // The only way to reset the object transformation scale state to neutral.
            // {@link https://github.com/fabricjs/fabric.js/issues/5372}
            activeSelection.addWithUpdate();
        }

        const {angle, left, top} = shapeObj;

        activeSelection.realizeTransform(shapeObj);
        this._rePositionFillFilter(shapeObj);

        shapeObj.set({
            angle,
            left,
            top
        });
    }
}
