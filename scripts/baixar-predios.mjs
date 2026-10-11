// Baixa do OpenStreetMap os prédios das cidades em destaque e grava um arquivo
// compacto por cidade em public/dados/. Só precisa rodar de novo para
// atualizar os dados:
//
//   node scripts/baixar-predios.mjs [cidade...]
//
// Usa a API principal do OSM com poucas requisições, uma de cada vez, para
// respeitar a política de uso. Dados © colaboradores do OpenStreetMap (ODbL).

import { mkdir, writeFile } from 'node:fs/promises';
import { CIDADES } from '../public/js/cidades.js';

const API = 'https://api.openstreetmap.org/api/0.6/map';
const AGENTE = 'mirante/1.0 (github.com/PauloMatiasxvs/mirante)';
const TAMANHO_BLOCO = 0.009; // graus; mantém cada pedido abaixo do limite de nós da API
const PAUSA_MS = 2_000;
const METROS_POR_ANDAR = 3.2;

// Altura usada quando o prédio não tem altura nem andares cadastrados.
const ALTURA_PADRAO = {
  apartments: 12,
  commercial: 12,
  office: 15,
  hotel: 15,
  hospital: 12,
  university: 12,
  school: 8,
  church: 12,
  cathedral: 20,
  retail: 6,
  house: 6,
  residential: 6,
  detached: 6,
  terrace: 6,
  industrial: 8,
  warehouse: 8,
  garage: 3,
  garages: 3,
  shed: 3,
};
const IGNORAR = new Set(['roof', 'carport', 'construction', 'ruins']);

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function numero(texto) {
  const valor = Number.parseFloat(String(texto ?? '').replace(',', '.'));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

function altura(tags) {
  const metros = numero(tags.height);
  if (metros) return metros;
  const andares = numero(tags['building:levels']);
  if (andares) return (andares + (numero(tags['roof:levels']) ?? 0)) * METROS_POR_ANDAR;
  return ALTURA_PADRAO[tags.building] ?? 7;
}

function base(tags) {
  const metros = numero(tags.min_height);
  if (metros) return metros;
  const andar = numero(tags['building:min_level']);
  return andar ? andar * METROS_POR_ANDAR : 0;
}

function decodificar(texto) {
  return texto
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Lê o XML da API: os nós (coordenadas) e os caminhos com etiqueta "building".
function lerXml(xml, nos, caminhos) {
  for (const [, id, lat, lon] of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"/g)) {
    nos.set(id, [Number(lon), Number(lat)]);
  }
  for (const [, id, corpo] of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    if (caminhos.has(id)) continue;
    const tags = {};
    for (const [, k, v] of corpo.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)) {
      tags[decodificar(k)] = decodificar(v);
    }
    if (!tags.building || IGNORAR.has(tags.building)) continue;
    const refs = [...corpo.matchAll(/<nd ref="(\d+)"\s*\/>/g)].map((m) => m[1]);
    caminhos.set(id, { tags, refs });
  }
}

async function baixarBloco(oeste, sul, leste, norte) {
  const bbox = [oeste, sul, leste, norte].map((v) => v.toFixed(5)).join(',');
  const resposta = await fetch(`${API}?bbox=${bbox}`, { headers: { 'user-agent': AGENTE } });
  if (!resposta.ok) throw new Error(`OSM respondeu ${resposta.status} para ${bbox}`);
  return resposta.text();
}

async function baixarCidade(chave) {
  const { nome, area } = CIDADES[chave];
  const nos = new Map();
  const caminhos = new Map();
  let pedidos = 0;

  for (let sul = area.sul; sul < area.norte - 1e-9; sul += TAMANHO_BLOCO) {
    for (let oeste = area.oeste; oeste < area.leste - 1e-9; oeste += TAMANHO_BLOCO) {
      if (pedidos++) await esperar(PAUSA_MS);
      const norte = Math.min(sul + TAMANHO_BLOCO, area.norte);
      const leste = Math.min(oeste + TAMANHO_BLOCO, area.leste);
      console.log(`  ${nome}: bloco ${pedidos}`);
      lerXml(await baixarBloco(oeste, sul, leste, norte), nos, caminhos);
    }
  }

  // Cada prédio vira [altura, base, lon1, lat1, lon2, lat2, ...] (sem repetir o 1º ponto).
  const predios = [];
  for (const { tags, refs } of caminhos.values()) {
    if (refs.length < 4 || refs[0] !== refs.at(-1)) continue;
    const pontos = refs.slice(0, -1).map((ref) => nos.get(ref));
    if (pontos.some((p) => !p)) continue;
    const topo = altura(tags);
    const chao = Math.min(base(tags), topo - 1);
    predios.push([
      Math.round(topo * 10) / 10,
      Math.round(chao * 10) / 10,
      ...pontos.flat().map((v) => Math.round(v * 1e6) / 1e6),
    ]);
  }

  await mkdir(new URL('../public/dados/', import.meta.url), { recursive: true });
  await writeFile(
    new URL(`../public/dados/predios-${chave}.json`, import.meta.url),
    JSON.stringify({
      cidade: nome,
      fonte: '© colaboradores do OpenStreetMap (ODbL)',
      baixadoEm: new Date().toISOString().slice(0, 10),
      predios,
    }),
  );
  const altos = predios.filter((p) => p[0] >= 60).length;
  console.log(`${nome}: ${predios.length} prédios (${altos} com 60 m ou mais)`);
}

const escolhidas = process.argv.slice(2);
for (const chave of escolhidas.length ? escolhidas : Object.keys(CIDADES)) {
  if (!CIDADES[chave]) throw new Error(`Cidade desconhecida: ${chave}`);
  await baixarCidade(chave);
}
