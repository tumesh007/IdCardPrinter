/**
 * CardCropper
 * Interactive Canvas component for 4-point perspective cropping,
 * edge dragging, center box movement, 90° rotation, and touch magnifying loupe.
 */
class CardCropper {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = options;

        this.image = null;
        this.corners = []; // [TL, TR, BR, BL] in image coordinates
        this.scale = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;

        this.activeHandle = -1; // 0..3: corners, 4..7: edges, 8: center
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.initialCorners = [];

        this.touchRadius = 30; // touch target radius in px
        this.isDragging = false;
        this.lastTouchPos = null;

        this.initEvents();
    }

    setImage(image, initialQuad = null) {
        this.image = image;
        const w = image.naturalWidth || image.width;
        const h = image.naturalHeight || image.height;

        if (initialQuad && initialQuad.length === 4) {
            this.corners = initialQuad.map(p => ({ x: p.x, y: p.y }));
        } else {
            // Default 10% margins inset
            const mx = w * 0.08;
            const my = h * 0.12;
            this.corners = [
                { x: mx, y: my },
                { x: w - mx, y: my },
                { x: w - mx, y: h - my },
                { x: mx, y: h - my }
            ];
        }

        this.resize();
        this.render();
    }

    rotateImage() {
        if (!this.image) return;
        const srcW = this.image.naturalWidth || this.image.width;
        const srcH = this.image.naturalHeight || this.image.height;

        // Rotate canvas 90 deg clockwise
        const rotCanvas = document.createElement('canvas');
        rotCanvas.width = srcH;
        rotCanvas.height = srcW;
        const rotCtx = rotCanvas.getContext('2d');
        rotCtx.translate(srcH, 0);
        rotCtx.rotate(Math.PI / 2);
        rotCtx.drawImage(this.image, 0, 0);

        // Rotate corners (x, y) -> (srcH - y, x)
        // BL -> TL, TL -> TR, TR -> BR, BR -> BL
        const [p0, p1, p2, p3] = this.corners;
        const r0 = { x: srcH - p3.y, y: p3.x };
        const r1 = { x: srcH - p0.y, y: p0.x };
        const r2 = { x: srcH - p1.y, y: p1.x };
        const r3 = { x: srcH - p2.y, y: p2.x };

        this.corners = [r0, r1, r2, r3];
        this.image = rotCanvas;
        this.resize();
        this.render();
    }

    resetCorners() {
        if (!this.image) return;
        const w = this.image.naturalWidth || this.image.width;
        const h = this.image.naturalHeight || this.image.height;
        const mx = w * 0.08;
        const my = h * 0.12;
        this.corners = [
            { x: mx, y: my },
            { x: w - mx, y: my },
            { x: w - mx, y: h - my },
            { x: mx, y: h - my }
        ];
        this.render();
    }

    getCorners() {
        return this.corners.map(p => ({ x: p.x, y: p.y }));
    }

    resize() {
        if (!this.image) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const displayW = rect.width;
        const displayH = Math.min(window.innerHeight * 0.65, Math.max(320, rect.height || 450));

        this.canvas.width = displayW * window.devicePixelRatio;
        this.canvas.height = displayH * window.devicePixelRatio;
        this.canvas.style.width = displayW + 'px';
        this.canvas.style.height = displayH + 'px';

        const imgW = this.image.naturalWidth || this.image.width;
        const imgH = this.image.naturalHeight || this.image.height;

        const pad = 36 * window.devicePixelRatio;
        const availW = this.canvas.width - pad * 2;
        const availH = this.canvas.height - pad * 2;

        this.scale = Math.min(availW / imgW, availH / imgH);
        this.offsetX = (this.canvas.width - imgW * this.scale) / 2;
        this.offsetY = (this.canvas.height - imgH * this.scale) / 2;
    }

    imgToCanvas(pt) {
        return {
            x: this.offsetX + pt.x * this.scale,
            y: this.offsetY + pt.y * this.scale
        };
    }

    canvasToImg(pt) {
        return {
            x: (pt.x - this.offsetX) / this.scale,
            y: (pt.y - this.offsetY) / this.scale
        };
    }

    render() {
        const ctx = this.ctx;
        const dpr = window.devicePixelRatio;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.image) return;

        const imgW = this.image.naturalWidth || this.image.width;
        const imgH = this.image.naturalHeight || this.image.height;

        // Draw image
        ctx.drawImage(this.image, this.offsetX, this.offsetY, imgW * this.scale, imgH * this.scale);

        // Dark dim overlay outside quad
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Cut out the selected quad
        const cp = this.corners.map(p => this.imgToCanvas(p));
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(cp[0].x, cp[0].y);
        ctx.lineTo(cp[1].x, cp[1].y);
        ctx.lineTo(cp[2].x, cp[2].y);
        ctx.lineTo(cp[3].x, cp[3].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Quad border
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(cp[0].x, cp[0].y);
        ctx.lineTo(cp[1].x, cp[1].y);
        ctx.lineTo(cp[2].x, cp[2].y);
        ctx.lineTo(cp[3].x, cp[3].y);
        ctx.closePath();
        ctx.stroke();

        // Edge Midpoint handles
        const midpoints = [
            { x: (cp[0].x + cp[1].x) / 2, y: (cp[0].y + cp[1].y) / 2 },
            { x: (cp[1].x + cp[2].x) / 2, y: (cp[1].y + cp[2].y) / 2 },
            { x: (cp[2].x + cp[3].x) / 2, y: (cp[2].y + cp[3].y) / 2 },
            { x: (cp[3].x + cp[0].x) / 2, y: (cp[3].y + cp[0].y) / 2 }
        ];

        midpoints.forEach((mp) => {
            ctx.fillStyle = '#60a5fa';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5 * dpr;
            ctx.beginPath();
            ctx.arc(mp.x, mp.y, 6 * dpr, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });

        // Corner Handles with colored badges
        const cornerColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'];
        const cornerLabels = ['TL', 'TR', 'BR', 'BL'];
        const handleRadius = 13 * dpr;

        cp.forEach((pt, i) => {
            ctx.fillStyle = cornerColors[i];
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5 * dpr;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, handleRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Label text inside handle
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${9 * dpr}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cornerLabels[i], pt.x, pt.y);
        });

        // Touch Loupe Magnifier when dragging a corner
        if (this.isDragging && this.activeHandle >= 0 && this.activeHandle <= 3 && this.lastTouchPos) {
            this.renderLoupe(this.activeHandle);
        }
    }

    renderLoupe(handleIdx) {
        const ctx = this.ctx;
        const dpr = window.devicePixelRatio;
        const targetPt = this.corners[handleIdx];
        const canvasPt = this.imgToCanvas(targetPt);

        // Position loupe offset above touch point
        const loupeRadius = 55 * dpr;
        let loupeX = canvasPt.x;
        let loupeY = canvasPt.y - loupeRadius - 40 * dpr;

        // Keep inside bounds
        if (loupeY - loupeRadius < 10) {
            loupeY = canvasPt.y + loupeRadius + 40 * dpr;
        }
        loupeX = Math.max(loupeRadius + 10, Math.min(this.canvas.width - loupeRadius - 10, loupeX));

        ctx.save();
        // Circular clipping
        ctx.beginPath();
        ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // 2x zoom around target point
        const zoom = 2.0;
        const cropW = (loupeRadius * 2) / (this.scale * zoom);
        const cropH = (loupeRadius * 2) / (this.scale * zoom);
        const cropX = targetPt.x - cropW / 2;
        const cropY = targetPt.y - cropH / 2;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(loupeX - loupeRadius, loupeY - loupeRadius, loupeRadius * 2, loupeRadius * 2);
        ctx.drawImage(
            this.image,
            cropX, cropY, cropW, cropH,
            loupeX - loupeRadius, loupeY - loupeRadius, loupeRadius * 2, loupeRadius * 2
        );

        // Crosshairs in center
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(loupeX - 18 * dpr, loupeY);
        ctx.lineTo(loupeX + 18 * dpr, loupeY);
        ctx.moveTo(loupeX, loupeY - 18 * dpr);
        ctx.lineTo(loupeX, loupeY + 18 * dpr);
        ctx.stroke();

        ctx.restore();

        // Loupe border
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3.5 * dpr;
        ctx.beginPath();
        ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
        ctx.stroke();
    }

    initEvents() {
        const getCanvasPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * (this.canvas.width / rect.width),
                y: (clientY - rect.top) * (this.canvas.height / rect.height)
            };
        };

        const onDown = (e) => {
            if (!this.image) return;
            const pos = getCanvasPos(e);
            this.lastTouchPos = pos;
            const dpr = window.devicePixelRatio;
            const hitRadius = this.touchRadius * dpr;

            const cp = this.corners.map(p => this.imgToCanvas(p));

            this.activeHandle = -1;

            // 1. Check 4 corners
            for (let i = 0; i < 4; i++) {
                const dist = Math.hypot(pos.x - cp[i].x, pos.y - cp[i].y);
                if (dist <= hitRadius) {
                    this.activeHandle = i;
                    break;
                }
            }

            // 2. Check 4 edge midpoints
            if (this.activeHandle === -1) {
                const edges = [[0, 1], [1, 2], [2, 3], [3, 0]];
                for (let i = 0; i < 4; i++) {
                    const [i1, i2] = edges[i];
                    const mx = (cp[i1].x + cp[i2].x) / 2;
                    const my = (cp[i1].y + cp[i2].y) / 2;
                    if (Math.hypot(pos.x - mx, pos.y - my) <= hitRadius) {
                        this.activeHandle = 4 + i;
                        break;
                    }
                }
            }

            // 3. Check inside polygon (center drag)
            if (this.activeHandle === -1) {
                if (this.pointInPoly(pos, cp)) {
                    this.activeHandle = 8;
                }
            }

            if (this.activeHandle !== -1) {
                this.isDragging = true;
                this.dragStartX = pos.x;
                this.dragStartY = pos.y;
                this.initialCorners = this.corners.map(p => ({ x: p.x, y: p.y }));
                if (e.cancelable) e.preventDefault();
                this.render();
            }
        };

        const onMove = (e) => {
            if (!this.isDragging || this.activeHandle === -1) return;
            const pos = getCanvasPos(e);
            this.lastTouchPos = pos;

            const dx = (pos.x - this.dragStartX) / this.scale;
            const dy = (pos.y - this.dragStartY) / this.scale;

            const imgW = this.image.naturalWidth || this.image.width;
            const imgH = this.image.naturalHeight || this.image.height;

            const clamp = (val, max) => Math.max(0, Math.min(max, val));

            if (this.activeHandle >= 0 && this.activeHandle <= 3) {
                // Corner drag
                const currImg = this.canvasToImg(pos);
                this.corners[this.activeHandle] = {
                    x: clamp(currImg.x, imgW),
                    y: clamp(currImg.y, imgH)
                };
            } else if (this.activeHandle >= 4 && this.activeHandle <= 7) {
                // Edge drag
                const edgeCorners = [
                    [0, 1], // Top
                    [1, 2], // Right
                    [2, 3], // Bottom
                    [3, 0]  // Left
                ][this.activeHandle - 4];

                const c1 = edgeCorners[0], c2 = edgeCorners[1];
                this.corners[c1] = {
                    x: clamp(this.initialCorners[c1].x + dx, imgW),
                    y: clamp(this.initialCorners[c1].y + dy, imgH)
                };
                this.corners[c2] = {
                    x: clamp(this.initialCorners[c2].x + dx, imgW),
                    y: clamp(this.initialCorners[c2].y + dy, imgH)
                };
            } else if (this.activeHandle === 8) {
                // Whole quad move
                for (let i = 0; i < 4; i++) {
                    this.corners[i] = {
                        x: clamp(this.initialCorners[i].x + dx, imgW),
                        y: clamp(this.initialCorners[i].y + dy, imgH)
                    };
                }
            }

            if (e.cancelable) e.preventDefault();
            this.render();
        };

        const onUp = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.activeHandle = -1;
                this.render();
            }
        };

        this.canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        this.canvas.addEventListener('touchstart', onDown, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
        window.addEventListener('touchcancel', onUp);
    }

    pointInPoly(pt, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
                (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
}
