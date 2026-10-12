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
  type Viewer,
} from 'cesium';
import type { FlightsResponse } from '../../../api/_lib/flight';
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
import { planeIcon } from '../planeIcon';
import type { FlightSource, InfoContent, LayerStatus, MapLayer } from '../types';

// Between updates each plane keeps moving on its last speed and track.
const DEAD_RECKONING_S = 180;

export interface FlightsLayerOptions {
  id: 'flights' | 'military';
  endpoint: string;
  idPrefix: string;
  color: string;
  /** Shown as the info card's kind, e.g. "Voo ao vivo". */
  label: string;
  refreshMs: number;
}

export type FlightsLayer = MapLayer & FlightSource;

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

export function describeVertical(fpm: number | null): string {
  const trend = verticalTrend(fpm);
  if (trend === 'level') return 'Nivelado';
  return `${trend === 'climbing' ? 'Subindo' : 'Descendo'} ${formatInt(Math.abs(fpm ?? 0))} pés/min`;
}

export function createFlightsLayer(
  viewer: Viewer,
  options: FlightsLayerOptions,
  onStatus: (status: LayerStatus) => void,
): FlightsLayer {
  const { id: layerId, endpoint, idPrefix, color, label, refreshMs } = options;
  const dataSource = new CustomDataSource(layerId);
  void viewer.dataSources.add(dataSource);
  const flights = new Map<string, Flight>();
  const abort = new AbortController();
  const icon = planeIcon(color);

  function sync({ updatedAt, flights: incoming }: FlightsResponse) {
    const base = Date.parse(updatedAt) || Date.now();
    const seen = new Set<string>();
    const { entities } = dataSource;

    entities.suspendEvents();
    for (const flight of incoming) {
      const id = idPrefix + flight.id;
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
          image: icon,
          heightReference: reference,
          rotation,
          alignedAxis: Cartesian3.UNIT_Z,
          scale: 0.55,
          scaleByDistance: new NearFarScalar(2e4, 1.1, 8e6, 0.5),
        },
        label: {
          text: labelText(flight),
          heightReference: reference,
          font: '600 12px "JetBrains Mono", monospace',
          fillColor: Color.fromCssColorString(color).brighten(0.4, new Color()),
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
      const response = await fetch(endpoint, { signal: abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      sync((await response.json()) as FlightsResponse);
      onStatus({ count: flights.size, error: false });
    } catch (error) {
      if (abort.signal.aborted) return;
      console.warn(`${layerId} unavailable:`, error);
      onStatus({ count: flights.size || null, error: true });
    }
  }

  void refresh();
  const timer = window.setInterval(refresh, refreshMs);

  return {
    id: layerId,
    idPrefix,
    kind: layerId === 'military' ? 'military' : 'flight',
    get: (id) => flights.get(id),
    positionAt: (id, time) => dataSource.entities.getById(id)?.position?.getValue(time),
    airborne: () => [...flights].filter(([, flight]) => !flight.onGround).map(([id]) => id),
    setPlaneVisible(id, visible) {
      const entity = dataSource.entities.getById(id);
      if (entity) entity.show = visible;
    },
    setVisible(visible) {
      dataSource.show = visible;
    },
    describe(id): InfoContent | null {
      const flight = flights.get(id);
      if (!flight) return null;
      const altitude = flight.onGround
        ? 'No solo'
        : flight.altitudeFt != null
          ? `${formatInt(flight.altitudeFt)} pés (${formatInt(flight.altitudeFt * FEET_TO_METERS)} m)`
          : '—';
      return {
        kind: label,
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
        cockpitTarget: flight.onGround ? undefined : id,
      };
    },
    destroy() {
      abort.abort();
      window.clearInterval(timer);
      viewer.dataSources.remove(dataSource, true);
    },
  };
}
