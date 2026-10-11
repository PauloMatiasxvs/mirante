// Gera os nomes em português (países, cidades, oceanos) e as fronteiras do
// mapa a partir do Natural Earth, que é de domínio público. Só precisa rodar
// de novo para atualizar os dados:
//
//   node scripts/baixar-mapa-base.mjs

import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

async function baixar(nome) {
  const resposta = await fetch(`${BASE}/${nome}.geojson`);
  if (!resposta.ok) throw new Error(`Natural Earth respondeu ${resposta.status} para ${nome}`);
  return (await resposta.json()).features;
}

const arredondar = (valor, casas = 3) => Math.round(valor * 10 ** casas) / 10 ** casas;

// Linhas (simples ou múltiplas) viram listas planas [lon, lat, lon, lat, ...].
function linhas(geometria) {
  const partes = geometria.type === 'LineString' ? [geometria.coordinates] : geometria.coordinates;
  return partes.map((parte) => parte.flatMap(([lon, lat]) => [arredondar(lon), arredondar(lat)]));
}

// Retângulo que envolve um polígono, para posicionar o nome de um mar.
function retangulo(geometria) {
  const pontos = geometria.coordinates.flat(geometria.type === 'Polygon' ? 1 : 2);
  const lons = pontos.map((p) => p[0]);
  const lats = pontos.map((p) => p[1]);
  return { oeste: Math.min(...lons), leste: Math.max(...lons), sul: Math.min(...lats), norte: Math.max(...lats) };
}

// Os oceanos são grandes demais (e alguns cruzam a linha de data) para o
// centro do retângulo funcionar; o nome deles vai num ponto fixo.
const OCEANOS = [
  ['Oceano Atlântico', -38, 28],
  ['Oceano Atlântico', -18, -22],
  ['Oceano Pacífico', -145, 20],
  ['Oceano Pacífico', -115, -25],
  ['Oceano Índico', 78, -22],
  ['Oceano Ártico', -20, 84],
  ['Oceano Antártico', 20, -62],
];

const [paises, cidades, mares, fronteiras, divisas] = await Promise.all([
  baixar('ne_110m_admin_0_countries'),
  baixar('ne_50m_populated_places'),
  baixar('ne_110m_geography_marine_polys'),
  baixar('ne_50m_admin_0_boundary_lines_land'),
  baixar('ne_50m_admin_1_states_provinces_lines'),
]);

const rotulos = {
  // [nome, lon, lat, nível a partir do qual aparece (menor = país maior)]
  paises: paises.map(({ properties: p }) => [
    p.NAME_PT || p.NAME,
    arredondar(p.LABEL_X, 2),
    arredondar(p.LABEL_Y, 2),
    p.MIN_LABEL,
  ]),
  // [nome, lon, lat, importância (0 = maior), é do Brasil (1/0)]
  cidades: cidades.map(({ properties: p }) => [
    p.NAME_PT || p.NAME,
    arredondar(p.LONGITUDE),
    arredondar(p.LATITUDE),
    p.SCALERANK,
    p.ADM0NAME === 'Brazil' ? 1 : 0,
  ]),
  // [nome, lon, lat, importância]
  mares: [
    ...OCEANOS.map(([nome, lon, lat]) => [nome, lon, lat, 0]),
    ...mares
      .filter(({ properties: p }) => p.scalerank === 1 && (p.name_pt || p.name))
      .map(({ properties: p, geometry }) => [p, retangulo(geometry)])
      .filter(([, r]) => r.leste - r.oeste < 90)
      .map(([p, r]) => [
        p.name_pt || p.name,
        arredondar((r.oeste + r.leste) / 2, 2),
        arredondar((r.sul + r.norte) / 2, 2),
        p.scalerank,
      ]),
  ],
};

const mapa = {
  paises: fronteiras.flatMap(({ geometry }) => linhas(geometry)),
  // Divisas estaduais só do Brasil.
  estados: divisas
    .filter(({ properties: p }) => p.ADM0_A3 === 'BRA')
    .flatMap(({ geometry }) => linhas(geometry)),
};

await mkdir(new URL('../public/dados/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/dados/rotulos.json', import.meta.url), JSON.stringify(rotulos));
await writeFile(new URL('../public/dados/fronteiras.json', import.meta.url), JSON.stringify(mapa));
console.log(
  `${rotulos.paises.length} países, ${rotulos.cidades.length} cidades, ${rotulos.mares.length} mares; ` +
    `${mapa.paises.length} trechos de fronteira, ${mapa.estados.length} de divisas estaduais`,
);
