// Tradução das descrições de local do USGS ("12 km SSW of Hilo, Hawaii").
// Cobre os padrões e nomes mais comuns; o que não estiver aqui fica como veio.

// Rosa dos ventos de 16 pontas, em inglês -> português.
const DIRECOES = {
  N: 'N', NNE: 'NNE', NE: 'NE', ENE: 'LNE', E: 'L', ESE: 'LSE', SE: 'SE', SSE: 'SSE',
  S: 'S', SSW: 'SSO', SW: 'SO', WSW: 'OSO', W: 'O', WNW: 'ONO', NW: 'NO', NNW: 'NNO',
};

const LADOS = { east: 'leste', west: 'oeste', north: 'norte', south: 'sul' };
const PARTES = { northern: 'norte', southern: 'sul', eastern: 'leste', western: 'oeste', central: 'centro' };

const EXPRESSOES = [
  [/^(\d+) km ([NSEW]{1,3}) of /, (_, km, direcao) => `${km} km a ${DIRECOES[direcao] ?? direcao} de `],
  [/^near the coast of /i, 'perto da costa de '],
  [/^off the (east|west|north|south) coast of /i, (_, lado) => `ao largo da costa ${LADOS[lado.toLowerCase()]} de `],
  [/^off the coast of /i, 'ao largo da costa de '],
  // "south of the Fiji Islands" -> "ao sul de Ilhas Fiji"
  [/^(north|south|east|west) of (the )?/i, (_, lado) => {
    const nome = LADOS[lado.toLowerCase()];
    return `${nome === 'leste' || nome === 'oeste' ? 'a' : 'ao'} ${nome} de `;
  }],
  // "Central Peru" / "northern Mid-Atlantic Ridge" -> "Peru (centro)"
  [
    /\b([Nn]orthern|[Ss]outhern|[Ee]astern|[Ww]estern|[Cc]entral) ([A-Z][\w.'-]*(?: [A-Z][\w.'-]*)*)/g,
    (_, parte, nome) => `${nome} (${PARTES[parte.toLowerCase()]})`,
  ],
  [/^(.+) region$/i, (_, nome) => `região de ${nome}`],
];

// Nomes que aparecem com frequência nas descrições.
const NOMES = {
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
  Vanuatu: 'Vanuatu',
};

const PADRAO_DOS_NOMES = new RegExp(
  `\\b(${Object.keys(NOMES)
    .sort((a, b) => b.length - a.length)
    .map((nome) => nome.replace(/[.]/g, '\\.'))
    .join('|')})\\b`,
  'g',
);

export function traduzirLocalDoSismo(local) {
  if (!local) return '—';
  let texto = local;
  for (const [padrao, troca] of EXPRESSOES) texto = texto.replace(padrao, troca);
  return texto.replace(PADRAO_DOS_NOMES, (nome) => NOMES[nome]);
}
