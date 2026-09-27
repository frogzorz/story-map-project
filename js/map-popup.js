export function popupOptions(width, height) {
  return {
    maxWidth: Math.max(80, Math.min(300, width - 110)),
    maxHeight: Math.max(24, Math.min(320, height - 126)),
    autoPanPaddingTopLeft: [50, 8],
    autoPanPaddingBottomRight: [8, 36],
  };
}
