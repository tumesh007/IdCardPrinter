# ID Card Print Utility

A lightweight desktop GUI application to crop, fix exposure, and fit ID cards (Aadhaar, Voter ID, PAN, Driving License) onto a single A4 page for printing.

---

## ⚡ Quick Run Options

### Option A: Standalone Binary (Zero Setup Required)
```bash
./release/id-card-printer
```
*(No Python or library installations required — runs directly on Linux x86_64).*

### Option B: Python ZipApp
```bash
python3 release/id-card-printer.pyz
```

### Option C: From Source
```bash
python3 app.py
```
*(Or execute `./run.sh`)*

---

## ✨ Features

- **Interactive 4-Corner Crop**: Drag corner handles (`TL`, `TR`, `BR`, `BL`) to straighten skewed card photos.
- **Auto-Exposure & Lighting Fix**: Neutralizes yellow/dim color casts, removes room shadows, whitens paper to `#FFFFFF`, and darkens text and barcodes while keeping portrait photos natural.
- **Single-Page Print Layouts (A4 @ 300 DPI)**:
  - **Document / KYC Copy**: Large centered Front & Back cards for banking and official submissions.
  - **1:1 Wallet Card**: Exact physical card size ($89\text{ mm} \times 57\text{ mm}$) with center fold line and cut guides.
  - **All-In-One Page**: Both 1:1 wallet cards (top) and enlarged document copy (bottom).
- **Direct & Repeatable**: One click to load, adjust, preview, export PDF, and clear for the next card.

---

## 📦 Release Artifacts

All release assets are located in the [`release/`](./release/) directory:

- **Standalone Binary**: `release/id-card-printer` (Linux 64-bit ELF, ~37 MB)
- **Release Tarball**: `release/id-card-printer-v1.0.0-linux-x86_64.tar.gz` (~12 MB)
- **Python ZipApp**: `release/id-card-printer.pyz` (~32 KB)
- **Checksums**: `release/SHA256SUMS.txt`

See [GITHUB_RELEASE.md](./GITHUB_RELEASE.md) for the complete GitHub release document.
