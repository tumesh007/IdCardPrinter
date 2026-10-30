/**
 * A4LayoutComposer
 * Composes 300 DPI A4 pages (2480 x 3508 px) for Document/KYC, Wallet 1:1, All-In-One, and Full Document.
 * Supports clean output (no text/badges) mode.
 */
const A4LayoutComposer = (function () {

    const A4_W = 2480;
    const A4_H = 3508;

    function drawDashedLine(ctx, x1, y1, x2, y2, strokeStyle = '#888888', lineWidth = 3, dash = 20, gap = 12) {
        ctx.save();
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([dash, gap]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    function compose({ frontCard, backCard = null, layout = 'document', clean = true }) {
        const canvas = document.createElement('canvas');
        canvas.width = A4_W;
        canvas.height = A4_H;
        const ctx = canvas.getContext('2d');

        // White paper background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, A4_W, A4_H);

        const cardW = 1580;
        const cardH = Math.round(cardW * (frontCard.height / frontCard.width));
        const cardX = Math.round((A4_W - cardW) / 2);

        if (layout === 'full_document') {
            const padding = 50;
            const targetW = A4_W - padding * 2;
            const targetH = A4_H - padding * 2;

            const imgRatio = frontCard.width / frontCard.height;
            const targetRatio = targetW / targetH;

            let drawW = targetW;
            let drawH = targetH;
            if (imgRatio > targetRatio) {
                drawH = Math.round(targetW / imgRatio);
            } else {
                drawW = Math.round(targetH * imgRatio);
            }

            const x = Math.round((A4_W - drawW) / 2);
            const y = Math.round((A4_H - drawH) / 2);

            ctx.drawImage(frontCard, x, y, drawW, drawH);
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, drawW, drawH);
            return canvas;
        }

        if (layout === 'document') {
            if (clean) {
                const gap = 220;
                const totalCardsH = cardH * 2 + gap;
                const startY = Math.max(100, Math.round((A4_H - totalCardsH) / 2));

                const yf = startY;
                ctx.drawImage(frontCard, cardX, yf, cardW, cardH);
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 2;
                ctx.strokeRect(cardX, yf, cardW, cardH);

                if (backCard) {
                    const yb = yf + cardH + gap;
                    ctx.drawImage(backCard, cardX, yb, cardW, cardH);
                    ctx.strokeRect(cardX, yb, cardW, cardH);
                }
            } else {
                // Header
                ctx.fillStyle = '#111111';
                ctx.font = 'bold 46px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('ID CARD - DOCUMENT VERIFICATION COPY', A4_W / 2, 190);

                ctx.fillStyle = '#555555';
                ctx.font = '26px sans-serif';
                ctx.fillText('Print Ready Layout • Single Page', A4_W / 2, 245);

                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(180, 290);
                ctx.lineTo(A4_W - 180, 290);
                ctx.stroke();

                // Front
                const yfBadge = 360;
                ctx.fillStyle = '#0d47a1';
                ctx.roundRect ? ctx.beginPath() || ctx.roundRect(cardX, yfBadge, 220, 46, 6) || ctx.fill() : ctx.fillRect(cardX, yfBadge, 220, 46);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 28px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('FRONT SIDE', cardX + 110, yfBadge + 23);

                const yf = yfBadge + 65;
                ctx.drawImage(frontCard, cardX, yf, cardW, cardH);
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 2;
                ctx.strokeRect(cardX, yf, cardW, cardH);

                // Back
                if (backCard) {
                    const ybBadge = yf + cardH + 90;
                    ctx.fillStyle = '#1b5e20';
                    ctx.roundRect ? ctx.beginPath() || ctx.roundRect(cardX, ybBadge, 220, 46, 6) || ctx.fill() : ctx.fillRect(cardX, ybBadge, 220, 46);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 28px sans-serif';
                    ctx.fillText('BACK SIDE', cardX + 110, ybBadge + 23);

                    const yb = ybBadge + 65;
                    ctx.drawImage(backCard, cardX, yb, cardW, cardH);
                    ctx.strokeStyle = '#cccccc';
                    ctx.strokeRect(cardX, yb, cardW, cardH);
                }

                // Footer
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(180, A4_H - 220);
                ctx.lineTo(A4_W - 180, A4_H - 220);
                ctx.stroke();

                ctx.fillStyle = '#555555';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText('Print Settings: Page Size = A4 | Scale = 100% (Actual Size) | Orientation = Portrait', A4_W / 2, A4_H - 170);
            }
        } else if (layout === 'wallet') {
            const wCardW = 1051;
            const wCardH = 673;
            const wCardX = Math.round((A4_W - wCardW) / 2);
            const bCard = backCard || frontCard;

            if (clean) {
                const topY = Math.round((A4_H - 2 * wCardH) / 2);
                ctx.drawImage(frontCard, wCardX, topY, wCardW, wCardH);

                const foldY = topY + wCardH;
                drawDashedLine(ctx, wCardX - 140, foldY, wCardX + wCardW + 140, foldY, '#d32f2f', 3, 20, 12);
                ctx.drawImage(bCard, wCardX, foldY, wCardW, wCardH);

                // Cut border
                const pad = 20;
                const cutX = wCardX - pad;
                const cutY = topY - pad;
                const cutW = wCardW + pad * 2;
                const cutH = 2 * wCardH + pad * 2;
                drawDashedLine(ctx, cutX, cutY, cutX + cutW, cutY, '#444444', 2);
                drawDashedLine(ctx, cutX + cutW, cutY, cutX + cutW, cutY + cutH, '#444444', 2);
                drawDashedLine(ctx, cutX + cutW, cutY + cutH, cutX, cutY + cutH, '#444444', 2);
                drawDashedLine(ctx, cutX, cutY + cutH, cutX, cutY, '#444444', 2);
            } else {
                ctx.fillStyle = '#111111';
                ctx.font = 'bold 46px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('ID CARD - WALLET / LAMINATION PRINT (1:1 SCALE)', A4_W / 2, 235);

                ctx.fillStyle = '#555555';
                ctx.font = '28px sans-serif';
                ctx.fillText('Printed at 100% actual physical size (89 mm x 57 mm). Ready to cut, fold & laminate.', A4_W / 2, 295);

                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(200, 350);
                ctx.lineTo(A4_W - 200, 350);
                ctx.stroke();

                const topY = 560;
                ctx.drawImage(frontCard, wCardX, topY, wCardW, wCardH);

                const foldY = topY + wCardH;
                drawDashedLine(ctx, wCardX - 140, foldY, wCardX + wCardW + 140, foldY, '#d32f2f', 3, 20, 12);

                ctx.fillStyle = '#d32f2f';
                ctx.font = 'bold 26px sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText('FOLD LINE >>', wCardX - 150, foldY);
                ctx.textAlign = 'left';
                ctx.fillText('<< FOLD LINE', wCardX + wCardW + 150, foldY);

                ctx.drawImage(bCard, wCardX, foldY, wCardW, wCardH);

                // Cut border
                const pad = 20;
                const cutX = wCardX - pad;
                const cutY = topY - pad;
                const cutW = wCardW + pad * 2;
                const cutH = 2 * wCardH + pad * 2;
                drawDashedLine(ctx, cutX, cutY, cutX + cutW, cutY, '#444444', 2);
                drawDashedLine(ctx, cutX + cutW, cutY, cutX + cutW, cutY + cutH, '#444444', 2);
                drawDashedLine(ctx, cutX + cutW, cutY + cutH, cutX, cutY + cutH, '#444444', 2);
                drawDashedLine(ctx, cutX, cutY + cutH, cutX, cutY, '#444444', 2);

                ctx.fillStyle = '#444444';
                ctx.font = 'bold 24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('--- [ CUT ALONG DOTTED LINE ] ---', A4_W / 2, cutY - 25);
                ctx.fillText('--- [ CUT ALONG DOTTED LINE ] ---', A4_W / 2, cutY + cutH + 35);
            }
        } else if (layout === 'all_in_one') {
            const cardW1to1 = 1020;
            const cardH1to1 = Math.round(cardW1to1 * (frontCard.height / frontCard.width));
            const gapX = 70;
            const cardsX = Math.round((A4_W - (2 * cardW1to1 + gapX)) / 2);

            const docW = 1460;
            const docH = Math.round(docW * (frontCard.height / frontCard.width));
            const docX = Math.round((A4_W - docW) / 2);
            const bCard = backCard || frontCard;

            if (clean) {
                const cardsY = 140;
                ctx.drawImage(frontCard, cardsX, cardsY, cardW1to1, cardH1to1);
                drawDashedLine(ctx, cardsX - 10, cardsY - 10, cardsX + cardW1to1 + 10, cardsY - 10, '#888888');
                drawDashedLine(ctx, cardsX + cardW1to1 + 10, cardsY - 10, cardsX + cardW1to1 + 10, cardsY + cardH1to1 + 10, '#888888');
                drawDashedLine(ctx, cardsX + cardW1to1 + 10, cardsY + cardH1to1 + 10, cardsX - 10, cardsY + cardH1to1 + 10, '#888888');
                drawDashedLine(ctx, cardsX - 10, cardsY + cardH1to1 + 10, cardsX - 10, cardsY - 10, '#888888');

                const backX = cardsX + cardW1to1 + gapX;
                ctx.drawImage(bCard, backX, cardsY, cardW1to1, cardH1to1);
                drawDashedLine(ctx, backX - 10, cardsY - 10, backX + cardW1to1 + 10, cardsY - 10, '#888888');
                drawDashedLine(ctx, backX + cardW1to1 + 10, cardsY - 10, backX + cardW1to1 + 10, cardsY + cardH1to1 + 10, '#888888');
                drawDashedLine(ctx, backX + cardW1to1 + 10, cardsY + cardH1to1 + 10, backX - 10, cardsY + cardH1to1 + 10, '#888888');
                drawDashedLine(ctx, backX - 10, cardsY + cardH1to1 + 10, backX - 10, cardsY - 10, '#888888');

                const divY = cardsY + cardH1to1 + 80;
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(140, divY);
                ctx.lineTo(A4_W - 140, divY);
                ctx.stroke();

                const ydF = divY + 80;
                ctx.drawImage(frontCard, docX, ydF, docW, docH);
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 2;
                ctx.strokeRect(docX, ydF, docW, docH);

                const ydB = ydF + docH + 80;
                ctx.drawImage(bCard, docX, ydB, docW, docH);
                ctx.strokeRect(docX, ydB, docW, docH);
            } else {
                ctx.fillStyle = '#0d47a1';
                ctx.font = 'bold 42px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('ID CARD - ALL-IN-ONE PRINT LAYOUT', A4_W / 2, 110);

                ctx.fillStyle = '#444444';
                ctx.font = '24px sans-serif';
                ctx.fillText('1:1 Wallet Cut-and-Fold (Top) + KYC Verification Copy (Bottom)', A4_W / 2, 170);

                ctx.strokeStyle = '#bbbbbb';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(140, 215);
                ctx.lineTo(A4_W - 140, 215);
                ctx.stroke();

                const sec1Y = 250;
                ctx.fillStyle = '#1a237e';
                ctx.fillRect(140, sec1Y, 620, 44);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 26px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('SECTION 1: WALLET SIZE (1:1 SCALE)', 450, sec1Y + 22);

                const cardsY = sec1Y + 80;
                ctx.drawImage(frontCard, cardsX, cardsY, cardW1to1, cardH1to1);
                const backX = cardsX + cardW1to1 + gapX;
                ctx.drawImage(bCard, backX, cardsY, cardW1to1, cardH1to1);

                const divY = cardsY + cardH1to1 + 65;
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(140, divY);
                ctx.lineTo(A4_W - 140, divY);
                ctx.stroke();

                const sec2Y = divY + 35;
                ctx.fillStyle = '#1b5e20';
                ctx.fillRect(140, sec2Y, 620, 44);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 26px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('SECTION 2: KYC & DOCUMENT COPY', 450, sec2Y + 22);

                const ydF = sec2Y + 80;
                ctx.drawImage(frontCard, docX, ydF, docW, docH);
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 2;
                ctx.strokeRect(docX, ydF, docW, docH);

                const ydB = ydF + docH + 65;
                ctx.drawImage(bCard, docX, ydB, docW, docH);
                ctx.strokeRect(docX, ydB, docW, docH);
            }
        }

        return canvas;
    }

    return {
        compose
    };
})();
