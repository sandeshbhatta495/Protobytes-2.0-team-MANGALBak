/**
 * Stroke Processor Module
 * 
 * Handles capturing and preprocessing of handwriting strokes from HTML Canvas.
 * Converts raw canvas input to normalized feature sequences for model input.
 * 
 * @module StrokeProcessor
 */

(function(global) {
    'use strict';

    /**
     * Configuration for stroke processing
     */
    const DEFAULT_CONFIG = {
        canvasWidth: 400,
        canvasHeight: 200,
        maxSeqLength: 256,
        resampleDistance: 3.0,
        normalizeToUnitRange: true,
        useDeltaCoordinates: true
    };

    /**
     * StrokeCapture class - handles canvas input and stroke recording
     */
    class StrokeCapture {
        /**
         * @param {HTMLCanvasElement} canvas - The canvas element
         * @param {Object} options - Configuration options
         */
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.config = { ...DEFAULT_CONFIG, ...options };
            
            this.strokes = [];
            this.currentStroke = [];
            this.isDrawing = false;
            this.lastPoint = null;
            
            this._setupEventListeners();
        }

        /**
         * Setup mouse and touch event listeners
         * @private
         */
        _setupEventListeners() {
            // Mouse events
            this.canvas.addEventListener('mousedown', (e) => this._onPointerDown(e));
            this.canvas.addEventListener('mousemove', (e) => this._onPointerMove(e));
            this.canvas.addEventListener('mouseup', () => this._onPointerUp());
            this.canvas.addEventListener('mouseleave', () => this._onPointerUp());

            // Touch events
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this._onPointerDown(e.touches[0]);
            });
            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                this._onPointerMove(e.touches[0]);
            });
            this.canvas.addEventListener('touchend', () => this._onPointerUp());
            this.canvas.addEventListener('touchcancel', () => this._onPointerUp());
        }

        /**
         * Get canvas-relative coordinates
         * @private
         */
        _getCanvasPoint(event) {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            
            return {
                x: (event.clientX - rect.left) * scaleX,
                y: (event.clientY - rect.top) * scaleY,
                timestamp: Date.now()
            };
        }

        /**
         * Handle pointer down event
         * @private
         */
        _onPointerDown(event) {
            this.isDrawing = true;
            const point = this._getCanvasPoint(event);
            
            this.currentStroke = [];
            this.currentStroke.push({
                x: point.x,
                y: point.y,
                penState: 1 // Pen down
            });
            
            this.lastPoint = point;
            
            // Draw point
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
            this.ctx.fillStyle = '#000';
            this.ctx.fill();
        }

        /**
         * Handle pointer move event
         * @private
         */
        _onPointerMove(event) {
            if (!this.isDrawing) return;
            
            const point = this._getCanvasPoint(event);
            
            // Add point to current stroke
            this.currentStroke.push({
                x: point.x,
                y: point.y,
                penState: 1
            });
            
            // Draw line segment
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
            this.ctx.lineTo(point.x, point.y);
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 3;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.stroke();
            
            this.lastPoint = point;
        }

        /**
         * Handle pointer up event
         * @private
         */
        _onPointerUp() {
            if (!this.isDrawing) return;
            
            this.isDrawing = false;
            
            // Mark last point as pen up
            if (this.currentStroke.length > 0) {
                this.currentStroke[this.currentStroke.length - 1].penState = 0;
                this.strokes.push([...this.currentStroke]);
            }
            
            this.currentStroke = [];
            this.lastPoint = null;
        }

        /**
         * Get all captured strokes
         * @returns {Array} Array of strokes
         */
        getStrokes() {
            return this.strokes;
        }

        /**
         * Clear all strokes and canvas
         */
        clear() {
            this.strokes = [];
            this.currentStroke = [];
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }

        /**
         * Check if any strokes have been captured
         * @returns {boolean}
         */
        hasStrokes() {
            return this.strokes.length > 0 || this.currentStroke.length > 0;
        }
    }

    /**
     * StrokeProcessor class - preprocesses strokes for model input
     */
    class StrokeProcessor {
        /**
         * @param {Object} config - Processing configuration
         */
        constructor(config = {}) {
            this.config = { ...DEFAULT_CONFIG, ...config };
        }

        /**
         * Process raw strokes into model input features
         * @param {Array} strokes - Array of raw strokes
         * @returns {Float32Array} Processed features (maxSeqLength x 3)
         */
        process(strokes) {
            if (!strokes || strokes.length === 0) {
                return new Float32Array(this.config.maxSeqLength * 3);
            }

            // Flatten strokes to points
            let points = this._flattenStrokes(strokes);
            
            // Resample for uniform spacing
            points = this._resamplePoints(points);
            
            // Normalize coordinates
            points = this._normalizeCoordinates(points);
            
            // Convert to delta coordinates
            if (this.config.useDeltaCoordinates) {
                points = this._toDeltaCoordinates(points);
            }
            
            // Pad/truncate to fixed length
            points = this._padSequence(points);
            
            // Convert to Float32Array
            return this._toFloat32Array(points);
        }

        /**
         * Flatten strokes to single point array
         * @private
         */
        _flattenStrokes(strokes) {
            const points = [];
            
            for (const stroke of strokes) {
                for (const point of stroke) {
                    points.push({
                        x: point.x,
                        y: point.y,
                        penState: point.penState
                    });
                }
            }
            
            return points;
        }

        /**
         * Resample points to uniform spacing
         * @private
         */
        _resamplePoints(points) {
            if (points.length < 2) return points;
            
            const resampled = [points[0]];
            let accumulatedDist = 0;
            const minDist = this.config.resampleDistance;
            
            for (let i = 1; i < points.length; i++) {
                const dx = points[i].x - points[i - 1].x;
                const dy = points[i].y - points[i - 1].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                accumulatedDist += dist;
                
                // Check for stroke boundary (pen lift)
                if (points[i].penState === 0 && points[i - 1].penState === 1) {
                    resampled.push(points[i]);
                    accumulatedDist = 0;
                } else if (accumulatedDist >= minDist) {
                    resampled.push(points[i]);
                    accumulatedDist = 0;
                }
            }
            
            // Always include last point
            if (resampled.length > 0) {
                const last = points[points.length - 1];
                const resampledLast = resampled[resampled.length - 1];
                if (last.x !== resampledLast.x || last.y !== resampledLast.y) {
                    resampled.push(last);
                }
            }
            
            return resampled;
        }

        /**
         * Normalize coordinates to [-1, 1] range
         * @private
         */
        _normalizeCoordinates(points) {
            if (points.length === 0) return points;
            
            // Find bounding box
            let xMin = Infinity, xMax = -Infinity;
            let yMin = Infinity, yMax = -Infinity;
            
            for (const p of points) {
                xMin = Math.min(xMin, p.x);
                xMax = Math.max(xMax, p.x);
                yMin = Math.min(yMin, p.y);
                yMax = Math.max(yMax, p.y);
            }
            
            // Calculate ranges (avoid division by zero)
            const xRange = Math.max(xMax - xMin, 1);
            const yRange = Math.max(yMax - yMin, 1);
            
            // Normalize each point
            return points.map(p => ({
                x: 2.0 * (p.x - xMin) / xRange - 1.0,
                y: 2.0 * (p.y - yMin) / yRange - 1.0,
                penState: p.penState
            }));
        }

        /**
         * Convert absolute to delta (relative) coordinates
         * @private
         */
        _toDeltaCoordinates(points) {
            if (points.length < 2) {
                return points.map(p => ({ x: 0, y: 0, penState: p.penState }));
            }
            
            const deltas = [];
            
            // First point has zero delta
            deltas.push({
                x: 0,
                y: 0,
                penState: points[0].penState
            });
            
            // Compute deltas for remaining points
            for (let i = 1; i < points.length; i++) {
                deltas.push({
                    x: points[i].x - points[i - 1].x,
                    y: points[i].y - points[i - 1].y,
                    penState: points[i].penState
                });
            }
            
            return deltas;
        }

        /**
         * Pad or truncate sequence to fixed length
         * @private
         */
        _padSequence(points) {
            const maxLen = this.config.maxSeqLength;
            
            if (points.length >= maxLen) {
                return points.slice(0, maxLen);
            }
            
            // Pad with zeros
            const padded = [...points];
            while (padded.length < maxLen) {
                padded.push({ x: 0, y: 0, penState: 0 });
            }
            
            return padded;
        }

        /**
         * Convert to Float32Array for TensorFlow.js
         * @private
         */
        _toFloat32Array(points) {
            const arr = new Float32Array(points.length * 3);
            
            for (let i = 0; i < points.length; i++) {
                arr[i * 3] = points[i].x;
                arr[i * 3 + 1] = points[i].y;
                arr[i * 3 + 2] = points[i].penState;
            }
            
            return arr;
        }

        /**
         * Get the actual sequence length (before padding)
         * @param {Array} strokes - Raw strokes
         * @returns {number} Actual sequence length
         */
        getSequenceLength(strokes) {
            if (!strokes || strokes.length === 0) return 0;
            
            let points = this._flattenStrokes(strokes);
            points = this._resamplePoints(points);
            
            return Math.min(points.length, this.config.maxSeqLength);
        }
    }

    // Export to global scope
    global.StrokeCapture = StrokeCapture;
    global.StrokeProcessor = StrokeProcessor;

})(typeof window !== 'undefined' ? window : global);
