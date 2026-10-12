import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  JulianDate,
  LabelStyle,
  type Entity,
  type Viewer,
} from 'cesium';
import { formatBrasiliaTime, formatInt, timeAgo } from '../../lib/format';
import { translateQuakePlace } from '../../lib/quakePlace';
import type { InfoContent, LayerStatus, MapLayer } from '../types';

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const REFRESH_MS = 5 * 60_000;
const PULSE_PERIOD_S = 2.5;
const PREFIX = 'quake-';

interface QuakeFeature {
  id: string;
  geometry: { coordinates: [number, number, number] };
  properties: { mag: number | null; place: string | null; time: number; url: string | null };
}

function magnitudeColor(magnitude: number) {
  if (magnitude >= 5) return Color.fromCssColorString('#ef4444');
  if (magnitude >= 3) return Color.fromCssColorString('#fb923c');
  return Color.fromCssColorString('#facc15');
}

const RING = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
    '<circle cx="32" cy="32" r="28" fill="none" stroke="white" stroke-width="3"/></svg>',
)}`;

// Expanding ring on stronger quakes. A billboard only changes scale and
// color per frame, unlike an animated ellipse that rebuilds its geometry.
function pulse(magnitude: number, color: Color, epoch: JulianDate) {
  const maxScale = 0.6 + magnitude * 0.18;
  const phase = (time?: JulianDate) =>
    (JulianDate.secondsDifference(time ?? JulianDate.now(), epoch) / PULSE_PERIOD_S) % 1;
  return {
    image: RING,
    heightReference: HeightReference.RELATIVE_TO_GROUND,
    scale: new CallbackProperty((time) => 0.2 + phase(time) * maxScale, false),
    color: new CallbackProperty((time) => color.withAlpha(0.85 * (1 - phase(time))), false),
  };
}

export function createEarthquakesLayer(viewer: Viewer, onStatus: (status: LayerStatus) => void): MapLayer {
  const dataSource = new CustomDataSource('earthquakes');
  void viewer.dataSources.add(dataSource);
  const quakes = new Map<string, QuakeFeature>();
  const abort = new AbortController();
  const epoch = JulianDate.now();

  async function refresh() {
    try {
      const response = await fetch(FEED, { signal: abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { features } = (await response.json()) as { features: QuakeFeature[] };
      const { entities } = dataSource;

      entities.suspendEvents();
      entities.removeAll();
      quakes.clear();
      for (const quake of features) {
        const [lon, lat] = quake.geometry.coordinates;
        const magnitude = quake.properties.mag ?? 0;
        const color = magnitudeColor(magnitude);
        const id = PREFIX + quake.id;
        quakes.set(id, quake);

        entities.add({
          id,
          position: Cartesian3.fromDegrees(lon, lat, 1_500),
          point: {
            heightReference: HeightReference.RELATIVE_TO_GROUND,
            pixelSize: Math.max(6, 4 + magnitude * 3),
            color: color.withAlpha(0.92),
            outlineColor: Color.WHITE.withAlpha(0.85),
            outlineWidth: 1.5,
          },
          label:
            magnitude >= 4
              ? {
                  heightReference: HeightReference.RELATIVE_TO_GROUND,
                  text: `M${magnitude.toFixed(1)}`,
                  font: '600 12px "JetBrains Mono", monospace',
                  fillColor: Color.WHITE,
                  outlineColor: Color.BLACK,
                  outlineWidth: 3,
                  style: LabelStyle.FILL_AND_OUTLINE,
                  pixelOffset: new Cartesian2(0, -18),
                }
              : undefined,
          billboard: magnitude >= 4.5 ? pulse(magnitude, color, epoch) : undefined,
        });
      }
      entities.resumeEvents();
      onStatus({ count: quakes.size, error: false });
    } catch (error) {
      if (abort.signal.aborted) return;
      console.warn('earthquakes unavailable:', error);
      onStatus({ count: quakes.size || null, error: true });
    }
  }

  void refresh();
  const timer = window.setInterval(refresh, REFRESH_MS);

  return {
    id: 'earthquakes',
    entityPrefix: PREFIX,
    setVisible(visible) {
      dataSource.show = visible;
    },
    describe(entity: Entity): InfoContent | null {
      const quake = quakes.get(entity.id);
      if (!quake) return null;
      const { mag, place, time, url } = quake.properties;
      const depth = quake.geometry.coordinates[2];
      return {
        kind: 'Terremoto',
        title: `Magnitude ${(mag ?? 0).toFixed(1)}`,
        rows: [
          ['Local', translateQuakePlace(place)],
          ['Quando', timeAgo(time)],
          ['Horário', formatBrasiliaTime(time)],
          ['Profundidade', depth != null ? `${formatInt(depth)} km` : '—'],
        ],
        link: url ? { url, label: 'Detalhes no USGS ↗' } : undefined,
      };
    },
    destroy() {
      abort.abort();
      window.clearInterval(timer);
      viewer.dataSources.remove(dataSource, true);
    },
  };
}
