import { Cartesian3, Cartographic, Math as CesiumMath, PerspectiveFrustum, type Viewer } from 'cesium';
import { sunElevation } from '../lib/geo';
import { altitudeBand, formatMgrs, nearestCity, regionName, type City } from '../lib/place';
import { pickSurface, screenCenter } from './pick';

export interface Telemetry {
  heading: number;
  pitch: number;
  cameraHeight: number;
  band: string;
  /** Everything below describes the point under the reticle, when it hits the globe. */
  target: {
    lat: number;
    lon: number;
    mgrs: string;
    region: string;
    nearby: { name: string; distanceKm: number } | null;
    ground: number;
    distance: number;
    metersPerPixel: number;
    sunElevation: number;
  } | null;
}

const INTERVAL_MS = 200;

/** Samples what the camera is looking at, ~5 times per second, while enabled. */
export function createTelemetry(
  viewer: Viewer,
  cities: () => City[],
  onChange: (telemetry: Telemetry | null) => void,
) {
  let enabled = false;
  let last = 0;

  const remove = viewer.scene.postRender.addEventListener(() => {
    const now = performance.now();
    if (!enabled || now - last < INTERVAL_MS) return;
    last = now;

    const { camera, canvas } = viewer.scene;
    const point = pickSurface(viewer.scene, screenCenter(viewer.scene));

    let target: Telemetry['target'] = null;
    if (point) {
      const geo = Cartographic.fromCartesian(point);
      const lat = CesiumMath.toDegrees(geo.latitude);
      const lon = CesiumMath.toDegrees(geo.longitude);
      const distance = Cartesian3.distance(camera.positionWC, point);
      const fov = camera.frustum instanceof PerspectiveFrustum ? (camera.frustum.fov ?? 1) : 1;
      target = {
        lat,
        lon,
        mgrs: formatMgrs(lat, lon),
        region: regionName(lat, lon),
        nearby: nearestCity(lat, lon, cities()),
        ground: geo.height,
        distance,
        metersPerPixel: (2 * distance * Math.tan(fov / 2)) / Math.max(canvas.clientWidth, canvas.clientHeight),
        sunElevation: sunElevation(new Date(), lat, lon),
      };
    }

    const height = camera.positionCartographic.height;
    onChange({
      heading: CesiumMath.toDegrees(camera.heading),
      pitch: CesiumMath.toDegrees(camera.pitch),
      cameraHeight: height,
      band: altitudeBand(height),
      target,
    });
  });

  return {
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) onChange(null);
    },
    destroy: remove,
  };
}
