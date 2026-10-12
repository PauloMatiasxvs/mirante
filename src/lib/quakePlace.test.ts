import { describe, expect, it } from 'vitest';
import { translateQuakePlace } from './quakePlace';

describe('translateQuakePlace', () => {
  it.each([
    ['12 km SSW of Hilo, Hawaii', '12 km a SSO de Hilo, Havaí'],
    ['45 km ENE of Lebu, Chile', '45 km a LNE de Lebu, Chile'],
    ['south of the Fiji Islands', 'ao sul de Ilhas Fiji'],
    ['east of the Kuril Islands', 'a leste de Ilhas Curilas'],
    ['near the coast of Central Peru', 'perto da costa de Peru (centro)'],
    ['central Mid-Atlantic Ridge', 'Dorsal Mesoatlântica (centro)'],
    ['Kermadec Islands region', 'região de Ilhas Kermadec'],
    ['southern Alaska', 'Alasca (sul)'],
  ])('%s', (input, expected) => {
    expect(translateQuakePlace(input)).toBe(expected);
  });

  it('keeps unknown places untouched', () => {
    expect(translateQuakePlace('8 km NW of The Geysers, CA')).toBe('8 km a NO de The Geysers, CA');
  });

  it('falls back to a dash when USGS sends no place', () => {
    expect(translateQuakePlace(null)).toBe('—');
  });
});
