// USGS describes places in English ("12 km SSW of Hilo, Hawaii"). This covers
// the common patterns; anything else is shown as-is.

const COMPASS: Record<string, string> = {
  N: 'N', NNE: 'NNE', NE: 'NE', ENE: 'LNE', E: 'L', ESE: 'LSE', SE: 'SE', SSE: 'SSE',
  S: 'S', SSW: 'SSO', SW: 'SO', WSW: 'OSO', W: 'O', WNW: 'ONO', NW: 'NO', NNW: 'NNO',
};

const SIDES: Record<string, string> = { east: 'leste', west: 'oeste', north: 'norte', south: 'sul' };
const PARTS: Record<string, string> = {
  northern: 'norte',
  southern: 'sul',
  eastern: 'leste',
  western: 'oeste',
  central: 'centro',
};

const NAMES: Record<string, string> = {
  'Mid-Atlantic Ridge': 'Dorsal Mesoatlântica',
  'East Pacific Rise': 'Dorsal do Pacífico Leste',
  'Aleutian Islands': 'Ilhas Aleutas',
  'Kermadec Islands': 'Ilhas Kermadec',
  'Solomon Islands': 'Ilhas Salomão',
  'Fiji Islands': 'Ilhas Fiji',
  'Mariana Islands': 'Ilhas Marianas',
  'Kuril Islands': 'Ilhas Curilas',
  'Papua New Guinea': 'Papua-Nova Guiné',
  'New Zealand': 'Nova Zelândia',
  'Puerto Rico': 'Porto Rico',
  'Dominican Republic': 'República Dominicana',
  'U.S. Virgin Islands': 'Ilhas Virgens Americanas',
  'British Virgin Islands': 'Ilhas Virgens Britânicas',
  'South Sandwich Islands': 'Ilhas Sandwich do Sul',
  Afghanistan: 'Afeganistão',
  Alaska: 'Alasca',
  Bolivia: 'Bolívia',
  Colombia: 'Colômbia',
  Ecuador: 'Equador',
  Greece: 'Grécia',
  Hawaii: 'Havaí',
  Iceland: 'Islândia',
  India: 'Índia',
  Indonesia: 'Indonésia',
  Iran: 'Irã',
  Italy: 'Itália',
  Japan: 'Japão',
  Mexico: 'México',
  Nicaragua: 'Nicarágua',
  Pakistan: 'Paquistão',
  Panama: 'Panamá',
  Philippines: 'Filipinas',
  Russia: 'Rússia',
  Tajikistan: 'Tajiquistão',
  Turkey: 'Turquia',
  Türkiye: 'Turquia',
};

const NAME_PATTERN = new RegExp(
  `\\b(${Object.keys(NAMES)
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/\./g, '\\.'))
    .join('|')})\\b`,
  'g',
);

const RULES: Array<[RegExp, (...groups: string[]) => string]> = [
  [/^(\d+) km ([NSEW]{1,3}) of /, (_, km, dir) => `${km} km a ${COMPASS[dir] ?? dir} de `],
  [/^near the coast of /i, () => 'perto da costa de '],
  [/^off the (east|west|north|south) coast of /i, (_, side) => `ao largo da costa ${SIDES[side.toLowerCase()]} de `],
  [/^off the coast of /i, () => 'ao largo da costa de '],
  [
    /^(north|south|east|west) of (the )?/i,
    (_, side) => {
      const name = SIDES[side.toLowerCase()];
      return `${name === 'leste' || name === 'oeste' ? 'a' : 'ao'} ${name} de `;
    },
  ],
  // "Central Peru" -> "Peru (centro)"
  [
    /\b([Nn]orthern|[Ss]outhern|[Ee]astern|[Ww]estern|[Cc]entral) ([A-Z][\w.'-]*(?: [A-Z][\w.'-]*)*)/g,
    (_, part, name) => `${name} (${PARTS[part.toLowerCase()]})`,
  ],
  [/^(.+) region$/i, (_, name) => `região de ${name}`],
];

export function translateQuakePlace(place: string | null | undefined): string {
  if (!place) return '—';
  const translated = RULES.reduce(
    (text, [pattern, replace]) => text.replace(pattern, (...args) => replace(...(args as string[]))),
    place,
  );
  return translated.replace(NAME_PATTERN, (name) => NAMES[name] ?? name);
}
