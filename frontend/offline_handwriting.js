/**
 * Offline Handwriting Integration for Sarkari Sarathi
 * 
 * This module provides offline handwriting recognition by integrating
 * the TensorFlow.js-based recognizer with the existing Sarkari Sarathi UI.
 * 
 * Features:
 * - Replaces server-based API calls with local inference
 * - Maintains stroke data for better recognition
 * - Provides visual feedback during recognition
 * - Graceful fallback if model fails to load
 */

(function(global) {
    'use strict';

    // Configuration
    const CONFIG = {
        modelPath: '/static/handwriting_model',  // Path to TF.js model
        useBeamSearch: true,
        beamWidth: 10,
        enableFallback: false,  // Disable server fallback (API quota issues)
        showTiming: false       // Show timing info in console
    };

    // State
    let recognizer = null;
    let strokeCaptures = {};  // Canvas ID -> StrokeCapture
    let isModelLoaded = false;
    let modelLoadPromise = null;
    let modelLoadError = null;  // Store error for user feedback

    /**
     * Initialize the offline handwriting system
     * Should be called on page load
     */
    async function initOfflineHandwriting() {
        console.log('[OfflineHandwriting] Initializing...');
        
        // Check if TensorFlow.js is available
        if (typeof tf === 'undefined') {
            console.warn('[OfflineHandwriting] TensorFlow.js not found. Loading...');
            await loadTensorFlow();
        }
        
        // Check if handwriting modules are loaded
        if (typeof HandwritingRecognizer === 'undefined') {
            console.warn('[OfflineHandwriting] Handwriting modules not found. Loading...');
            await loadHandwritingModules();
        }
        
        // Initialize recognizer
        try {
            recognizer = new HandwritingRecognizer({
                useBeamSearch: CONFIG.useBeamSearch,
                beamWidth: CONFIG.beamWidth,
                enableProfiling: CONFIG.showTiming
            });
            
            modelLoadPromise = recognizer.init(CONFIG.modelPath);
            await modelLoadPromise;
            
            isModelLoaded = true;
            console.log('[OfflineHandwriting] Model loaded successfully!');
            
        } catch (error) {
            console.error('[OfflineHandwriting] Failed to load model:', error);
            modelLoadError = error.message || 'Model not available';
            console.log('[OfflineHandwriting] Offline recognition unavailable. Please train and deploy the model.');
            isModelLoaded = false;
        }
    }

    /**
     * Load TensorFlow.js dynamically
     */
    async function loadTensorFlow() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
            script.onload = () => {
                console.log('[OfflineHandwriting] TensorFlow.js loaded');
                resolve();
            };
            script.onerror = () => reject(new Error('Failed to load TensorFlow.js'));
            document.head.appendChild(script);
        });
    }

    /**
     * Load handwriting recognition modules dynamically
     */
    async function loadHandwritingModules() {
        const modules = [
            '/static/handwriting/stroke_processor.js',
            '/static/handwriting/ctc_decoder.js',
            '/static/handwriting/handwriting.js'
        ];
        
        for (const src of modules) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = () => reject(new Error(`Failed to load ${src}`));
                document.head.appendChild(script);
            });
        }
        
        console.log('[OfflineHandwriting] Handwriting modules loaded');
    }

    /**
     * Setup stroke capture for a canvas element
     * Call this when showing the canvas modal
     */
    function setupCanvasCapture(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`[OfflineHandwriting] Canvas not found: ${canvasId}`);
            return null;
        }
        
        // Create or reuse stroke capture
        if (!strokeCaptures[canvasId]) {
            strokeCaptures[canvasId] = new StrokeCapture(canvas);
        }
        
        return strokeCaptures[canvasId];
    }

    /**
     * Clear strokes for a canvas
     */
    function clearCanvasStrokes(canvasId) {
        if (strokeCaptures[canvasId]) {
            strokeCaptures[canvasId].clear();
        }
    }

    /**
     * Recognize handwriting from canvas - offline version
     * This replaces the submitFieldCanvas function
     * 
     * @param {string} canvasId - ID of the canvas element
     * @returns {Promise<Object>} Recognition result
     */
    async function recognizeOffline(canvasId) {
        // Ensure model is loaded
        if (modelLoadPromise) {
            await modelLoadPromise;
        }
        
        if (!isModelLoaded || !recognizer) {
            throw new Error('Model not available');
        }
        
        const capture = strokeCaptures[canvasId];
        if (!capture) {
            throw new Error('No stroke capture for canvas');
        }
        
        const strokes = capture.getStrokes();
        if (!strokes || strokes.length === 0) {
            return { text: '', isEmpty: true };
        }
        
        // Run recognition
        const result = await recognizer.recognize(strokes);
        
        if (CONFIG.showTiming && result.timing) {
            console.log(`[OfflineHandwriting] Recognition completed in ${result.timing.total.toFixed(0)}ms`);
        }
        
        return result;
    }

    /**
     * Main recognition function - replaces submitFieldCanvas
     * Uses offline recognition if available, falls back to server
     */
    async function submitFieldCanvasOffline() {
        const fieldId = window.activeCanvasFieldId;
        if (!fieldId) return;
        
        const canvas = document.getElementById('modalCanvas');
        if (!canvas) return;
        
        // Check if canvas has content
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let hasContent = false;
        
        for (let i = 0; i < imgData.data.length; i += 4) {
            if (imgData.data[i + 3] > 10) {
                hasContent = true;
                break;
            }
        }
        
        if (!hasContent) {
            if (typeof showError === 'function') {
                showError('कृपया पहिले केही लेख्नुहोस्।');
            }
            return;
        }
        
        if (typeof showLoading === 'function') showLoading();
        
        try {
            let recognizedText = '';
            
            // Try offline recognition first
            if (isModelLoaded && strokeCaptures['modalCanvas']) {
                try {
                    console.log('[OfflineHandwriting] Using offline recognition');
                    const result = await recognizeOffline('modalCanvas');
                    
                    if (result && result.text) {
                        recognizedText = result.text.trim();
                        console.log('[OfflineHandwriting] Recognized:', recognizedText);
                        console.log('[OfflineHandwriting] Confidence:', result.confidence);
                    }
                } catch (offlineError) {
                    console.warn('[OfflineHandwriting] Offline recognition failed:', offlineError);
                    // Fall through to server fallback
                }
            }
            
            // Fallback to server if offline failed or unavailable
            if (!recognizedText && CONFIG.enableFallback) {
                console.log('[OfflineHandwriting] Falling back to server API');
                recognizedText = await recognizeViaServer(canvas);
            }
            
            // Apply the recognized text
            if (recognizedText) {
                // Optional: Apply grammar correction
                if (typeof correctNepaliGrammar === 'function') {
                    recognizedText = await correctNepaliGrammar(recognizedText, fieldId);
                }
                
                // Set the field value
                const state = window.fieldStates ? window.fieldStates[fieldId] : null;
                if (state && typeof state.setValue === 'function') {
                    state.setValue(recognizedText, 'handwriting');
                } else {
                    const inputEl = document.getElementById(fieldId);
                    if (inputEl) {
                        inputEl.value = recognizedText;
                        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
                
                if (typeof showSuccess === 'function') {
                    showSuccess('हस्तलेख पहिचान सफल!');
                }
                
                if (typeof closeFieldCanvas === 'function') {
                    closeFieldCanvas();
                }
            } else {
                // Provide specific error message
                if (typeof showError === 'function') {
                    if (!isModelLoaded) {
                        showError('अफलाइन मोडेल उपलब्ध छैन। कृपया किबोर्ड प्रयोग गर्नुहोस्।');
                    } else {
                        showError('पाठ पहिचान गर्न सकेन। कृपया स्पष्ट रूपमा लेख्नुहोस्।');
                    }
                }
            }
            
        } catch (error) {
            console.error('[OfflineHandwriting] Error:', error);
            if (typeof showError === 'function') {
                showError('हस्तलेख पहिचान गर्न सकेन।');
            }
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    }

    /**
     * Fallback: Recognize via server API
     */
    async function recognizeViaServer(canvas) {
        const API_BASE = window.API_BASE || '';
        const imageData64 = canvas.toDataURL('image/png');
        
        const response = await fetch(API_BASE + '/recognize-handwriting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData64 })
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        
        const result = await response.json();
        return result.text || '';
    }

    /**
     * Enhanced modal canvas setup with stroke capture
     */
    function setupModalCanvasWithCapture() {
        const canvas = document.getElementById('modalCanvas');
        if (!canvas) return;
        
        // Setup stroke capture
        setupCanvasCapture('modalCanvas');
        
        // The existing drawing code can remain - StrokeCapture uses the same events
        console.log('[OfflineHandwriting] Modal canvas stroke capture ready');
    }

    /**
     * Clear modal canvas and strokes
     */
    function clearModalCanvasWithStrokes() {
        const canvas = document.getElementById('modalCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        clearCanvasStrokes('modalCanvas');
    }

    /**
     * Check if offline recognition is available
     */
    function isOfflineAvailable() {
        return isModelLoaded && recognizer !== null;
    }

    /**
     * Get recognition confidence threshold based on model
     */
    function getConfidenceThreshold() {
        return 0.5;  // Configurable
    }

    // Export to global scope for integration
    global.OfflineHandwriting = {
        init: initOfflineHandwriting,
        setupCanvasCapture: setupCanvasCapture,
        clearCanvasStrokes: clearCanvasStrokes,
        recognizeOffline: recognizeOffline,
        submitFieldCanvasOffline: submitFieldCanvasOffline,
        setupModalCanvasWithCapture: setupModalCanvasWithCapture,
        clearModalCanvasWithStrokes: clearModalCanvasWithStrokes,
        isOfflineAvailable: isOfflineAvailable,
        config: CONFIG
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Delayed init to not block page load
            setTimeout(initOfflineHandwriting, 1000);
        });
    } else {
        setTimeout(initOfflineHandwriting, 1000);
    }

})(typeof window !== 'undefined' ? window : global);
