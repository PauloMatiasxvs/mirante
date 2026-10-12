import {
  ArcGISTiledElevationTerrainProvider,
  Cartesian3,
  Cartographic,
  ClockStep,
  Color,
  Credit,
  DirectionalLight,
  ImageryLayer,
  Math as CesiumMath,
  Matrix4,
  sampleTerrain,
  Terrain,
  Transforms,
  UrlTemplateImageryProvider,
  Viewer,
} from 'cesium';
import cities from '../data/cities.json';
import { destination } from '../lib/geo';
import { createStore, type Store } from '../lib/store';
import { addBasemap } from './basemap';
import { CockpitController, type CockpitState } from './cockpit';
import { createBuildingsLayer } from './layers/buildings';
import { createEarthquakesLayer } from './layers/earthquakes';
import { createFlightsLayer } from './layers/flights';
import { createSatellitesLayer } from './layers/satellites';
import { createTelemetry, type Telemetry } from './telemetry';
import type { CityId, Destination, InfoContent, LayerId, LayerStatus, MapLayer, VisionMode } from './types';
import { createVisionModes } from './visionModes';

const IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ELEVATION_URL = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer';
const IDLE_FRAME_S = 0.1;
// Studio light that follows the camera, from the northwest and above, so
// terrain and buildings read well at any hour (east, north, up).
const LIGHT_DIRECTION_ENU = Cartesian3.normalize(new Cartesian3(0.5, -0.45, -0.74), new Cartesian3());

export interface MapState {
  layers: Record<LayerId, LayerStatus>;
  selection: InfoContent | null;
  visionMode: VisionMode;
  visor: boolean;
  telemetry: Telemetry | null;
  cockpit: CockpitState | null;
}

export interface MapEngine {
  viewer: Viewer;
  store: Store<MapState>;
  cockpit: CockpitController;
  goTo(destination: Destination): void;
  setVisionMode(mode: VisionMode): void;
  setVisor(on: boolean): void;
  setLayerVisible(id: LayerId, visible: boolean): void;
  clearSelection(): void;
  destroy(): void;
}

const pending: LayerStatus = { count: null, error: false };

