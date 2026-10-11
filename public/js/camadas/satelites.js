// Camada de satélites: estações espaciais e os satélites mais brilhantes,
// com órbitas calculadas no navegador a partir dos elementos do CelesTrak.

import { numero, coordenada } from '../formatos.js';

const { Cesium } = window;

const SATELLITE_JS = 'https://cdn.jsdelivr.net/npm/satellite.js@7.1.0/+esm';
const GRUPOS = ['stations', 'visual'];
// O CelesTrak pede que os mesmos dados não sejam baixados mais de uma vez a cada 2 h.
const VALIDADE_CACHE_MS = 2 * 60 * 60_000;
const PASSO_S = 20;
const RECALCULO_MS = 60_000;
const DISTANCIA_ACOPLADO_M = 50_000;
const ID_ISS = 25544;

const DESTAQUES = {
  25544: { rotulo: 'ISS', nome: 'Estação Espacial Internacional', cor: '#f0abfc' },
  48274: { rotulo: 'TIANGONG', nome: 'Estação Espacial Chinesa (Tiangong)', cor: '#fda4af' },
};

async function baixarGrupo(grupo) {
  const chave = `mirante:tle:${grupo}`;
  try {
    const salvo = JSON.parse(localStorage.getItem(chave));
    if (salvo && Date.now() - salvo.em < VALIDADE_CACHE_MS) return salvo.texto;
  } catch {
    // Sem acesso ao armazenamento local: baixa de novo.
  }

  const resposta = await fetch(
    `https://celestrak.org/NORAD/elements/gp.php?GROUP=${grupo}&FORMAT=tle`,
  );
  const texto = await resposta.text();
  if (!resposta.ok || !texto.includes('\n1 ')) throw new Error(`CelesTrak: ${grupo}`);
  try {
    localStorage.setItem(chave, JSON.stringify({ em: Date.now(), texto }));
  } catch {
    // Cache é só uma gentileza com o servidor; segue sem ele.
  }
  return texto;
}

function lerTLE(texto) {
  const linhas = texto.split(/\r?\n/).map((l) => l.trimEnd());
  const satelites = [];
  for (let i = 1; i < linhas.length - 1; i++) {
    if (linhas[i].startsWith('1 ') && linhas[i + 1].startsWith('2 ')) {
      satelites.push({
        nome: linhas[i - 1].trim(),
        norad: Number(linhas[i].slice(2, 7)),
        l1: linhas[i],
        l2: linhas[i + 1],
      });
      i++;
    }
  }
  return satelites;
}

