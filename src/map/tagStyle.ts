import { Cartesian2, Color, HorizontalOrigin, LabelStyle, NearFarScalar, VerticalOrigin } from 'cesium';

const BACKGROUND = Color.fromCssColorString('#050b14').withAlpha(0.78);

/**
 * Small boxed tag used for every object label on the globe (planes,
 * satellites, quakes): dark plate, mono type, fading out with distance.
 */
export function tagStyle(color: string, { offsetY = -20, fadeFrom = 2e5, fadeTo = 6e6 } = {}) {
  return {
    font: '600 10.5px "JetBrains Mono", monospace',
    fillColor: Color.fromCssColorString(color),
    style: LabelStyle.FILL,
    showBackground: true,
    backgroundColor: BACKGROUND,
    backgroundPadding: new Cartesian2(5, 3),
    horizontalOrigin: HorizontalOrigin.LEFT,
    verticalOrigin: VerticalOrigin.BOTTOM,
    pixelOffset: new Cartesian2(10, offsetY),
    translucencyByDistance: new NearFarScalar(fadeFrom, 1, fadeTo, 0.35),
  };
}
