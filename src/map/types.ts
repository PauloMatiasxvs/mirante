import type { Cartesian3, JulianDate } from 'cesium';
import type cities from '../data/cities.json';
import type { Flight } from '../lib/aircraft';

export type CityId = keyof typeof cities;
export type LayerId = 'flights' | 'military' | 'world' | 'earthquakes' | 'satellites' | 'buildings';
export type VisionMode = 'normal' | 'crt' | 'night' | 'thermal' | 'noir';
export type Destination = 'brazil' | 'planet' | 'iss' | CityId;

export interface LayerStatus {
  count: number | null;
  error: boolean;
  /** Unix ms of the last successful load. */
  updatedAt?: number;
}

export interface InfoContent {
  kind: string;
  title: string;
  rows: Array<[label: string, value: string]>;
  link?: { url: string; label: string };
  /** Id of an airborne flight the user can ride in the cockpit. */
  cockpitTarget?: string;
}

export interface MapLayer {
  readonly id: LayerId;
  /** Prefix of the object ids this layer owns, used to route picks. */
  readonly idPrefix: string;
  setVisible(visible: boolean): void;
  describe(id: string): InfoContent | null;
  destroy(): void;
}

/** Any layer of aircraft the cockpit can ride and the traffic panel can list. */
export interface FlightSource {
  readonly idPrefix: string;
  readonly kind: 'flight' | 'military' | 'world';
  get(id: string): Flight | undefined;
  positionAt(id: string, time: JulianDate): Cartesian3 | undefined;
  airborne(): string[];
  setPlaneVisible(id: string, visible: boolean): void;
}