export function criarCamadaSatelites(viewer, aoAtualizar) {
  const fonte = new Cesium.CustomDataSource('satelites');
  viewer.dataSources.add(fonte);
  const satelites = new Map();
  let sgp4 = null;

  function posicaoEm(satrec, data) {
    const estado = sgp4.propagate(satrec, data);
    if (!estado || !estado.position || typeof estado.position !== 'object') return null;
    const geo = sgp4.eciToGeodetic(estado.position, sgp4.gstime(data));
    return {
      lat: sgp4.degreesLat(geo.latitude),
      lon: sgp4.degreesLong(geo.longitude),
      alturaKm: geo.height,
      velocidadeKms: Math.hypot(estado.velocity.x, estado.velocity.y, estado.velocity.z),
    };
  }

  function cartesiano(p) {
    return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alturaKm * 1000);
  }

  function criarEntidade(id, satelite) {
    const destaque = DESTAQUES[satelite.norad];
    const cor = Cesium.Color.fromCssColorString(destaque?.cor ?? '#c4b5fd');
    fonte.entities.add({
      id,
      position: new Cesium.SampledPositionProperty(),
      viewFrom: new Cesium.Cartesian3(0, -1_800_000, 1_100_000),
      point: {
        pixelSize: destaque ? 12 : 5,
        color: cor,
        outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
        outlineWidth: destaque ? 2 : 1,
      },
      label: {
        text: destaque?.rotulo ?? satelite.nome,
        font: destaque ? '700 13px "JetBrains Mono", monospace' : '11px "JetBrains Mono", monospace',
        fillColor: cor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -16),
        distanceDisplayCondition: destaque
          ? undefined
          : new Cesium.DistanceDisplayCondition(0, 4_000_000),
      },
    });
  }

  // Naves acopladas às estações (Soyuz, Progress, Dragon...) ficam no mesmo
  // ponto da estação; escondê-las evita rótulos encavalados.
  function acopladoAUmaEstacao(satelite, estacoes, data) {
    if (DESTAQUES[satelite.norad]) return false;
    const p = posicaoEm(satelite.satrec, data);
    return Boolean(p) && estacoes.some((e) => Cesium.Cartesian3.distance(e, cartesiano(p)) < DISTANCIA_ACOPLADO_M);
  }

  // Recalcula alguns minutos de órbita à frente; o Cesium interpola entre os pontos.
  function recalcular() {
    const agora = Date.now();
    const estacoes = [];
    for (const satelite of satelites.values()) {
      const p = DESTAQUES[satelite.norad] && posicaoEm(satelite.satrec, new Date(agora));
      if (p) estacoes.push(cartesiano(p));
    }

    for (const [id, satelite] of satelites) {
      const entidade = fonte.entities.getById(id);
      if (acopladoAUmaEstacao(satelite, estacoes, new Date(agora))) {
        entidade.show = false;
        continue;
      }
      const posicao = new Cesium.SampledPositionProperty();
      posicao.setInterpolationOptions({
        interpolationDegree: 3,
        interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
      });
      let amostras = 0;
      for (let s = -60; s <= 180; s += PASSO_S) {
        const data = new Date(agora + s * 1000);
        const p = posicaoEm(satelite.satrec, data);
        if (!p) continue;
        posicao.addSample(Cesium.JulianDate.fromDate(data), cartesiano(p));
        amostras++;
      }
      entidade.show = amostras >= 4;
      if (entidade.show) entidade.position = posicao;
    }
    desenharOrbitaISS(agora);
  }

  // Próxima volta completa da ISS ao redor da Terra (~93 minutos).
  function desenharOrbitaISS(agora) {
    const iss = satelites.get(`sat-${ID_ISS}`);
    if (!iss) return;
    const pontos = [];
    for (let s = 0; s <= 93 * 60; s += 30) {
      const p = posicaoEm(iss.satrec, new Date(agora + s * 1000));
      if (p) pontos.push(cartesiano(p));
    }
    fonte.entities.removeById('orbita-iss');
    fonte.entities.add({
      id: 'orbita-iss',
      polyline: {
        positions: pontos,
        width: 3,
        arcType: Cesium.ArcType.NONE,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Cesium.Color.fromCssColorString('#f0abfc').withAlpha(0.8),
        }),
      },
    });
  }

  async function carregar() {
    try {
      sgp4 = await import(SATELLITE_JS);
      const resultados = await Promise.allSettled(GRUPOS.map(baixarGrupo));
      for (const resultado of resultados) {
        if (resultado.status !== 'fulfilled') continue;
        for (const tle of lerTLE(resultado.value)) {
          const id = `sat-${tle.norad}`;
          if (satelites.has(id)) continue;
          satelites.set(id, { ...tle, satrec: sgp4.twoline2satrec(tle.l1, tle.l2) });
          criarEntidade(id, tle);
        }
      }
      if (!satelites.size) throw new Error('nenhum satélite carregado');
      recalcular();
      setInterval(recalcular, RECALCULO_MS);
      aoAtualizar({ total: satelites.size });
    } catch (erro) {
      console.warn('Satélites indisponíveis:', erro);
      aoAtualizar({ erro: true });
    }
  }

  carregar();

  return {
    prefixo: 'sat-',
    fonte,
    seguirISS() {
      const iss = fonte.entities.getById(`sat-${ID_ISS}`);
      if (!iss) return false;
      viewer.trackedEntity = iss;
      viewer.selectedEntity = iss;
      return true;
    },
    descrever(entidade) {
      const satelite = satelites.get(entidade.id);
      const p = satelite && posicaoEm(satelite.satrec, new Date());
      if (!p) return null;
      const destaque = DESTAQUES[satelite.norad];
      return {
        tipo: destaque ? 'Estação espacial' : 'Satélite',
        titulo: destaque?.nome ?? satelite.nome,
        linhas: [
          ['Altitude', `${numero(p.alturaKm)} km`],
          ['Velocidade', `${numero(p.velocidadeKms * 3600)} km/h`],
          ['Sobre', coordenada(p.lat, p.lon)],
          ['Catálogo NORAD', satelite.norad],
        ],
        link: {
          url: `https://celestrak.org/satcat/records.php?CATNR=${satelite.norad}`,
          texto: 'Ficha no CelesTrak ↗',
        },
      };
    },
  };
}
