# ID Card Print Utility — Release v1.0.0

A lightweight, standalone desktop GUI application designed to crop, correct lighting/exposure, and fit ID cards (Aadhaar, Voter ID, PAN, Driving License, etc.) onto a single A4 page for instant, repeatable printing.

---

## 🚀 What's New in v1.0.0

- **Standalone Single Binary**: Zero-install standalone Linux executable (`id-card-printer`) — no Python or package managers required.
- **Python ZipApp**: Portable, cross-platform single-file executable archive (`id-card-printer.pyz`).
- **Interactive 4-Corner Perspective Crop**: Click and drag corner handles (`TL`, `TR`, `BR`, `BL`) to straighten skewed phone photos and eliminate perspective distortion.
- **Smart 1-Click Auto-Exposure**:
  - Automatically neutralizes yellow/greenish/blue indoor lighting casts.
  - Flat-fields uneven room shadows across paper surfaces.
  - Whitens card paper cleanly to `#FFFFFF` while preserving rich contrast in text, numerals, and QR codes.
  - Tone-maps portrait photos to maintain natural skin tones without blowing out highlights.
- **Single-Page Print Layouts (A4 @ 300 DPI)**:
  - **Document / KYC Copy**: Large, centered Front & Back cards for banking, verification, and official submissions.
  - **Wallet & Lamination (1:1 Scale)**: Exact physical dimensions ($89\text{ mm} \times 57\text{ mm}$) with a central fold line, cutting guidelines, and a $5\text{ cm}$ calibration check ruler.
  - **All-In-One Page**: Combines 1:1 wallet cards (top) and enlarged document copy (bottom) onto a single sheet.
- **Fast Repeatable Workflow**: One-click preview, one-click PDF export, and a "Clear / New Card" button to immediately process the next card.

---

## 📦 Release Assets & Downloads

| Asset | Type | Size | Description |
| :--- | :---: | :---: | :--- |
| [`id-card-printer`](./id-card-printer) | Linux ELF Binary | ~37 MB | **Recommended for Linux**. Standalone executable with bundled runtime and dependencies. |
| [`id-card-printer-v1.0.0-linux-x86_64.tar.gz`](./id-card-printer-v1.0.0-linux-x86_64.tar.gz) | Archive | ~12 MB | Tarball containing the standalone binary and user documentation. |
| [`id-card-printer.pyz`](./id-card-printer.pyz) | Python ZipApp | ~32 KB | Portable single-file Python archive (requires Python 3.8+ with Pillow & NumPy). |
| [`SHA256SUMS.txt`](./SHA256SUMS.txt) | Checksums | 312 B | SHA256 checksums for verifying binary integrity. |

---

## 🔒 Verification Checksums (SHA256)

```text
297bd1d3b0160e1d38744dbf2b6dd4815c26c39c40b72f9374f367cba572763b  id-card-printer
720a5d02c8ff9f183b1e9b8095018002ff6042d50275ec9be6d8a6ea5780b4ff  id-card-printer-v1.0.0-linux-x86_64.tar.gz
e29e3c9c9e47ee9453b2ebb206e7bd7a20efce8f1277a318b0407cde5502d7aa  id-card-printer.pyz
```

Verify your download:
```bash
sha256sum -c SHA256SUMS.txt
```

---

## ⚡ Quick Start

### Method 1: Standalone Binary (No Installation Required)

```bash
# Make executable (if needed)
chmod +x id-card-printer

# Run directly
./id-card-printer
```

### Method 2: Python ZipApp

```bash
python3 id-card-printer.pyz
```

### Method 3: From Source

```bash
git clone <repo-url>
cd id_card_printer
python3 app.py
```

---

## 📖 How to Use

1. **Load Card Photos**:
   - Click **"Browse Image..."** under Front and Back panels (or click **"Quick-Load Sample Aadhaar"** to test).
   - Use **"Rotate 90°"** if the photo was taken vertically.
2. **Adjust Crop & Straighten**:
   - Drag the 4 red corner handles (`TL`, `TR`, `BR`, `BL`) to align with the outer cutting frame of each card.
   - Click **"Auto-Detect"** if you want the app to re-estimate boundaries automatically.
3. **Select Layout**:
   - Choose **Document / KYC Copy**, **Wallet Card 1:1 Scale**, or **All-In-One Page**.
4. **Generate & Export**:
   - Click **"👁 Preview Print Page"** to inspect before exporting.
   - Click **"📄 Export Print-Ready A4 PDF"** to save your 300 DPI single-page PDF.
   - Click **"Clear / New Card"** to repeat for your next ID card.

---

## 🖨️ Printing Instructions for 1:1 Scale

To ensure your printed wallet card matches physical dimensions ($89\text{ mm} \times 57\text{ mm}$):
- In your printer dialog (`Ctrl+P`), set **Paper Size to A4**.
- Set **Scale to 100% / Actual Size** (*DO NOT select "Fit to page" or "Shrink oversized pages"*).
- Measure the **5 cm calibration ruler** on the printout with a physical ruler to verify accuracy.
