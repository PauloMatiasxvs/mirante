import { Cartesian2, type Cartesian3, type Scene } from 'cesium';

/**
 * The surface point under a screen position. Uses the globe when it's shown,
 * and the depth buffer otherwise (photorealistic 3D tiles hide the globe).
 */
export function pickSurface(scene: Scene, position: Cartesian2): Cartesian3 | undefined {
  if (!scene.globe.show) {
    return scene.pickPositionSupported ? scene.pickPosition(position) : undefined;
  }
  const ray = scene.camera.getPickRay(position);
  return (ray && scene.globe.pick(ray, scene)) ?? undefined;
}

export const screenCenter = (scene: Scene) =>
  new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
