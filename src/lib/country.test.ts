import { describe, expect, it } from 'vitest';
import { countryInPortuguese } from './country';

describe('countryInPortuguese', () => {
  it.each([
    ['Brazil', 'Brasil'],
    ['United States', 'Estados Unidos'],
    ['Germany', 'Alemanha'],
    ['Kingdom of the Netherlands', 'Países Baixos'],
    ['Republic of Korea', 'Coreia do Sul'],
  ])('%s -> %s', (english, portuguese) => {
    expect(countryInPortuguese(english)).toBe(portuguese);
  });

  it('passes unknown names through', () => {
    expect(countryInPortuguese('Atlantis')).toBe('Atlantis');
    expect(countryInPortuguese(undefined)).toBe('');
  });
});
