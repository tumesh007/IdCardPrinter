/**
 * PerspectiveWarper
 * Pure JavaScript projective transform (homography) solver and bilinear pixel warper.
 */
const PerspectiveWarper = (function () {

    /**
     * Maps unit square [0,1]^2 to arbitrary quadrilateral (p0, p1, p2, p3).
     * p0: top-left, p1: top-right, p2: bottom-right, p3: bottom-left.
     */
    function squareToQuad(p0, p1, p2, p3) {
        const x0 = p0.x, y0 = p0.y;
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;

        const dx1 = x1 - x2;
        const dx2 = x3 - x2;
        const sx = x0 - x1 + x2 - x3;

        const dy1 = y1 - y2;
        const dy2 = y3 - y2;
        const sy = y0 - y1 + y2 - y3;

        const det = dx1 * dy2 - dx2 * dy1;
        if (Math.abs(det) < 1e-7) {
            return {
                a: x1 - x0, b: x3 - x0, c: x0,
                d: y1 - y0, e: y3 - y0, f: y0,
                g: 0, h: 0
            };
        }

        const g = (sx * dy2 - sy * dx2) / det;
        const h = (dx1 * sy - dy1 * sx) / det;
        const a = x1 - x0 + g * x1;
        const b = x3 - x0 + h * x3;
        const c = x0;
        const d = y1 - y0 + g * y1;
        const e = y3 - y0 + h * y3;
        const f = y0;

        return { a, b, c, d, e, f, g, h };
    }

    /**
     * Rectifies an image region defined by a 4-corner quad into a new Canvas.
     */
    function rectify(src, quad, targetW, targetH) {
        targetW = Math.max(20, Math.round(targetW));
        targetH = Math.max(20, Math.round(targetH));

        let srcCanvas;
        if (src instanceof HTMLCanvasElement) {
            srcCanvas = src;
        } else {
            srcCanvas = document.createElement('canvas');
            srcCanvas.width = src.naturalWidth || src.width;
            srcCanvas.height = src.naturalHeight || src.height;
            const ctx = srcCanvas.getContext('2d');
            ctx.drawImage(src, 0, 0);
        }

        const srcW = srcCanvas.width;
        const srcH = srcCanvas.height;
        const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
        const srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
        const srcPixels = srcImgData.data;

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = targetW;
        dstCanvas.height = targetH;
        const dstCtx = dstCanvas.getContext('2d');
        const dstImgData = dstCtx.createImageData(targetW, targetH);
        const dstPixels = dstImgData.data;

        const p0 = quad[0]; // TL
        const p1 = quad[1]; // TR
        const p2 = quad[2]; // BR
        const p3 = quad[3]; // BL

        const { a, b, c, d, e, f, g, h } = squareToQuad(p0, p1, p2, p3);

        const invW = 1.0 / targetW;
        const invH = 1.0 / targetH;

        let dstIdx = 0;
        for (let y = 0; y < targetH; y++) {
            const v = y * invH;
            const bv_c = b * v + c;
            const ev_f = e * v + f;
            const hv_1 = h * v + 1.0;

            for (let x = 0; x < targetW; x++) {
                const u = x * invW;
                const w = g * u + hv_1;
                const inv_w = 1.0 / w;

                const sx = (a * u + bv_c) * inv_w;
                const sy = (d * u + ev_f) * inv_w;

                if (sx < 0 || sx >= srcW - 1 || sy < 0 || sy >= srcH - 1) {
                    if (sx >= -1 && sx <= srcW && sy >= -1 && sy <= srcH) {
                        const csx = Math.max(0, Math.min(srcW - 1, Math.round(sx)));
                        const csy = Math.max(0, Math.min(srcH - 1, Math.round(sy)));
                        const sIdx = (csy * srcW + csx) << 2;
                        dstPixels[dstIdx] = srcPixels[sIdx];
                        dstPixels[dstIdx + 1] = srcPixels[sIdx + 1];
                        dstPixels[dstIdx + 2] = srcPixels[sIdx + 2];
                        dstPixels[dstIdx + 3] = 255;
                    } else {
                        dstPixels[dstIdx + 3] = 0;
                    }
                    dstIdx += 4;
                    continue;
                }

                // Bilinear interpolation
                const x0 = Math.floor(sx);
                const y0 = Math.floor(sy);
                const x1 = x0 + 1;
                const y1 = y0 + 1;

                const fx = sx - x0;
                const fy = sy - y0;
                const ifx = 1.0 - fx;
                const ify = 1.0 - fy;

                const w00 = ifx * ify;
                const w10 = fx * ify;
                const w01 = ifx * fy;
                const w11 = fx * fy;

                const row0 = y0 * srcW;
                const row1 = y1 * srcW;

                const idx00 = (row0 + x0) << 2;
                const idx10 = (row0 + x1) << 2;
                const idx01 = (row1 + x0) << 2;
                const idx11 = (row1 + x1) << 2;

                dstPixels[dstIdx] = Math.round(
                    srcPixels[idx00] * w00 + srcPixels[idx10] * w10 +
                    srcPixels[idx01] * w01 + srcPixels[idx11] * w11
                );
                dstPixels[dstIdx + 1] = Math.round(
                    srcPixels[idx00 + 1] * w00 + srcPixels[idx10 + 1] * w10 +
                    srcPixels[idx01 + 1] * w01 + srcPixels[idx11 + 1] * w11
                );
                dstPixels[dstIdx + 2] = Math.round(
                    srcPixels[idx00 + 2] * w00 + srcPixels[idx10 + 2] * w10 +
                    srcPixels[idx01 + 2] * w01 + srcPixels[idx11 + 2] * w11
                );
                dstPixels[dstIdx + 3] = 255;

                dstIdx += 4;
            }
        }

        dstCtx.putImageData(dstImgData, 0, 0);
        return dstCanvas;
    }

    /**
     * Dynamically calculates target dimensions from quadrilateral edge lengths to preserve aspect ratio.
     */
    function rectifyDynamic(src, quad) {
        const p0 = quad[0], p1 = quad[1], p2 = quad[2], p3 = quad[3];
        const wTop = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const wBot = Math.hypot(p2.x - p3.x, p2.y - p3.y);
        const targetW = Math.max(wTop, wBot);

        const hLeft = Math.hypot(p3.x - p0.x, p3.y - p0.y);
        const hRight = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const targetH = Math.max(hLeft, hRight);

        return rectify(src, quad, targetW, targetH);
    }

    return {
        rectify,
        rectifyDynamic
    };
})();
