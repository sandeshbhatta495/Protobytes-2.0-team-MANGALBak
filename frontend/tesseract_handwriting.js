/**
 * Tesseract.js-based Handwriting Recognition for Sarkari Sarathi
 * 
 * Uses Tesseract OCR with Nepali (nep) and English (eng) language support
 * for recognizing handwritten text from canvas.
 */

(function(global) {
    'use strict';

    let worker = null;
    let isInitialized = false;
    let initPromise = null;

    /**
     * Initialize Tesseract worker with Nepali and English
     */
    async function initTesseract() {
        if (initPromise) return initPromise;
        
        initPromise = (async () => {
            console.log('[TesseractHandwriting] Initializing...');
            
            try {
                // Create worker
                worker = await Tesseract.createWorker('nep+eng', 1, {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            console.log(`[TesseractHandwriting] Progress: ${Math.round(m.progress * 100)}%`);
                        }
                    }
                });
                
                // Set parameters for handwriting
                await worker.setParameters({
                    tessedit_pageseg_mode: '7',  // Treat image as single text line
                    preserve_interword_spaces: '1'
                });
                
                isInitialized = true;
                console.log('[TesseractHandwriting] Ready!');
                
            } catch (error) {
                console.error('[TesseractHandwriting] Init failed:', error);
                throw error;
            }
        })();
        
        return initPromise;
    }

    /**
     * Preprocess canvas for better OCR results
     */
    function preprocessCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Create a new canvas with white background and black strokes
        const processedCanvas = document.createElement('canvas');
        processedCanvas.width = canvas.width;
        processedCanvas.height = canvas.height;
        const pCtx = processedCanvas.getContext('2d');
        
        // Fill with white
        pCtx.fillStyle = 'white';
        pCtx.fillRect(0, 0, processedCanvas.width, processedCanvas.height);
        
        // Copy the drawing
        pCtx.drawImage(canvas, 0, 0);
        
        // Get processed image data and enhance contrast
        const pImageData = pCtx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
        const pData = pImageData.data;
        
        // Threshold to pure black and white for better OCR
        for (let i = 0; i < pData.length; i += 4) {
            const avg = (pData[i] + pData[i + 1] + pData[i + 2]) / 3;
            const val = avg < 200 ? 0 : 255;  // Threshold
            pData[i] = val;     // R
            pData[i + 1] = val; // G
            pData[i + 2] = val; // B
            // Alpha stays the same
        }
        
        pCtx.putImageData(pImageData, 0, 0);
        
        return processedCanvas;
    }

    /**
     * Recognize text from canvas
     */
    async function recognizeFromCanvas(canvas) {
        if (!isInitialized) {
            await initTesseract();
        }
        
        console.log('[TesseractHandwriting] Starting recognition...');
        const startTime = performance.now();
        
        // Preprocess the canvas
        const processedCanvas = preprocessCanvas(canvas);
        
        // Convert to blob for Tesseract
        const blob = await new Promise(resolve => {
            processedCanvas.toBlob(resolve, 'image/png');
        });
        
        try {
            const result = await worker.recognize(blob);
            const text = result.data.text.trim();
            
            const duration = Math.round(performance.now() - startTime);
            console.log(`[TesseractHandwriting] Result: "${text}" (${duration}ms)`);
            
            return {
                success: true,
                text: text,
                confidence: result.data.confidence,
                duration: duration
            };
            
        } catch (error) {
            console.error('[TesseractHandwriting] Recognition error:', error);
            return {
                success: false,
                text: '',
                error: error.message
            };
        }
    }

    /**
     * Check if Tesseract is available
     */
    function isAvailable() {
        return typeof Tesseract !== 'undefined';
    }

    /**
     * Check if initialized
     */
    function isReady() {
        return isInitialized;
    }

    // Export to global
    global.TesseractHandwriting = {
        init: initTesseract,
        recognize: recognizeFromCanvas,
        isAvailable: isAvailable,
        isReady: isReady
    };

})(window);
