import { describe, expect, it } from 'vitest';
import { formatDms, formatGroundResolution, formatLatLon, timeAgo } from './format';

describe('formatDms', () => {
  it('formats southern and western coordinates with Portuguese hemispheres', () => {
    expect(formatDms(-3.72639, 'N', 'S')).toBe(`3°43'35"S`);
    expect(formatDms(-38.4985, 'L', 'O')).toBe(`38°29'55"O`);
  });
});

describe('formatLatLon', () => {
  it('uses L/O for east/west', () => {
    expect(formatLatLon(-23.55, -46.63)).toBe('23.55° S, 46.63° O');
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');

  it.each([
    [now - 20_000, 'agora mesmo'],
    [now - 5 * 60_000, 'há 5 min'],
    [now - 125 * 60_000, 'há 2 h 5 min'],
  ])('describes %d', (time, expected) => {
    expect(timeAgo(time, now)).toBe(expected);
  });
});

describe('formatGroundResolution', () => {
  it('switches units as the camera climbs', () => {
    expect(formatGroundResolution(1.333)).toBe('1,33 m/px');
    expect(formatGroundResolution(250)).toBe('250 m/px');
    expect(formatGroundResolution(5_200)).toBe('5 km/px');
  });
});
