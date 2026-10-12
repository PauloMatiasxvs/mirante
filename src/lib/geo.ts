const EARTH_RADIUS_M = 6_371_000;
const RAD = Math.PI / 180;

export interface LatLon {
  lat: number;
  lon: number;
}

/** Destination point after travelling `distance` meters on `bearing` (degrees). */
export function destination({ lat, lon }: LatLon, bearing: number, distance: number): LatLon {
  const angular = distance / EARTH_RADIUS_M;
  const theta = bearing * RAD;
  const phi1 = lat * RAD;
  const lambda1 = lon * RAD;
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(angular) + Math.cos(phi1) * Math.sin(angular) * Math.cos(theta),
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(angular) * Math.cos(phi1),
      Math.cos(angular) - Math.sin(phi1) * Math.sin(phi2),
    );
  return { lat: phi2 / RAD, lon: (((lambda2 / RAD + 540) % 360) - 180) };
}

/**
 * Sun elevation above the horizon, in degrees. Low-precision USNO formula,
 * good to well under a degree, which is plenty for a HUD readout.
 */
export function sunElevation(date: Date, lat: number, lon: number): number {
  const days = date.getTime() / 86_400_000 - 10_957.5; // since J2000
  const meanAnomaly = (357.529 + 0.98560028 * days) * RAD;
  const meanLongitude = 280.459 + 0.98564736 * days;
  const eclipticLongitude =
    (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
  const obliquity = (23.439 - 0.00000036 * days) * RAD;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );
  const siderealDeg = (18.697374558 + 24.06570982441908 * days) * 15;
  const hourAngle = (siderealDeg + lon) * RAD - rightAscension;
  const elevation = Math.asin(
    Math.sin(lat * RAD) * Math.sin(declination) +
      Math.cos(lat * RAD) * Math.cos(declination) * Math.cos(hourAngle),
  );
  return elevation / RAD;
}

/** Normalizes any angle in degrees to [0, 360). */
export const normalizeDegrees = (deg: number) => ((deg % 360) + 360) % 360;
