/**
 * App Controller
 * Orchestrates the ID Card & Document Printer web application.
 */
document.addEventListener('DOMContentLoaded', () => {

    const state = {
        mode: 'id_card', // 'id_card' | 'full_document'
        front: {
            rawImage: null,
            quad: null,
            rectifiedCanvas: null,
            canvas: document.getElementById('frontCanvas'),
            placeholder: document.getElementById('frontPlaceholder'),
            cropBtn: document.getElementById('frontCropBtn'),
            rotateBtn: document.getElementById('frontRotateBtn'),
            clearBtn: document.getElementById('frontClearBtn')
        },
        back: {
            rawImage: null,
            quad: null,
            rectifiedCanvas: null,
            canvas: document.getElementById('backCanvas'),
            placeholder: document.getElementById('backPlaceholder'),
            cropBtn: document.getElementById('backCropBtn'),
            rotateBtn: document.getElementById('backRotateBtn'),
            clearBtn: document.getElementById('backClearBtn')
        },
        activeCroppingSlot: null,
        cropper: null
    };

    // UI Elements
    const modeIdCardBtn = document.getElementById('modeIdCard');
    const modeDocumentBtn = document.getElementById('modeDocument');
    const backSlot = document.getElementById('backSlot');
    const frontTitle = document.getElementById('frontTitle');

    const chkAutoWb = document.getElementById('chkAutoWb');
    const chkFlatField = document.getElementById('chkFlatField');
    const sliderBrightness = document.getElementById('sliderBrightness');
    const sliderContrast = document.getElementById('sliderContrast');
    const lblBrightness = document.getElementById('lblBrightness');
    const lblContrast = document.getElementById('lblContrast');
    const chkCleanOutput = document.getElementById('chkCleanOutput');

    const btnLoadSamples = document.getElementById('btnLoadSamples');
    const btnSwapSides = document.getElementById('btnSwapSides');
    const btnClearAll = document.getElementById('btnClearAll');

    const btnPreview = document.getElementById('btnPreview');
    const btnPrint = document.getElementById('btnPrint');
    const btnSavePdf = document.getElementById('btnSavePdf');
    const btnSavePngs = document.getElementById('btnSavePngs');
    const statusMsg = document.getElementById('statusMsg');

    // Crop Modal Elements
    const cropModal = document.getElementById('cropModal');
    const cropCanvas = document.getElementById('cropCanvas');
    const cropCloseBtn = document.getElementById('cropCloseBtn');
    const cropResetBtn = document.getElementById('cropResetBtn');
    const cropRotateBtn = document.getElementById('cropRotateBtn');
    const cropApplyBtn = document.getElementById('cropApplyBtn');

    // Preview Modal Elements
    const previewModal = document.getElementById('previewModal');
    const previewCanvas = document.getElementById('previewCanvas');
    const previewCloseBtn = document.getElementById('previewCloseBtn');
    const previewPrintBtn = document.getElementById('previewPrintBtn');
    const previewPdfBtn = document.getElementById('previewPdfBtn');
    const printContainer = document.getElementById('printContainer');

    // ----------------------------------------------------
    // Sliders
    // ----------------------------------------------------
    sliderBrightness.addEventListener('input', () => {
        lblBrightness.textContent = Math.round(sliderBrightness.value * 100) + '%';
    });
    sliderContrast.addEventListener('input', () => {
        lblContrast.textContent = Math.round(sliderContrast.value * 100) + '%';
    });

    // ----------------------------------------------------
    // Mode Switching
    // ----------------------------------------------------
    function setMode(newMode) {
        state.mode = newMode;
        if (newMode === 'full_document') {
            modeDocumentBtn.classList.add('active');
            modeIdCardBtn.classList.remove('active');
            backSlot.style.display = 'none';
            frontTitle.textContent = 'Document Image';
            const fullDocRadio = document.querySelector('input[name="layout"][value="full_document"]');
            if (fullDocRadio) fullDocRadio.checked = true;
        } else {
            modeIdCardBtn.classList.add('active');
            modeDocumentBtn.classList.remove('active');
            backSlot.style.display = 'flex';
            frontTitle.textContent = 'Front Side (Photo / Name)';
            const docRadio = document.querySelector('input[name="layout"][value="document"]');
            if (docRadio) docRadio.checked = true;
        }
    }

    modeIdCardBtn.addEventListener('click', () => setMode('id_card'));
    modeDocumentBtn.addEventListener('click', () => setMode('full_document'));

    // ----------------------------------------------------
    // Slot Setup (File, Drop, Camera)
    // ----------------------------------------------------
    function setupSlot(slotKey, fileInputId, cameraInputId, browseBtnId, cameraBtnId, dropZoneId) {
        const slot = state[slotKey];
        const fileInput = document.getElementById(fileInputId);
        const cameraInput = document.getElementById(cameraInputId);
        const browseBtn = document.getElementById(browseBtnId);
        const cameraBtn = document.getElementById(cameraBtnId);
        const dropZone = document.getElementById(dropZoneId);

        browseBtn.addEventListener('click', () => fileInput.click());
        cameraBtn.addEventListener('click', () => cameraInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                loadImageFile(slotKey, e.target.files[0]);
            }
        });

        cameraInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                loadImageFile(slotKey, e.target.files[0]);
            }
        });

        // Drag and drop
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.parentElement.classList.add('dragover');
            });
        });
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.parentElement.classList.remove('dragover');
            });
        });
        dropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                loadImageFile(slotKey, e.dataTransfer.files[0]);
            }
        });

        // Crop Button
        slot.cropBtn.addEventListener('click', () => openCropModal(slotKey));

        // Rotate Button
        slot.rotateBtn.addEventListener('click', () => rotateSlotImage(slotKey));

        // Clear Button
        slot.clearBtn.addEventListener('click', () => clearSlot(slotKey));
    }

    setupSlot('front', 'frontFileInput', 'frontCameraInput', 'frontBrowseBtn', 'frontCameraBtn', 'frontDropZone');
    setupSlot('back', 'backFileInput', 'backCameraInput', 'backBrowseBtn', 'backCameraBtn', 'backDropZone');

    function loadImageFile(slotKey, file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => loadSlotImage(slotKey, img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function loadSlotImage(slotKey, img) {
        const slot = state[slotKey];
        slot.rawImage = img;

        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        // Auto quad with 8% inset
        const mx = w * 0.08;
        const my = h * 0.12;
        slot.quad = [
            { x: mx, y: my },
            { x: w - mx, y: my },
            { x: w - mx, y: h - my },
            { x: mx, y: h - my }
        ];

        rectifySlot(slotKey);

        slot.cropBtn.disabled = false;
        slot.rotateBtn.disabled = false;
        slot.clearBtn.style.display = 'inline-block';
        slot.placeholder.style.display = 'none';
        slot.canvas.style.display = 'block';

        statusMsg.textContent = `Loaded ${slotKey} side. Click 'Crop / Edit' to adjust boundary.`;
    }

    function rectifySlot(slotKey) {
        const slot = state[slotKey];
        if (!slot.rawImage || !slot.quad) return;

        if (state.mode === 'full_document' || getSelectedLayout() === 'full_document') {
            slot.rectifiedCanvas = PerspectiveWarper.rectifyDynamic(slot.rawImage, slot.quad);
        } else {
            // Standard ID card aspect ratio: 1184 x 758
            slot.rectifiedCanvas = PerspectiveWarper.rectify(slot.rawImage, slot.quad, 1184, 758);
        }

        renderSlotThumbnail(slotKey);
    }

    function renderSlotThumbnail(slotKey) {
        const slot = state[slotKey];
        if (!slot.rectifiedCanvas) return;

        const canvas = slot.canvas;
        const ctx = canvas.getContext('2d');
        const src = slot.rectifiedCanvas;

        const maxW = 380;
        const maxH = 260;
        const ratio = Math.min(maxW / src.width, maxH / src.height, 1.0);

        canvas.width = Math.round(src.width * ratio);
        canvas.height = Math.round(src.height * ratio);
        ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    }

    function rotateSlotImage(slotKey) {
        const slot = state[slotKey];
        if (!slot.rawImage) return;

        const srcW = slot.rawImage.naturalWidth || slot.rawImage.width;
        const srcH = slot.rawImage.naturalHeight || slot.rawImage.height;

        const rotCanvas = document.createElement('canvas');
        rotCanvas.width = srcH;
        rotCanvas.height = srcW;
        const rotCtx = rotCanvas.getContext('2d');
        rotCtx.translate(srcH, 0);
        rotCtx.rotate(Math.PI / 2);
        rotCtx.drawImage(slot.rawImage, 0, 0);

        // Rotate corners (x, y) -> (srcH - y, x)
        const [p0, p1, p2, p3] = slot.quad;
        slot.quad = [
            { x: srcH - p3.y, y: p3.x },
            { x: srcH - p0.y, y: p0.x },
            { x: srcH - p1.y, y: p1.x },
            { x: srcH - p2.y, y: p2.x }
        ];

        slot.rawImage = rotCanvas;
        rectifySlot(slotKey);
    }

    function clearSlot(slotKey) {
        const slot = state[slotKey];
        slot.rawImage = null;
        slot.quad = null;
        slot.rectifiedCanvas = null;
        slot.cropBtn.disabled = true;
        slot.rotateBtn.disabled = true;
        slot.clearBtn.style.display = 'none';
        slot.canvas.style.display = 'none';
        slot.placeholder.style.display = 'block';
    }

    // ----------------------------------------------------
    // Swap Sides & Clear All
    // ----------------------------------------------------
    btnSwapSides.addEventListener('click', () => {
        const tempRaw = state.front.rawImage;
        const tempQuad = state.front.quad;
        const tempRect = state.front.rectifiedCanvas;

        state.front.rawImage = state.back.rawImage;
        state.front.quad = state.back.quad;
        state.front.rectifiedCanvas = state.back.rectifiedCanvas;

        state.back.rawImage = tempRaw;
        state.back.quad = tempQuad;
        state.back.rectifiedCanvas = tempRect;

        ['front', 'back'].forEach(k => {
            const slot = state[k];
            if (slot.rawImage) {
                slot.cropBtn.disabled = false;
                slot.rotateBtn.disabled = false;
                slot.clearBtn.style.display = 'inline-block';
                slot.placeholder.style.display = 'none';
                slot.canvas.style.display = 'block';
                renderSlotThumbnail(k);
            } else {
                clearSlot(k);
            }
        });
        statusMsg.textContent = 'Swapped Front and Back sides.';
    });

    btnClearAll.addEventListener('click', () => {
        clearSlot('front');
        clearSlot('back');
        statusMsg.textContent = 'Cleared. Ready for new cards.';
    });

    // ----------------------------------------------------
    // Load Sample Cards
    // ----------------------------------------------------
    btnLoadSamples.addEventListener('click', () => {
        statusMsg.textContent = 'Loading sample cards...';
        const loadImg = (url) => new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });

        Promise.all([
            loadImg('samples/sample_front.jpg'),
            loadImg('samples/sample_back.jpg')
        ]).then(([fImg, bImg]) => {
            loadSlotImage('front', fImg);
            loadSlotImage('back', bImg);
            statusMsg.textContent = 'Sample cards loaded! Click Preview or Print to generate A4.';
        }).catch(err => {
            console.error('Failed to load samples:', err);
            statusMsg.textContent = 'Could not load sample images.';
        });
    });

    // ----------------------------------------------------
    // Crop Modal
    // ----------------------------------------------------
    function openCropModal(slotKey) {
        state.activeCroppingSlot = slotKey;
        const slot = state[slotKey];
        if (!slot.rawImage) return;

        document.getElementById('cropModalTitle').textContent = `Align & Crop: ${slotKey === 'front' ? 'Front Side' : 'Back Side'}`;
        cropModal.classList.add('active');

        if (!state.cropper) {
            state.cropper = new CardCropper(cropCanvas);
        }
        state.cropper.setImage(slot.rawImage, slot.quad);
    }

    function closeCropModal() {
        cropModal.classList.remove('active');
        state.activeCroppingSlot = null;
    }

    cropCloseBtn.addEventListener('click', closeCropModal);
    cropResetBtn.addEventListener('click', () => state.cropper && state.cropper.resetCorners());
    cropRotateBtn.addEventListener('click', () => state.cropper && state.cropper.rotateImage());

    cropApplyBtn.addEventListener('click', () => {
        if (!state.cropper || !state.activeCroppingSlot) return;
        const slotKey = state.activeCroppingSlot;
        const slot = state[slotKey];

        slot.rawImage = state.cropper.image;
        slot.quad = state.cropper.getCorners();
        rectifySlot(slotKey);
        closeCropModal();
        statusMsg.textContent = `Crop applied for ${slotKey} side.`;
    });

    // ----------------------------------------------------
    // Processing & Composition
    // ----------------------------------------------------
    function getSelectedLayout() {
        if (state.mode === 'full_document') return 'full_document';
        const checked = document.querySelector('input[name="layout"]:checked');
        return checked ? checked.value : 'document';
    }

    function getEnhancedCards() {
        if (!state.front.rawImage && !state.back.rawImage) {
            alert('Please load at least one card image (Front or Back).');
            return null;
        }

        const options = {
            autoWb: chkAutoWb.checked,
            flatField: chkFlatField.checked,
            brightness: parseFloat(sliderBrightness.value),
            contrast: parseFloat(sliderContrast.value)
        };

        let fCard = null;
        let bCard = null;

        if (state.front.rectifiedCanvas) {
            fCard = CardEnhancer.enhance(state.front.rectifiedCanvas, options);
        }
        if (state.back.rectifiedCanvas) {
            bCard = CardEnhancer.enhance(state.back.rectifiedCanvas, options);
        }

        if (!fCard && bCard) fCard = bCard;
        if (!bCard && fCard) bCard = fCard;

        return { fCard, bCard };
    }

    function generateA4Page() {
        const cards = getEnhancedCards();
        if (!cards) return null;

        const layout = getSelectedLayout();
        const clean = chkCleanOutput.checked;

        return A4LayoutComposer.compose({
            frontCard: cards.fCard,
            backCard: cards.bCard,
            layout: layout,
            clean: clean
        });
    }

    // ----------------------------------------------------
    // Preview Modal
    // ----------------------------------------------------
    btnPreview.addEventListener('click', () => {
        const a4Canvas = generateA4Page();
        if (!a4Canvas) return;

        // Render scaled preview on previewCanvas
        const maxDisplayH = Math.min(window.innerHeight * 0.72, 700);
        const scale = maxDisplayH / a4Canvas.height;
        previewCanvas.width = Math.round(a4Canvas.width * scale);
        previewCanvas.height = Math.round(a4Canvas.height * scale);

        const ctx = previewCanvas.getContext('2d');
        ctx.drawImage(a4Canvas, 0, 0, previewCanvas.width, previewCanvas.height);

        const layout = getSelectedLayout();
        const cleanText = chkCleanOutput.checked ? 'Clean Output (No Text)' : 'Standard with Labels';
        document.getElementById('previewTitle').textContent = `A4 Print Preview — ${cleanText}`;

        previewModal.classList.add('active');
        statusMsg.textContent = 'Preview generated.';
    });

    previewCloseBtn.addEventListener('click', () => previewModal.classList.remove('active'));

    // ----------------------------------------------------
    // Direct Print
    // ----------------------------------------------------
    function triggerDirectPrint() {
        const a4Canvas = generateA4Page();
        if (!a4Canvas) return;

        // Populate printContainer with the image
        printContainer.innerHTML = '';
        const img = new Image();
        img.src = a4Canvas.toDataURL('image/jpeg', 0.95);
        printContainer.appendChild(img);
        printContainer.style.display = 'block';

        statusMsg.textContent = 'Sending to printer...';

        setTimeout(() => {
            window.print();
            printContainer.style.display = 'none';
            statusMsg.textContent = 'Print dialog opened.';
        }, 300);
    }

    btnPrint.addEventListener('click', triggerDirectPrint);
    previewPrintBtn.addEventListener('click', () => {
        previewModal.classList.remove('active');
        triggerDirectPrint();
    });

    // ----------------------------------------------------
    // Download PDF
    // ----------------------------------------------------
    async function downloadPdf() {
        const a4Canvas = generateA4Page();
        if (!a4Canvas) return;

        statusMsg.textContent = 'Generating 300 DPI A4 PDF...';
        try {
            const pdfBlob = await PdfWriter.canvasToPdf(a4Canvas, 0.93);
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `id_card_print_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            statusMsg.textContent = 'A4 PDF downloaded successfully!';
        } catch (err) {
            console.error('PDF generation error:', err);
            statusMsg.textContent = 'Failed to generate PDF.';
        }
    }

    btnSavePdf.addEventListener('click', downloadPdf);
    previewPdfBtn.addEventListener('click', () => {
        previewModal.classList.remove('active');
        downloadPdf();
    });

    // ----------------------------------------------------
    // Save PNG Cards
    // ----------------------------------------------------
    btnSavePngs.addEventListener('click', () => {
        const cards = getEnhancedCards();
        if (!cards) return;

        function triggerDownload(canvas, filename) {
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        if (state.front.rectifiedCanvas) {
            triggerDownload(cards.fCard, 'id_front_enhanced.png');
        }
        if (state.back.rectifiedCanvas) {
            setTimeout(() => triggerDownload(cards.bCard, 'id_back_enhanced.png'), 200);
        }
        statusMsg.textContent = 'Enhanced PNG cards downloaded.';
    });

});
