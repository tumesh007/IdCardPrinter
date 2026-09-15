# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-15

### Added
- **Interactive GUI**: Dual-panel canvas with 4 draggable corner handles (`TL`, `TR`, `BR`, `BL`) for Front and Back card images.
- **Perspective Rectification**: True 4-point quadrilateral homography using PIL BICUBIC interpolation.
- **Lighting & Exposure Engine**:
  - Auto-white balance with gray/paper cast neutralization.
  - Low-frequency flat-field illumination estimation to remove shadows and vignetting.
  - S-curve tone mapping ensuring `#FFFFFF` background without washing out portraits.
  - Anti-halo edge preservation.
- **Print Layout Engine**:
  - `document`: Standard A4 KYC copy with Front and Back centered vertically.
  - `wallet`: Exact 1:1 physical card scale ($89\text{ mm} \times 57\text{ mm}$) with fold line and cutting guide.
  - `all_in_one`: Combined single-page layout featuring 1:1 wallet cards (top) and document copy (bottom).
  - 300 DPI high-resolution PDF and PNG generation.
- **Packaging & Distribution**:
  - Single standalone Linux executable (`id-card-printer`) built via PyInstaller.
  - Portable Python ZipApp (`id-card-printer.pyz`).
  - GitHub Release documentation and SHA256 verification checksums.
