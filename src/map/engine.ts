import {
  ArcGISTiledElevationTerrainProvider,
  BoundingSphere,
  Cartesian3,
  Cartographic,
  ClockStep,
  Color,
  DirectionalLight,
  HeadingPitchRange,
  Math as CesiumMath,
  Matrix4,
  sampleTerrain,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Terrain,
  Transforms,
  Viewer,
} from 'cesium';
import cities from '../data/cities.json';
import { aircraftModel, flightLevel, flightName } from '../lib/aircraft';
import { destination } from '../lib/geo';
import type { City } from '../lib/place';
import { createStore, type Store } from '../lib/store';
import { addBasemap } from './basemap';
import { CockpitController, type CockpitState } from './cockpit';
import { createBuildingsLayer } from './layers/buildings';
import { createEarthquakesLayer } from './layers/earthquakes';
import { createFlightsLayer } from './layers/flights';
import { createSatellitesLayer } from './layers/satellites';
import { createWorldFlightsLayer } from './layers/worldFlights';
import { createTelemetry, type Telemetry } from './telemetry';
import type {
  CityId,
  Destination,
  FlightSource,
  InfoContent,
  LayerId,
  LayerStatus,
  MapLayer,
  VisionMode,
} from './types';
import { createMapStyles, type MapStyleId } from './mapStyles';
import { pickSurface, screenCenter } from './pick';
import { createVisionModes } from './visionModes';

const ELEVATION_URL = 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer';
const IDLE_FRAME_S = 0.1;
const TRAFFIC_INTERVAL_MS = 2_000;
const TRAFFIC_LIST_SIZE = 8;
// Studio light that follows the camera, from the northwest and above, so
// terrain and buildings read well at any hour (east, north, up).
const LIGHT_DIRECTION_ENU = Cartesian3.normalize(new Cartesian3(0.5, -0.45, -0.74), new Cartesian3());

export type FlightKind = FlightSource['kind'];

export interface TrafficItem {
  id: string;
  name: string;
  detail: string;
  level: string;
  distanceKm: number;
  kind: FlightKind;
}

export interface TrafficState {
  radiusKm: number;
  counts: Record<FlightKind, number>;
  items: TrafficItem[];
}

export interface MapState {
  layers: Record<LayerId, LayerStatus>;
  selection: InfoContent | null;
  visionMode: VisionMode;
  mapStyle: MapStyleId;
  visor: boolean;
  telemetry: Telemetry | null;
  cockpit: CockpitState | null;
  traffic: TrafficState | null;
}

export interface MapEngine {
  viewer: Viewer;
  store: Store<MapState>;
  cockpit: CockpitController;
  goTo(destination: Destination): void;
  /** Selects a flight and flies the camera to it. */
  focusFlight(id: string): void;
  /** Boards the selected flight, or the one nearest the screen center. */
  enterCockpit(): boolean;
  setVisionMode(mode: VisionMode): void;
  setMapStyle(style: MapStyleId): void;
  /** Turns the camera to face north, keeping position and tilt. */
  resetNorth(): void;
  /** Toggles between looking straight down and an oblique view. */
  toggleTilt(): void;
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
    layers: {
      flights: pending,
      military: pending,
      world: pending,
      earthquakes: pending,
      satellites: pending,
      buildings: pending,
    },
    selection: null,
    visionMode: 'normal',
    mapStyle: 'satellite',
    visor: true,
    telemetry: null,
    cockpit: null,
    traffic: null,
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
    // Base imagery is managed by mapStyles.
    baseLayer: false,
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
  // Soft glow on bright points and labels, kept subtle so imagery stays crisp.
  const { bloom } = scene.postProcessStages;
  bloom.enabled = true;
  bloom.uniforms.glowOnly = false;
  bloom.uniforms.contrast = 128;
  bloom.uniforms.brightness = -0.62;
  bloom.uniforms.delta = 0.9;
  bloom.uniforms.sigma = 1.6;
  bloom.uniforms.stepSize = 1;
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

  let placeNames: City[] = [];
  addBasemap(scene)
    .then((list) => (placeNames = list))
    .catch((error) => console.warn('basemap unavailable:', error));

