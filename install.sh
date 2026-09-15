#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_SRC="${SCRIPT_DIR}/release/id-card-printer"
ICON_SRC="${SCRIPT_DIR}/assets/icon.png"

INSTALL_BIN_DIR="${HOME}/.local/bin"
INSTALL_APPS_DIR="${HOME}/.local/share/applications"
INSTALL_ICON_DIR="${HOME}/.local/share/icons/hicolor/256x256/apps"

echo "Installing ID Card Printer..."

mkdir -p "${INSTALL_BIN_DIR}" "${INSTALL_APPS_DIR}" "${INSTALL_ICON_DIR}"

# 1. Install executable
if [ -f "${BIN_SRC}" ]; then
    cp -f "${BIN_SRC}" "${INSTALL_BIN_DIR}/id-card-printer"
    chmod +x "${INSTALL_BIN_DIR}/id-card-printer"
    echo "✔ Binary installed to ${INSTALL_BIN_DIR}/id-card-printer"
else
    echo "Error: Binary not found at ${BIN_SRC}" >&2
    exit 1
fi

# 2. Install icon
if [ -f "${ICON_SRC}" ]; then
    cp -f "${ICON_SRC}" "${INSTALL_ICON_DIR}/id-card-printer.png"
    echo "✔ Icon installed to ${INSTALL_ICON_DIR}/id-card-printer.png"
fi

# 3. Install desktop launcher
cat << EOF > "${INSTALL_APPS_DIR}/id-card-printer.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=ID Card Printer
GenericName=ID Card Print Utility
Comment=Crop, Fix Exposure & Fit ID Cards for A4 Printing
Exec=${INSTALL_BIN_DIR}/id-card-printer
Icon=id-card-printer
Terminal=false
Categories=Graphics;Utility;
StartupNotify=true
Keywords=aadhaar;id;card;printer;crop;exposure;pan;kyc;
EOF

chmod +x "${INSTALL_APPS_DIR}/id-card-printer.desktop"
echo "✔ Desktop shortcut created at ${INSTALL_APPS_DIR}/id-card-printer.desktop"

# 4. Refresh desktop and icon database
update-desktop-database "${INSTALL_APPS_DIR}" 2>/dev/null || true
gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true

echo ""
echo "Installation complete! ID Card Printer is now available in your Applications menu."
