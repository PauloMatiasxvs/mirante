import {
  ArcType,
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  DistanceDisplayCondition,
  JulianDate,
  LabelStyle,
  LagrangePolynomialApproximation,
  PolylineGlowMaterialProperty,
  SampledPositionProperty,
  type Viewer,
} from 'cesium';
import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
  type SatRec,
} from 'satellite.js';
import { formatInt, formatLatLon } from '../../lib/format';
import { parseTle } from '../../lib/tle';
import type { InfoContent, LayerStatus, MapLayer } from '../types';

const GROUPS = ['stations', 'visual'];
// CelesTrak asks clients not to re-download the same data more than every 2 h.
const TLE_CACHE_MS = 2 * 60 * 60_000;
const SAMPLE_STEP_S = 20;
const RESAMPLE_MS = 60_000;
const DOCKED_DISTANCE_M = 50_000;
const ISS = 25544;
const PREFIX = 'sat-';

const STATIONS: Record<number, { label: string; name: string; color: string }> = {
  25544: { label: 'ISS', name: 'Estação Espacial Internacional', color: '#f0abfc' },
  48274: { label: 'TIANGONG', name: 'Estação Espacial Chinesa (Tiangong)', color: '#fda4af' },
};

interface Satellite {
  name: string;
  norad: number;
  satrec: SatRec;
}

interface Fix {
  lat: number;
  lon: number;
  heightKm: number;
  speedKms: number;
}

export interface SatellitesLayer extends MapLayer {
  followIss(): boolean;
}

