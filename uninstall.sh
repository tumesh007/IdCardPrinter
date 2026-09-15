#!/usr/bin/env bash
set -e

echo "Uninstalling ID Card Printer..."

rm -f "${HOME}/.local/bin/id-card-printer"
rm -f "${HOME}/.local/share/applications/id-card-printer.desktop"
rm -f "${HOME}/.local/share/icons/hicolor/256x256/apps/id-card-printer.png"

update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true
gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true

echo "Uninstallation complete. ID Card Printer removed from Applications menu."
