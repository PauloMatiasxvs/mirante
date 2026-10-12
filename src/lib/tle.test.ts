import { describe, expect, it } from 'vitest';
import { parseTle } from './tle';

const SAMPLE = [
  'ISS (ZARYA)             ',
  '1 25544U 98067A   26284.17638745  .00009430  00000+0  18014-3 0  9995',
  '2 25544  51.6312  86.0933 0006713 248.1316 111.8959 15.48821882589734',
  'CSS (TIANHE)',
  '1 48274U 21035A   26284.50000000  .00020000  00000+0  23000-3 0  9991',
  '2 48274  41.4700 120.0000 0005000  90.0000 270.0000 15.60000000123456',
].join('\r\n');

describe('parseTle', () => {
  it('reads name, catalog number and both lines', () => {
    const [iss, tianhe] = parseTle(SAMPLE);
    expect(iss).toMatchObject({ name: 'ISS (ZARYA)', norad: 25544 });
    expect(iss.line1.startsWith('1 25544')).toBe(true);
    expect(tianhe.norad).toBe(48274);
  });

  it('skips incomplete records', () => {
    expect(parseTle('ORPHAN\n1 99999U')).toEqual([]);
  });
});