export function createMapEngine({
  container,
  creditContainer,
}: {
  container: HTMLElement;
  creditContainer: HTMLElement;
}): MapEngine {
  const store = createStore<MapState>({
    layers: { flights: pending, earthquakes: pending, satellites: pending, buildings: pending },
    selection: null,
    visionMode: 'normal',
    visor: true,
    telemetry: null,
    cockpit: null,
  });

  const terrain = new Terrain(ArcGISTiledElevationTerrainProvider.fromUrl(ELEVATION_URL));
  const terrainReady = new Promise<void>((resolve) => {
    terrain.readyEvent.addEventListener(() => resolve());
    terrain.errorEvent.addEventListener((error) => {
      console.warn('terrain unavailable, continuing without it:', error);
      resolve();
    });
  });

  const viewer = new Viewer(container, {
    baseLayer: new ImageryLayer(
      new UrlTemplateImageryProvider({
        url: IMAGERY_URL,
        maximumLevel: 19,
        credit: new Credit('Imagens © Esri, Maxar, Earthstar Geographics'),
      }),
    ),
    terrain,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    creditContainer,
    // Only redraw when something changes; the live clock still advances
    // moving objects every IDLE_FRAME_S.
    requestRenderMode: true,
    maximumRenderTimeChange: IDLE_FRAME_S,
  });

  const { scene, camera } = viewer;
  scene.globe.baseColor = Color.fromCssColorString('#0b1422');
  scene.globe.showGroundAtmosphere = true;
  scene.globe.depthTestAgainstTerrain = true;
  scene.globe.enableLighting = true;
  // Slightly coarser tiles than the default (2): far fewer requests, barely visible.
  scene.globe.maximumScreenSpaceError = 2.5;
  scene.globe.tileCacheSize = 300;
  scene.postProcessStages.fxaa.enabled = true;
  // The scene clock follows real time so planes and satellites move live.
  viewer.clock.clockStep = ClockStep.SYSTEM_CLOCK;
  viewer.clock.shouldAnimate = true;
  camera.setView({ destination: Cartesian3.fromDegrees(-52, -15, 7_500_000) });

  const light = new DirectionalLight({ direction: Cartesian3.UNIT_Z, intensity: 2.2 });
  scene.light = light;
  const enu = new Matrix4();
  const removeLightListener = scene.preRender.addEventListener(() => {
    Transforms.eastNorthUpToFixedFrame(camera.positionWC, undefined, enu);
    Matrix4.multiplyByPointAsVector(enu, LIGHT_DIRECTION_ENU, light.direction);
    Cartesian3.normalize(light.direction, light.direction);
  });

  // Cesium's own UI strings, in Portuguese.
  const expandLink = creditContainer.querySelector('.cesium-credit-expand-link');
  if (expandLink) expandLink.textContent = 'Créditos';
  const lightboxTitle = document.querySelector('.cesium-credit-lightbox-title');
  if (lightboxTitle) lightboxTitle.textContent = 'Dados fornecidos por:';

  void addBasemap(scene).catch((error) => console.warn('basemap unavailable:', error));

  const reportStatus = (id: LayerId) => (status: LayerStatus) =>
    store.set((state) => ({ layers: { ...state.layers, [id]: status } }));

  const flights = createFlightsLayer(viewer, reportStatus('flights'));
  const satellites = createSatellitesLayer(viewer, reportStatus('satellites'));
  const buildings = createBuildingsLayer(viewer, terrainReady, reportStatus('buildings'));
  const layers: MapLayer[] = [
    flights,
    createEarthquakesLayer(viewer, reportStatus('earthquakes')),
    satellites,
    buildings,
  ];

  const cockpit = new CockpitController(viewer, flights, (state) => store.set({ cockpit: state }));
  // Render continuously only while the camera rides something that moves
  // (the cockpit toggles this itself).
  const removeTrackingListener = viewer.trackedEntityChanged.addEventListener(() => {
    scene.requestRenderMode = !cockpit.active && !viewer.trackedEntity;
  });
  const visionModes = createVisionModes(viewer);
  const telemetry = createTelemetry(viewer, (value) => store.set({ telemetry: value }));
  telemetry.setEnabled(true);

  function refreshSelection() {
    const entity = viewer.selectedEntity;
    const layer = entity && layers.find((l) => entity.id.startsWith(l.entityPrefix));
    store.set({ selection: (entity && layer?.describe(entity)) ?? null });
  }
  const removeSelectionListener = viewer.selectedEntityChanged.addEventListener(refreshSelection);
  const selectionTimer = window.setInterval(refreshSelection, 1000);

  function flyOver(lon: number, lat: number, height: number) {
    viewer.trackedEntity = undefined;
    camera.flyTo({ destination: Cartesian3.fromDegrees(lon, lat, height), duration: 2.5 });
  }

  // Low, oblique flight that looks at the city's landmark.
  async function flyToCity(id: CityId) {
    const { target, view } = cities[id];
    viewer.trackedEntity = undefined;
    void buildings.load(id).catch(() => {});

    await terrainReady;
    const [sample] = await sampleTerrain(scene.terrainProvider, 12, [
      Cartographic.fromDegrees(target.lon, target.lat),
    ]).catch(() => [new Cartographic()]);
    const ground = Number.isFinite(sample?.height) ? sample.height : 0;

    const setback = view.height / Math.tan(CesiumMath.toRadians(-view.pitch));
    const eye = destination(target, (view.heading + 180) % 360, setback);
    camera.flyTo({
      destination: Cartesian3.fromDegrees(eye.lon, eye.lat, ground + view.height),
      orientation: {
        heading: CesiumMath.toRadians(view.heading),
        pitch: CesiumMath.toRadians(view.pitch),
        roll: 0,
      },
      duration: 3,
    });
  }

  return {
    viewer,
    store,
    cockpit,
    goTo(dest) {
      cockpit.exit();
      if (dest === 'brazil') flyOver(-52, -15, 7_500_000);
      else if (dest === 'planet') flyOver(-35, -5, 22_000_000);
      else if (dest === 'iss') satellites.followIss();
      else void flyToCity(dest);
    },
    setVisionMode(mode) {
      visionModes.apply(mode);
      store.set({ visionMode: mode });
    },
    setVisor(on) {
      telemetry.setEnabled(on);
      store.set({ visor: on });
    },
    setLayerVisible(id, visible) {
      const layer = layers.find((l) => l.id === id);
      layer?.setVisible(visible);
      if (!visible && layer && viewer.selectedEntity?.id.startsWith(layer.entityPrefix)) {
        viewer.selectedEntity = undefined;
      }
      if (!visible && id === 'flights') cockpit.exit();
    },
    clearSelection() {
      viewer.selectedEntity = undefined;
    },
    destroy() {
      window.clearInterval(selectionTimer);
      removeSelectionListener();
      removeLightListener();
      removeTrackingListener();
      telemetry.destroy();
      cockpit.destroy();
      layers.forEach((layer) => layer.destroy());
      viewer.destroy();
    },
  };
}
