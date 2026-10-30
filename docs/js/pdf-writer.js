/**
 * PdfWriter
 * Minimal, zero-dependency pure JavaScript generator for single-page A4 PDFs.
 */
const PdfWriter = (function () {

    /**
     * Converts a Canvas into an A4 PDF Blob.
     * @param {HTMLCanvasElement} canvas
     * @param {number} quality (0..1)
     * @returns {Promise<Blob>}
     */
    async function canvasToPdf(canvas, quality = 0.92) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    reject(new Error('Failed to export canvas to JPEG blob.'));
                    return;
                }
                const buffer = await blob.arrayBuffer();
                const jpegBytes = new Uint8Array(buffer);

                const width = canvas.width;
                const height = canvas.height;

                const pdfBytes = buildA4Pdf(jpegBytes, width, height);
                resolve(new Blob([pdfBytes], { type: 'application/pdf' }));
            }, 'image/jpeg', quality);
        });
    }

    function buildA4Pdf(jpegBytes, imgW, imgH) {
        const encoder = new TextEncoder();

        // A4 points: 595.28 x 841.89
        const a4W = '595.28';
        const a4H = '841.89';

        const headerStr = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
        const headerBytes = encoder.encode(headerStr);

        const contentStreamStr = `q ${a4W} 0 0 ${a4H} 0 0 cm /Im0 Do Q`;
        const contentStreamBytes = encoder.encode(contentStreamStr);

        // Object 1: Catalog
        const obj1Str = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
        const obj1 = encoder.encode(obj1Str);

        // Object 2: Pages
        const obj2Str = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
        const obj2 = encoder.encode(obj2Str);

        // Object 3: Page
        const obj3Str = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${a4W} ${a4H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
        const obj3 = encoder.encode(obj3Str);

        // Object 4: Image XObject (JPEG DCTDecode)
        const obj4HeadStr = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
        const obj4Head = encoder.encode(obj4HeadStr);
        const obj4Tail = encoder.encode('\nendstream\nendobj\n');

        // Object 5: Contents
        const obj5Str = `5 0 obj\n<< /Length ${contentStreamBytes.length} >>\nstream\n${contentStreamStr}\nendstream\nendobj\n`;
        const obj5 = encoder.encode(obj5Str);

        const objs = [
            obj1,
            obj2,
            obj3,
            concatBuffers([obj4Head, jpegBytes, obj4Tail]),
            obj5
        ];

        // Compute offsets
        const offsets = [];
        let curr = headerBytes.length;
        for (const o of objs) {
            offsets.push(curr);
            curr += o.length;
        }

        // Xref table
        let xrefStr = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
        for (const off of offsets) {
            xrefStr += `${off.toString().padStart(10, '0')} 00000 n \n`;
        }
        xrefStr += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${curr}\n%%EOF\n`;
        const xrefBytes = encoder.encode(xrefStr);

        return concatBuffers([headerBytes, ...objs, xrefBytes]);
    }

    function concatBuffers(arrays) {
        let total = 0;
        for (const a of arrays) total += a.length;
        const res = new Uint8Array(total);
        let offset = 0;
        for (const a of arrays) {
            res.set(a, offset);
            offset += a.length;
        }
        return res;
    }

    return {
        canvasToPdf
    };
})();
