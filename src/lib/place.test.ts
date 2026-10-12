import { describe, expect, it } from 'vitest';
import { altitudeBand, formatMgrs, nearestCity, regionName } from './place';

describe('formatMgrs', () => {
  it('splits the grid reference into readable groups', () => {
    expect(formatMgrs(-23.55, -46.6333)).toBe('23K LP 3328 9464');
  });

  it('has no grid near the poles', () => {
    expect(formatMgrs(-85, 0)).toBe('—');
  });
});

describe('regionName', () => {
  it.each([
    [-23.5, -46.6, 'AMÉRICA DO SUL'],
    [40.7, -74, 'AMÉRICA DO NORTE'],
    [48.8, 2.3, 'EUROPA'],
    [35.7, 139.7, 'ÁSIA'],
    [-33.9, 151.2, 'OCEANIA'],
    [-10, -20, 'OCEANO · HEMISFÉRIO SUL'],
  ])('(%d, %d) is %s', (lat, lon, expected) => {
    expect(regionName(lat, lon)).toBe(expected);
  });
});

describe('altitudeBand', () => {
  it('grows with the camera height', () => {
    expect(altitudeBand(900)).toBe('RUA');
    expect(altitudeBand(25_000)).toBe('METRÓPOLE');
    expect(altitudeBand(7_500_000)).toBe('GLOBAL');
  });
});

describe('nearestCity', () => {
  const cities = [
    { name: 'São Paulo', lat: -23.55, lon: -46.63 },
    { name: 'Campinas', lat: -22.9, lon: -47.06 },
  ];

  it('finds the closest city within range', () => {
    expect(nearestCity(-23.5, -46.6, cities)?.name).toBe('São Paulo');
  });

  it('returns null when nothing is close', () => {
    expect(nearestCity(-3.7, -38.5, cities)).toBeNull();
  });
});