  const reportStatus = (id: LayerId) => (status: LayerStatus) =>
    store.set((state) => ({
      layers: {
        ...state.layers,
        [id]: { ...status, updatedAt: status.error ? state.layers[id].updatedAt : Date.now() },
      },
    }));

  const flights = createFlightsLayer(
    viewer,
    {
      id: 'flights',
      endpoint: '/api/flights',
      idPrefix: 'flight-',
      color: '#7dd3fc',
      label: 'Voo ao vivo',
      refreshMs: 45_000,
    },
    reportStatus('flights'),
  );
  const military = createFlightsLayer(
    viewer,
    {
      id: 'military',
      endpoint: '/api/military',
      idPrefix: 'mil-',
      color: '#fb7185',
      label: 'Voo militar',
      refreshMs: 120_000,
    },
    reportStatus('military'),
  );
  // The worldwide layer skips aircraft the richer layers already show.
  const world = createWorldFlightsLayer(
    viewer,
    (icao) => Boolean(flights.get(`flight-${icao}`) ?? military.get(`mil-${icao}`)),
    reportStatus('world'),
  );
  const satellites = createSatellitesLayer(viewer, reportStatus('satellites'));
  const buildings = createBuildingsLayer(viewer, terrainReady, reportStatus('buildings'));
  const flightSources = [flights, military, world];
  const layers: MapLayer[] = [
    ...flightSources,
    createEarthquakesLayer(viewer, reportStatus('earthquakes')),
    satellites,
    buildings,
  ];
  const hiddenLayers = new Set<LayerId>();

  const cockpit = new CockpitController(viewer, flightSources, (state) => {
    store.set({ cockpit: state });
    satellites.setLabelsVisible(state === null);
  });
  // Render continuously only while the camera rides something that moves
  // (the cockpit toggles this itself).
  const removeTrackingListener = viewer.trackedEntityChanged.addEventListener(() => {
    scene.requestRenderMode = !cockpit.active && !viewer.trackedEntity;
  });
  const visionModes = createVisionModes(viewer);
  const telemetry = createTelemetry(
    viewer,
    () => placeNames,
    (value) => store.set({ telemetry: value }),
  );
  telemetry.setEnabled(true);
  const mapStyles = createMapStyles(viewer, (photoreal) => {
    // Google's tiles already have real buildings everywhere.
    buildings.setVisible(!photoreal && !hiddenLayers.has('buildings'));
  });

  // --- Selection -----------------------------------------------------------
  // Entities are selected by Cesium's own picking; clicks on plain primitives
  // are routed here by id.
  let selectedId: string | null = null;

  function refreshSelection() {
    const id = selectedId;
    const layer = id ? layers.find((l) => id.startsWith(l.idPrefix)) : undefined;
    store.set({ selection: id && layer ? layer.describe(id) : null });
  }

  function select(id: string | null) {
    selectedId = id;
    refreshSelection();
  }

  const removeSelectionListener = viewer.selectedEntityChanged.addEventListener((entity) =>
    select(entity?.id ?? null),
  );
  const clickHandler = new ScreenSpaceEventHandler(scene.canvas);
  // Primitives (worldwide flights, satellites) carry a plain string id.
  clickHandler.setInputAction((click: ScreenSpaceEventHandler.PositionedEvent) => {
    const id = scene.pick(click.position)?.id;
    if (typeof id === 'string' && layers.some((layer) => id.startsWith(layer.idPrefix))) select(id);
  }, ScreenSpaceEventType.LEFT_CLICK);
  const selectionTimer = window.setInterval(refreshSelection, 1000);

  // --- Nearby traffic --------------------------------------------------------

  const viewCenter = () => pickSurface(scene, screenCenter(scene));

