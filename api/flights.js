// Rota /api/flights: busca os voos ao vivo no adsb.lol e devolve uma lista enxuta.
//
// O adsb.lol não libera CORS para navegadores, então o site consulta esta rota
// em vez da API diretamente. Funciona tanto no servidor local (server.mjs)
// quanto como função serverless na Vercel.

// Centros de busca (raio de 250 milhas náuticas, ~460 km, cada). A maior parte
// da cobertura de receptores no Brasil está no Sudeste: o primeiro círculo pega
// São Paulo, Rio, Belo Horizonte e Curitiba; os outros, Centro-Oeste e Ceará.
const REGIOES = [
  { nome: 'Sudeste', lat: -22.8, lon: -45.5 },
  { nome: 'Brasília', lat: -15.8, lon: -47.9 },
  { nome: 'Fortaleza', lat: -3.78, lon: -38.53 },
];

// A API é gratuita, comunitária e corta quem consulta demais. Por isso as
// regiões são consultadas uma de cada vez, e o resultado fica guardado para
// que vários visitantes não multipliquem as consultas.
const CACHE_MS = 45_000;
const PAUSA_ENTRE_REGIOES_MS = 2_000;
const ESPERA_APOS_LIMITE_MS = 60_000;
const TIMEOUT_MS = 10_000;

let cache = null;
let emAndamento = null;
let bloqueadoAte = 0;

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

async function buscarRegiao({ lat, lon }) {
  const resposta = await fetch(
    `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/250`,
    {
      headers: { 'user-agent': 'mirante (globo 3D com dados abertos)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (resposta.status === 420 || resposta.status === 429) {
    bloqueadoAte = Date.now() + ESPERA_APOS_LIMITE_MS;
    throw Object.assign(new Error('limite de consultas do adsb.lol'), { limite: true });
  }
  if (!resposta.ok) throw new Error(`adsb.lol respondeu ${resposta.status}`);
  const dados = await resposta.json();
  return Array.isArray(dados.ac) ? dados.ac : [];
}

function numeroOuNulo(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function simplificar(aeronave) {
  return {
    id: aeronave.hex,
    callsign: String(aeronave.flight || '').trim() || null,
    registration: aeronave.r || null,
    type: aeronave.t || null,
    lat: aeronave.lat,
    lon: aeronave.lon,
    onGround: aeronave.alt_baro === 'ground',
    altitudeFt: numeroOuNulo(aeronave.alt_baro) ?? numeroOuNulo(aeronave.alt_geom),
    speedKt: numeroOuNulo(aeronave.gs),
    track: numeroOuNulo(aeronave.track),
    verticalRateFpm:
      numeroOuNulo(aeronave.baro_rate) ?? numeroOuNulo(aeronave.geom_rate),
    squawk: aeronave.squawk || null,
    seenSeconds: numeroOuNulo(aeronave.seen_pos) ?? 0,
  };
}

async function carregarVoos() {
  if (Date.now() < bloqueadoAte) throw new Error('aguardando o limite do adsb.lol');

  // As regiões se sobrepõem: fica a posição mais recente de cada aeronave.
  const porId = new Map();
  let falhas = 0;
  for (const [indice, regiao] of REGIOES.entries()) {
    if (indice > 0) await esperar(PAUSA_ENTRE_REGIOES_MS);
    try {
      for (const aeronave of await buscarRegiao(regiao)) {
        if (!aeronave.hex || typeof aeronave.lat !== 'number') continue;
        const anterior = porId.get(aeronave.hex);
        if (!anterior || (aeronave.seen_pos ?? 99) < (anterior.seen_pos ?? 99)) {
          porId.set(aeronave.hex, aeronave);
        }
      }
    } catch (erro) {
      falhas++;
      console.warn(`Voos em ${regiao.nome}: ${erro.message}`);
      if (erro.limite) break;
    }
  }
  if (falhas === REGIOES.length || (falhas && porId.size === 0)) {
    throw new Error('adsb.lol indisponível');
  }

  return {
    updatedAt: new Date().toISOString(),
    source: 'adsb.lol',
    partial: falhas > 0,
    flights: [...porId.values()].map(simplificar),
  };
}

function responderJson(res, status, corpo, cacheControl) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', cacheControl);
  res.end(corpo);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('allow', 'GET');
    res.end();
    return;
  }

  const cacheControl = 'public, max-age=20, s-maxage=45, stale-while-revalidate=60';
  try {
    if (!cache || Date.now() - cache.em > CACHE_MS) {
      emAndamento ??= carregarVoos().finally(() => {
        emAndamento = null;
      });
      const dados = await emAndamento;
      cache = { em: Date.now(), corpo: JSON.stringify(dados) };
    }
    responderJson(res, 200, cache.corpo, cacheControl);
  } catch (erro) {
    console.error('Falha ao buscar voos:', erro.message);
    // Melhor mostrar a última posição conhecida do que um céu vazio.
    if (cache) {
      responderJson(res, 200, cache.corpo, cacheControl);
      return;
    }
    responderJson(
      res,
      502,
      JSON.stringify({ error: 'Fonte de voos indisponível no momento' }),
      'no-store',
    );
  }
}
