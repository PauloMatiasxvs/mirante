import {
  Cartesian2,
  Cartesian3,
  Color,
  ConstantProperty,
  CustomDataSource,
  DistanceDisplayCondition,
  ExtrapolationType,
  HeightReference,
  JulianDate,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  SampledPositionProperty,
  type Entity,
  type Viewer,
} from 'cesium';
import type { FlightsResponse } from '../../../api/flights';
import {
  aircraftModel,
  FEET_TO_METERS,
  flightLevel,
  flightName,
  KNOTS_TO_MPS,
  verticalTrend,
  type Flight,
} from '../../lib/aircraft';
import { formatInt } from '../../lib/format';
import { destination } from '../../lib/geo';
import type { InfoContent, LayerStatus, MapLayer } from '../types';

const REFRESH_MS = 30_000;
// Between updates each plane keeps moving on its last speed and track.
const DEAD_RECKONING_S = 180;
const PREFIX = 'flight-';

const ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
    '<path fill="#7dd3fc" stroke="#082f49" stroke-width="2.5" stroke-linejoin="round" ' +
    'd="M32 4c2.5 0 4 3 4 7v13l22 13v5l-22-7v15l7 5v4l-11-3-11 3v-4l7-5V35l-22 7v-5l22-13V11c0-4 1.5-7 4-7z"/>' +
    '</svg>',
)}`;

export interface FlightsLayer extends MapLayer {
  readonly dataSource: CustomDataSource;
  get(entityId: string): Flight | undefined;
  airborne(): string[];
}

const altitudeMeters = (flight: Flight) =>
  flight.onGround ? 0 : Math.max(30, (flight.altitudeFt ?? 0) * FEET_TO_METERS);

const heightReference = (flight: Flight) =>
  flight.onGround ? HeightReference.CLAMP_TO_GROUND : HeightReference.NONE;

const labelText = (flight: Flight) => `${flightName(flight)} · ${flightLevel(flight)}`;

function trackPosition(flight: Flight, at: JulianDate): SampledPositionProperty {
  const height = altitudeMeters(flight);
  const position = new SampledPositionProperty();
  position.forwardExtrapolationType = ExtrapolationType.HOLD;
  position.backwardExtrapolationType = ExtrapolationType.HOLD;
  position.addSample(at, Cartesian3.fromDegrees(flight.lon, flight.lat, height));

  if (!flight.onGround && flight.speedKt && flight.track != null) {
    const ahead = destination(flight, flight.track, flight.speedKt * KNOTS_TO_MPS * DEAD_RECKONING_S);
    position.addSample(
      JulianDate.addSeconds(at, DEAD_RECKONING_S, new JulianDate()),
      Cartesian3.fromDegrees(ahead.lon, ahead.lat, height),
    );
  }
  return position;
}

function describeVertical(fpm: number | null): string {
  const trend = verticalTrend(fpm);
  if (trend === 'level') return 'Nivelado';
  return `${trend === 'climbing' ? 'Subindo' : 'Descendo'} ${formatInt(Math.abs(fpm ?? 0))} pés/min`;
}

export function createFlightsLayer(viewer: Viewer, onStatus: (status: LayerStatus) => void): FlightsLayer {
  const dataSource = new CustomDataSource('flights');
  void viewer.dataSources.add(dataSource);
  const flights = new Map<string, Flight>();
  const abort = new AbortController();

  function sync({ updatedAt, flights: incoming }: FlightsResponse) {
    const base = Date.parse(updatedAt) || Date.now();
    const seen = new Set<string>();
    const { entities } = dataSource;

    entities.suspendEvents();
    for (const flight of incoming) {
      const id = PREFIX + flight.id;
      seen.add(id);
      flights.set(id, flight);

      const position = trackPosition(flight, JulianDate.fromDate(new Date(base - flight.seenSeconds * 1000)));
      const rotation = -CesiumMath.toRadians(flight.track ?? 0);
      const reference = heightReference(flight);
      const existing = entities.getById(id);

      if (existing?.billboard && existing.label) {
        existing.position = position;
        existing.billboard.rotation = new ConstantProperty(rotation);
        existing.billboard.heightReference = new ConstantProperty(reference);
        existing.label.heightReference = new ConstantProperty(reference);
        existing.label.text = new ConstantProperty(labelText(flight));
        continue;
      }

      entities.add({
        id,
        position,
        billboard: {
          image: ICON,
          heightReference: reference,
          rotation,
          alignedAxis: Cartesian3.UNIT_Z,
          scale: 0.5,
          scaleByDistance: new NearFarScalar(2e4, 1.1, 8e6, 0.3),
        },
        label: {
          text: labelText(flight),
          heightReference: reference,
          font: '600 12px "JetBrains Mono", monospace',
          fillColor: Color.fromCssColorString('#e0f2fe'),
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cartesian2(0, -24),
          distanceDisplayCondition: new DistanceDisplayCondition(0, 400_000),
        },
      });
    }

    for (const id of flights.keys()) {
      if (seen.has(id)) continue;
      flights.delete(id);
      entities.removeById(id);
    }
    entities.resumeEvents();
  }

  async function refresh() {
    try {
      const response = await fetch('/api/flights', { signal: abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sync((await response.json()) as FlightsResponse);
      onStatus({ count: flights.size, error: false });
    } catch (error) {
      if (abort.signal.aborted) return;
      console.warn('flights unavailable:', error);
      onStatus({ count: flights.size || null, error: true });
    }
  }

  void refresh();
  const timer = window.setInterval(refresh, REFRESH_MS);

  return {
    id: 'flights',
    entityPrefix: PREFIX,
    dataSource,
    get: (id) => flights.get(id),
    airborne: () => [...flights].filter(([, flight]) => !flight.onGround).map(([id]) => id),
    setVisible(visible) {
      dataSource.show = visible;
    },
    describe(entity: Entity): InfoContent | null {
      const flight = flights.get(entity.id);
      if (!flight) return null;
      const altitude = flight.onGround
        ? 'No solo'
        : flight.altitudeFt != null
          ? `${formatInt(flight.altitudeFt)} pés (${formatInt(flight.altitudeFt * FEET_TO_METERS)} m)`
          : '—';
      return {
        kind: 'Voo ao vivo',
        title: flightName(flight),
        rows: [
          ['Aeronave', aircraftModel(flight) || '—'],
          ['Matrícula', flight.registration ?? '—'],
          ['Altitude', altitude],
          ['Velocidade', flight.speedKt != null ? `${formatInt(flight.speedKt * 1.852)} km/h` : '—'],
          ['Rumo', flight.track != null ? `${formatInt(flight.track)}°` : '—'],
          ['Vertical', describeVertical(flight.verticalRateFpm)],
        ],
        link: {
          url: `https://globe.adsb.lol/?icao=${encodeURIComponent(flight.id)}`,
          label: 'Ver trajeto no adsb.lol ↗',
        },
        cockpitTarget: flight.onGround ? undefined : entity.id,
      };
    },
    destroy() {
      abort.abort();
      window.clearInterval(timer);
      viewer.dataSources.remove(dataSource, true);
    },
  };
}
