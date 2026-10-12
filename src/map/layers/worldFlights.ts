import {
  BillboardCollection,
  Cartesian3,
  JulianDate,
  LabelCollection,
  Math as CesiumMath,
  NearFarScalar,
  type Billboard,
  type Viewer,
} from 'cesium';
import type { WorldResponse, WorldFlightRow } from '../../../api/world';
import { FEET_TO_METERS, flightLevel, flightName, KNOTS_TO_MPS, type Flight } from '../../lib/aircraft';
import { countryInPortuguese } from '../../lib/country';
import { formatInt } from '../../lib/format';
import { destination } from '../../lib/geo';
import { planeIcon } from '../planeIcon';
import { tagStyle } from '../tagStyle';
import type { FlightSource, InfoContent, LayerStatus, MapLayer } from '../types';
import { describeVertical } from './flights';

// The server refreshes its OpenSky snapshot every 15 min; polling more often
// just picks a new snapshot up sooner, at no extra upstream cost.
const REFRESH_MS = 5 * 60_000;
const MOVE_INTERVAL_MS = 2_000;
const MAX_DEAD_RECKONING_S = 20 * 60;
const LABEL_RANGE_M = 400_000;
const MAX_LABELS = 40;
const PREFIX = 'world-';
const COLOR = '#e2e8f0';

interface Entry {
  flight: Flight;
  billboard: Billboard;
}

function toFlight([icao, callsign, country, lat, lon, altitudeFt, speedKt, track, verticalRateFpm]: WorldFlightRow): Flight {
  return {
    id: icao,
    callsign: callsign || null,
    registration: null,
    type: null,
    lat,
    lon,
    onGround: false,
    altitudeFt,
    speedKt,
    track,
    verticalRateFpm,
    squawk: null,
    seenSeconds: 0,
    originCountry: countryInPortuguese(country),
  };
}

/**
 * Every aircraft OpenSky sees worldwide, drawn as plain billboards (thousands
 * of entities would be far too slow). Planes already shown by a richer layer
 * (Brazil or military) are skipped via `shownElsewhere`.
 */
