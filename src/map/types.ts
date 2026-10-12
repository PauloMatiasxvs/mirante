import type { Entity } from 'cesium';
import type cities from '../data/cities.json';

export type CityId = keyof typeof cities;
export type LayerId = 'flights' | 'earthquakes' | 'satellites' | 'buildings';
export type VisionMode = 'normal' | 'night' | 'thermal';
export type Destination = 'brazil' | 'planet' | 'iss' | CityId;

export interface LayerStatus {
  count: number | null;
  error: boolean;
}

export interface InfoContent {
  kind: string;
  title: string;
  rows: Array<[label: string, value: string]>;
  link?: { url: string; label: string };
  /** Entity id of an airborne flight the user can ride in the cockpit. */
  cockpitTarget?: string;
}

export interface MapLayer {
  readonly id: LayerId;
  /** Prefix of the entity ids this layer owns, used to route picks. */
  readonly entityPrefix: string;
  setVisible(visible: boolean): void;
  describe(entity: Entity): InfoContent | null;
  destroy(): void;
}
