const icons = new Map<string, string>();

/** Plane silhouette pointing north; Cesium rotates it by the track. */
export function planeIcon(fill: string, stroke = '#082f49'): string {
  const key = `${fill}|${stroke}`;
  let icon = icons.get(key);
  if (!icon) {
    icon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
        `<path fill="${fill}" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round" ` +
        'd="M32 4c2.5 0 4 3 4 7v13l22 13v5l-22-7v15l7 5v4l-11-3-11 3v-4l7-5V35l-22 7v-5l22-13V11c0-4 1.5-7 4-7z"/>' +
        '</svg>',
    )}`;
    icons.set(key, icon);
  }
  return icon;
}