export function createWorldFlightsLayer(
  viewer: Viewer,
  shownElsewhere: (icao: string) => boolean,
  onStatus: (status: LayerStatus) => void,
): MapLayer & FlightSource {
  const { scene } = viewer;
  const billboards = scene.primitives.add(new BillboardCollection({ scene })) as BillboardCollection;
  const labels = scene.primitives.add(new LabelCollection()) as LabelCollection;
  const entries = new Map<string, Entry>();
  const hidden = new Set<string>();
  const abort = new AbortController();
  const icon = planeIcon(COLOR, '#0f172a');
  const tag = tagStyle(COLOR, { offsetY: -6, fadeFrom: 5e4, fadeTo: 4e5 });
  let snapshotTime = Date.now();

  function positionAt(flight: Flight, ms: number): Cartesian3 {
    const height = Math.max(30, (flight.altitudeFt ?? 0) * FEET_TO_METERS);
    const elapsed = Math.min(Math.max(0, (ms - snapshotTime) / 1000), MAX_DEAD_RECKONING_S);
    if (!flight.speedKt || flight.track == null || elapsed === 0) {
      return Cartesian3.fromDegrees(flight.lon, flight.lat, height);
    }
    const ahead = destination(flight, flight.track, flight.speedKt * KNOTS_TO_MPS * elapsed);
    return Cartesian3.fromDegrees(ahead.lon, ahead.lat, height);
  }

  const isVisible = (id: string, entry: Entry) => !hidden.has(id) && !shownElsewhere(entry.flight.id);

  // Dead-reckons every plane and labels only the ones near the camera.
  function move() {
    const now = Date.now();
    const camera = viewer.camera.positionWC;
    const near: Array<{ distance: number; entry: Entry; position: Cartesian3 }> = [];

    for (const [id, entry] of entries) {
      const show = isVisible(id, entry);
      entry.billboard.show = show;
      if (!show) continue;
      const position = positionAt(entry.flight, now);
      entry.billboard.position = position;
      const distance = Cartesian3.distance(camera, position);
      if (distance < LABEL_RANGE_M) near.push({ distance, entry, position });
    }

    labels.removeAll();
    near
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_LABELS)
      .forEach(({ entry, position }) =>
        labels.add({
          ...tag,
          position,
          text: `${flightName(entry.flight)} · ${flightLevel(entry.flight)}`,
        }),
      );
    scene.requestRender();
  }

  function sync({ positionTime, flights }: WorldResponse) {
    snapshotTime = positionTime;
    const seen = new Set<string>();
    for (const row of flights) {
      const id = PREFIX + row[0];
      const flight = toFlight(row);
      const rotation = -CesiumMath.toRadians(flight.track ?? 0);
      seen.add(id);

      const existing = entries.get(id);
      if (existing) {
        existing.flight = flight;
        existing.billboard.rotation = rotation;
        continue;
      }
      entries.set(id, {
        flight,
        billboard: billboards.add({
          id,
          image: icon,
          position: positionAt(flight, Date.now()),
          rotation,
          alignedAxis: Cartesian3.UNIT_Z,
          scale: 0.42,
          scaleByDistance: new NearFarScalar(5e4, 1, 1.5e7, 0.4),
        }),
      });
    }
    for (const [id, entry] of entries) {
      if (seen.has(id)) continue;
      billboards.remove(entry.billboard);
      entries.delete(id);
    }
    move();
  }

  async function refresh() {
    try {
      const response = await fetch('/api/world', { signal: abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sync((await response.json()) as WorldResponse);
      onStatus({ count: entries.size, error: false });
    } catch (error) {
      if (abort.signal.aborted) return;
      console.warn('world flights unavailable:', error);
      onStatus({ count: entries.size || null, error: true });
    }
  }

  void refresh();
  const refreshTimer = window.setInterval(refresh, REFRESH_MS);
  const moveTimer = window.setInterval(move, MOVE_INTERVAL_MS);

  return {
    id: 'world',
    idPrefix: PREFIX,
    kind: 'world',
    get: (id) => entries.get(id)?.flight,
    positionAt(id, time) {
      const entry = entries.get(id);
      return entry && positionAt(entry.flight, JulianDate.toDate(time).getTime());
    },
    airborne: () => [...entries].filter(([id, entry]) => isVisible(id, entry)).map(([id]) => id),
    setPlaneVisible(id, visible) {
      if (visible) hidden.delete(id);
      else hidden.add(id);
      const entry = entries.get(id);
      if (entry) entry.billboard.show = visible;
    },
    setVisible(visible) {
      billboards.show = visible;
      labels.show = visible;
    },
    describe(id): InfoContent | null {
      const flight = entries.get(id)?.flight;
      if (!flight) return null;
      return {
        kind: 'Voo no mundo',
        title: flightName(flight),
        rows: [
          ['País de origem', flight.originCountry ?? '—'],
          [
            'Altitude',
            flight.altitudeFt != null
              ? `${formatInt(flight.altitudeFt)} pés (${formatInt(flight.altitudeFt * FEET_TO_METERS)} m)`
              : '—',
          ],
          ['Velocidade', flight.speedKt != null ? `${formatInt(flight.speedKt * 1.852)} km/h` : '—'],
          ['Rumo', flight.track != null ? `${formatInt(flight.track)}°` : '—'],
          ['Vertical', describeVertical(flight.verticalRateFpm)],
        ],
        link: {
          url: `https://globe.adsb.lol/?icao=${encodeURIComponent(flight.id)}`,
          label: 'Ver trajeto no adsb.lol ↗',
        },
        cockpitTarget: id,
      };
    },
    destroy() {
      abort.abort();
      window.clearInterval(refreshTimer);
      window.clearInterval(moveTimer);
      if (!viewer.isDestroyed()) {
        scene.primitives.remove(billboards);
        scene.primitives.remove(labels);
      }
    },
  };
}