async function fetchGroup(group: string): Promise<string> {
  const key = `mirante:tle:${group}`;
  try {
    const cached = JSON.parse(localStorage.getItem(key) ?? 'null') as { at: number; text: string } | null;
    if (cached && Date.now() - cached.at < TLE_CACHE_MS) return cached.text;
  } catch {
    // Storage blocked or corrupt: just fetch again.
  }
  const response = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`);
  const text = await response.text();
  if (!response.ok || !text.includes('\n1 ')) throw new Error(`CelesTrak: ${group}`);
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), text }));
  } catch {
    // Cache is a courtesy to CelesTrak, not a requirement.
  }
  return text;
}

function fixAt(satrec: SatRec, date: Date): Fix | null {
  const state = propagate(satrec, date);
  if (!state || !state.position || typeof state.position !== 'object' || !state.velocity) return null;
  const geo = eciToGeodetic(state.position, gstime(date));
  const { x, y, z } = state.velocity as { x: number; y: number; z: number };
  return {
    lat: degreesLat(geo.latitude),
    lon: degreesLong(geo.longitude),
    heightKm: geo.height,
    speedKms: Math.hypot(x, y, z),
  };
}

const toCartesian = (fix: Fix) => Cartesian3.fromDegrees(fix.lon, fix.lat, fix.heightKm * 1000);

export function createSatellitesLayer(viewer: Viewer, onStatus: (status: LayerStatus) => void): SatellitesLayer {
  const dataSource = new CustomDataSource('satellites');
  void viewer.dataSources.add(dataSource);
  const satellites = new Map<string, Satellite>();
  let timer: number | undefined;
  let destroyed = false;

  function addEntity(id: string, satellite: Satellite) {
    const station = STATIONS[satellite.norad];
    const color = Color.fromCssColorString(station?.color ?? '#c4b5fd');
    dataSource.entities.add({
      id,
      position: new SampledPositionProperty(),
      viewFrom: new Cartesian3(0, -1_800_000, 1_100_000),
      point: {
        pixelSize: station ? 12 : 5,
        color,
        outlineColor: Color.BLACK.withAlpha(0.6),
        outlineWidth: station ? 2 : 1,
      },
      label: {
        text: station?.label ?? satellite.name,
        font: station ? '700 13px "JetBrains Mono", monospace' : '11px "JetBrains Mono", monospace',
        fillColor: color,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -16),
        distanceDisplayCondition: station ? undefined : new DistanceDisplayCondition(0, 4_000_000),
      },
    });
  }

  // Docked vehicles (Soyuz, Progress, Dragon...) share the station's position
  // and only add overlapping labels.
  function isDocked(satellite: Satellite, stations: Cartesian3[], date: Date) {
    if (STATIONS[satellite.norad]) return false;
    const fix = fixAt(satellite.satrec, date);
    return fix !== null && stations.some((s) => Cartesian3.distance(s, toCartesian(fix)) < DOCKED_DISTANCE_M);
  }

  // A few minutes of orbit ahead; Cesium interpolates between samples.
  function resample() {
    const now = Date.now();
    const stations = [...satellites.values()]
      .filter((s) => STATIONS[s.norad])
      .map((s) => fixAt(s.satrec, new Date(now)))
      .filter((fix): fix is Fix => fix !== null)
      .map(toCartesian);

    for (const [id, satellite] of satellites) {
      const entity = dataSource.entities.getById(id);
      if (!entity) continue;
      if (isDocked(satellite, stations, new Date(now))) {
        entity.show = false;
        continue;
      }
      const position = new SampledPositionProperty();
      position.setInterpolationOptions({
        interpolationDegree: 3,
        interpolationAlgorithm: LagrangePolynomialApproximation,
      });
      let samples = 0;
      for (let s = -60; s <= 180; s += SAMPLE_STEP_S) {
        const date = new Date(now + s * 1000);
        const fix = fixAt(satellite.satrec, date);
        if (!fix) continue;
        position.addSample(JulianDate.fromDate(date), toCartesian(fix));
        samples++;
      }
      entity.show = samples >= 4;
      if (entity.show) entity.position = position;
    }
    drawIssOrbit(now);
  }

  // The ISS's next full lap around the Earth (~93 min).
  function drawIssOrbit(now: number) {
    const iss = satellites.get(PREFIX + ISS);
    if (!iss) return;
    const points: Cartesian3[] = [];
    for (let s = 0; s <= 93 * 60; s += 30) {
      const fix = fixAt(iss.satrec, new Date(now + s * 1000));
      if (fix) points.push(toCartesian(fix));
    }
    dataSource.entities.removeById('iss-orbit');
    dataSource.entities.add({
      id: 'iss-orbit',
      polyline: {
        positions: points,
        width: 3,
        arcType: ArcType.NONE,
        material: new PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Color.fromCssColorString('#f0abfc').withAlpha(0.8),
        }),
      },
    });
  }

  async function load() {
    try {
      const results = await Promise.allSettled(GROUPS.map(fetchGroup));
      if (destroyed) return;
      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        for (const tle of parseTle(result.value)) {
          const id = PREFIX + tle.norad;
          if (satellites.has(id)) continue;
          const satellite = { name: tle.name, norad: tle.norad, satrec: twoline2satrec(tle.line1, tle.line2) };
          satellites.set(id, satellite);
          addEntity(id, satellite);
        }
      }
      if (!satellites.size) throw new Error('no satellites loaded');
      resample();
      timer = window.setInterval(resample, RESAMPLE_MS);
      onStatus({ count: satellites.size, error: false });
    } catch (error) {
      console.warn('satellites unavailable:', error);
      onStatus({ count: null, error: true });
    }
  }

  void load();

  return {
    id: 'satellites',
    idPrefix: PREFIX,
    setVisible(visible) {
      dataSource.show = visible;
    },
    followIss() {
      const iss = dataSource.entities.getById(PREFIX + ISS);
      if (!iss) return false;
      viewer.trackedEntity = iss;
      viewer.selectedEntity = iss;
      return true;
    },
    describe(id: string): InfoContent | null {
      const satellite = satellites.get(id);
      const fix = satellite && fixAt(satellite.satrec, new Date());
      if (!satellite || !fix) return null;
      const station = STATIONS[satellite.norad];
      return {
        kind: station ? 'Estação espacial' : 'Satélite',
        title: station?.name ?? satellite.name,
        rows: [
          ['Altitude', `${formatInt(fix.heightKm)} km`],
          ['Velocidade', `${formatInt(fix.speedKms * 3600)} km/h`],
          ['Sobre', formatLatLon(fix.lat, fix.lon)],
          ['Catálogo NORAD', String(satellite.norad)],
        ],
        link: {
          url: `https://celestrak.org/satcat/records.php?CATNR=${satellite.norad}`,
          label: 'Ficha no CelesTrak ↗',
        },
      };
    },
    destroy() {
      destroyed = true;
      window.clearInterval(timer);
      viewer.dataSources.remove(dataSource, true);
    },
  };
}
