// OpenSky reports the registration country by its English name. The browser
// already knows every country's name in both languages, so build the
// English -> Portuguese lookup from Intl instead of hardcoding a list.

// OpenSky spells a few countries differently from Intl's English names.
const ALIASES: Record<string, string> = {
  'Kingdom of the Netherlands': 'NL',
  'Republic of Korea': 'KR',
  "Democratic People's Republic of Korea": 'KP',
  'Russian Federation': 'RU',
  'Iran, Islamic Republic of': 'IR',
  'Viet Nam': 'VN',
  'Republic of Moldova': 'MD',
  'United Republic of Tanzania': 'TZ',
  'Syrian Arab Republic': 'SY',
  "Lao People's Democratic Republic": 'LA',
  'Bolivia, Plurinational State of': 'BO',
  'Venezuela, Bolivarian Republic of': 'VE',
  Turkey: 'TR',
  'Czech Republic': 'CZ',
};

let lookup: Map<string, string> | null = null;

function buildLookup(): Map<string, string> {
  const english = new Intl.DisplayNames(['en'], { type: 'region' });
  const portuguese = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
  const map = new Map<string, string>();
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const name = english.of(code);
      // Unknown codes come back unchanged.
      if (name && name !== code) map.set(name, portuguese.of(code) ?? name);
    }
  }
  for (const [name, code] of Object.entries(ALIASES)) map.set(name, portuguese.of(code) ?? name);
  return map;
}

export function countryInPortuguese(name: string | null | undefined): string {
  if (!name) return '';
  lookup ??= buildLookup();
  return lookup.get(name) ?? name;
}
