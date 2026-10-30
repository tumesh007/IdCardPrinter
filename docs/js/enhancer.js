/**
 * CardEnhancer
 * Provides Auto White Balance, Flat-Field shadow removal, and contrast/brightness enhancement.
 */
const CardEnhancer = (function () {

    function enhance(srcCanvas, options = {}) {
        const {
            autoWb = true,
            flatField = true,
            brightness = 1.0,
            contrast = 1.0
        } = options;

        const w = srcCanvas.width;
        const h = srcCanvas.height;

        const outCanvas = document.createElement('canvas');
        outCanvas.width = w;
        outCanvas.height = h;
        const ctx = outCanvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(srcCanvas, 0, 0);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const len = data.length;

        // 1. Flat-Field Illumination (Shadow Removal)
        let bgData = null;
        if (flatField) {
            // Downsample severely to compute ambient illumination map
            const bgW = Math.max(16, Math.min(64, Math.round(w / 16)));
            const bgH = Math.max(16, Math.min(64, Math.round(h / 16)));

            const lowCanvas = document.createElement('canvas');
            lowCanvas.width = bgW;
            lowCanvas.height = bgH;
            const lowCtx = lowCanvas.getContext('2d');
            lowCtx.drawImage(srcCanvas, 0, 0, bgW, bgH);

            const upCanvas = document.createElement('canvas');
            upCanvas.width = w;
            upCanvas.height = h;
            const upCtx = upCanvas.getContext('2d');
            upCtx.imageSmoothingEnabled = true;
            upCtx.imageSmoothingQuality = 'high';
            upCtx.drawImage(lowCanvas, 0, 0, w, h);

            bgData = upCtx.getImageData(0, 0, w, h).data;
        }

        // 2. Compute channel statistics for Auto White Balance
        let scaleR = 1.0, scaleG = 1.0, scaleB = 1.0;
        if (autoWb) {
            // Sample pixels to calculate top highlights
            const step = Math.max(4, Math.floor(len / 40000));
            const rVals = [], gVals = [], bVals = [];
            for (let i = 0; i < len; i += step * 4) {
                rVals.push(data[i]);
                gVals.push(data[i + 1]);
                bVals.push(data[i + 2]);
            }
            rVals.sort((a, b) => a - b);
            gVals.sort((a, b) => a - b);
            bVals.sort((a, b) => a - b);

            const p98Idx = Math.floor(rVals.length * 0.98);
            const r98 = Math.max(50, rVals[p98Idx]);
            const g98 = Math.max(50, gVals[p98Idx]);
            const b98 = Math.max(50, bVals[p98Idx]);

            const maxWhite = 250;
            scaleR = maxWhite / r98;
            scaleG = maxWhite / g98;
            scaleB = maxWhite / b98;
        }

        // Apply pixel transformations
        for (let i = 0; i < len; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Flat-field correction
            if (flatField && bgData) {
                const bgR = bgData[i];
                const bgG = bgData[i + 1];
                const bgB = bgData[i + 2];
                const bgLum = Math.max(30, 0.299 * bgR + 0.587 * bgG + 0.114 * bgB);
                const boost = 245.0 / bgLum;

                r = r * boost;
                g = g * boost;
                b = b * boost;
            }

            // Auto White Balance
            if (autoWb) {
                r = r * scaleR;
                g = g * scaleG;
                b = b * scaleB;
            }

            // Contrast & Brightness
            if (contrast !== 1.0) {
                r = (r - 128) * contrast + 128;
                g = (g - 128) * contrast + 128;
                b = (b - 128) * contrast + 128;
            }

            if (brightness !== 1.0) {
                r = r * brightness;
                g = g * brightness;
                b = b * brightness;
            }

            data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
            data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
            data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        }

        ctx.putImageData(imgData, 0, 0);
        return outCanvas;
    }

    return {
        enhance
    };
})();