  function refreshTraffic() {
    if (cockpit.active) return;
    const center = viewCenter();
    if (!center) {
      store.set({ traffic: null });
      return;
    }
    // The search radius grows with altitude, so the list stays meaningful
    // from street level up to a whole-country view.
    const radius = CesiumMath.clamp(camera.positionCartographic.height * 0.25, 100_000, 1_500_000);
    const time = viewer.clock.currentTime;
    const counts: Record<FlightKind, number> = { flight: 0, military: 0, world: 0 };
    const near: Array<{ id: string; source: FlightSource; distance: number }> = [];

    for (const source of flightSources) {
      if (hiddenLayers.has(source.id)) continue;
      for (const id of source.airborne()) {
        const position = source.positionAt(id, time);
        if (!position) continue;
        const distance = Cartesian3.distance(center, position);
        if (distance > radius) continue;
        counts[source.kind]++;
        near.push({ id, source, distance });
      }
    }

    near.sort((a, b) => a.distance - b.distance);
    store.set({
      traffic: {
        radiusKm: Math.round(radius / 1000),
        counts,
        items: near.slice(0, TRAFFIC_LIST_SIZE).flatMap(({ id, source, distance }) => {
          const flight = source.get(id);
          if (!flight) return [];
          return [
            {
              id,
              name: flightName(flight),
              detail: aircraftModel(flight) || flight.originCountry || '',
              level: flightLevel(flight),
              distanceKm: distance / 1000,
              kind: source.kind,
            },
          ];
        }),
      },
    });
  }

  const trafficTimer = window.setInterval(refreshTraffic, TRAFFIC_INTERVAL_MS);
  const removeMoveListener = camera.moveEnd.addEventListener(refreshTraffic);

  // --- Camera ----------------------------------------------------------------

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
    focusFlight(id) {
      const source = flightSources.find((s) => id.startsWith(s.idPrefix));
      const position = source?.positionAt(id, viewer.clock.currentTime);
      if (!position) return;
      viewer.trackedEntity = undefined;
      viewer.selectedEntity = undefined;
      select(id);
      camera.flyToBoundingSphere(new BoundingSphere(position, 0), {
        offset: new HeadingPitchRange(0, CesiumMath.toRadians(-35), 25_000),
        duration: 2,
      });
    },
    enterCockpit() {
      return cockpit.enterNearest(selectedId);
    },
    setVisionMode(mode) {
      visionModes.apply(mode);
      store.set({ visionMode: mode });
    },
    setMapStyle(style) {
      store.set({ mapStyle: style });
      mapStyles.apply(style).catch((error) => {
        console.warn('map style unavailable, back to satellite:', error);
        store.set({ mapStyle: 'satellite' });
        void mapStyles.apply('satellite');
      });
    },
    resetNorth() {
      viewer.trackedEntity = undefined;
      camera.flyTo({
        destination: camera.positionWC.clone(),
        orientation: { heading: 0, pitch: camera.pitch, roll: 0 },
        duration: 1,
      });
    },
    toggleTilt() {
      viewer.trackedEntity = undefined;
      const center = viewCenter();
      const straightDown = camera.pitch < CesiumMath.toRadians(-80);
      if (!center) return;
      const range = Cartesian3.distance(camera.positionWC, center);
      camera.flyToBoundingSphere(new BoundingSphere(center, 0), {
        offset: new HeadingPitchRange(camera.heading, CesiumMath.toRadians(straightDown ? -35 : -90), range),
        duration: 1.2,
      });
    },
    setVisor(on) {
      telemetry.setEnabled(on);
      store.set({ visor: on });
    },
    setLayerVisible(id, visible) {
      const layer = layers.find((l) => l.id === id);
      if (!layer) return;
      layer.setVisible(visible);
      if (visible) hiddenLayers.delete(id);
      else hiddenLayers.add(id);
      if (visible) return;
      if (selectedId?.startsWith(layer.idPrefix)) {
        viewer.selectedEntity = undefined;
        select(null);
      }
      if (cockpit.active && flightSources.some((source) => source.id === id)) cockpit.exit();
      refreshTraffic();
    },
    clearSelection() {
      viewer.selectedEntity = undefined;
      select(null);
    },
    destroy() {
      window.clearInterval(selectionTimer);
      window.clearInterval(trafficTimer);
      clickHandler.destroy();
      removeSelectionListener();
      removeMoveListener();
      removeLightListener();
      removeTrackingListener();
      telemetry.destroy();
      cockpit.destroy();
      layers.forEach((layer) => layer.destroy());
      viewer.destroy();
    },
  };
}
