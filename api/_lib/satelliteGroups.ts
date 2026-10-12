// Shared by the /api/satellites route and the browser layer that reads it.

export const SATELLITE_GROUPS = ['stations', 'visual', 'gnss', 'weather', 'geo'] as const;
export type SatelliteGroup = (typeof SATELLITE_GROUPS)[number];

export interface SatellitesResponse {
  updatedAt: string;
  groups: Partial<Record<SatelliteGroup, string>>;
}
