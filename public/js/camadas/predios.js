// Camada de prédios em 3D: contornos do OpenStreetMap erguidos na altura de
// cada prédio e assentados sobre o relevo. Os dados de cada cidade ficam em
// public/dados/ (gerados por scripts/baixar-predios.mjs) e só são carregados
// quando a câmera chega perto.

import { CIDADES } from '../cidades.js';

const { Cesium } = window;

const DISTANCIA_PARA_CARREGAR_M = 30_000;
const NIVEL_DO_TERRENO = 13; // resolução de ~20 m, suficiente para a base dos prédios
const COR_BAIXA = Cesium.Color.fromCssColorString('#e7ebf0');
const COR_ALTA = Cesium.Color.fromCssColorString('#a9cdf5');

function corDaAltura(altura) {
  const t = Math.min(1, Math.max(0, (altura - 10) / 110));
  return Cesium.Color.lerp(COR_BAIXA, COR_ALTA, t, new Cesium.Color());
}

function centro(predio) {
  let lon = 0;
  let lat = 0;
  const pontos = (predio.length - 2) / 2;
  for (let i = 2; i < predio.length; i += 2) {
    lon += predio[i];
    lat += predio[i + 1];
  }
  return Cesium.Cartographic.fromDegrees(lon / pontos, lat / pontos);
}

// Altura do chão sob cada prédio. Se o relevo falhar, usa a média dos
// pontos que deram certo (ou zero, sem relevo nenhum).
async function alturasDoChao(terreno, predios) {
  const pontos = predios.map(centro);
  if (terreno instanceof Cesium.EllipsoidTerrainProvider) return pontos.map(() => 0);
  try {
    await Cesium.sampleTerrain(terreno, NIVEL_DO_TERRENO, pontos);
  } catch (erro) {
    console.warn('Relevo indisponível para os prédios:', erro);
  }
  const validas = pontos.map((p) => p.height).filter(Number.isFinite);
  const media = validas.length ? validas.reduce((a, b) => a + b, 0) / validas.length : 0;
  return pontos.map((p) => (Number.isFinite(p.height) ? p.height : media));
}

export function criarCamadaPredios(viewer, terrenoPronto, aoAtualizar) {
  const colecao = viewer.scene.primitives.add(new Cesium.PrimitiveCollection());
  const cidades = new Map(); // chave -> Promise com o total de prédios
  let total = 0;

  async function montar(chave) {
    const resposta = await fetch(`dados/predios-${chave}.json`);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const { predios } = await resposta.json();
    await terrenoPronto;
    const chao = await alturasDoChao(viewer.scene.terrainProvider, predios);

    const instancias = predios.map(
      (predio, i) =>
        new Cesium.GeometryInstance({
          geometry: new Cesium.PolygonGeometry({
            polygonHierarchy: new Cesium.PolygonHierarchy(
              Cesium.Cartesian3.fromDegreesArray(predio.slice(2)),
            ),
            height: chao[i] + predio[1],
            extrudedHeight: chao[i] + predio[0],
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(corDaAltura(predio[0])),
          },
        }),
    );

    colecao.add(
      new Cesium.Primitive({
        geometryInstances: instancias,
        appearance: new Cesium.PerInstanceColorAppearance({ translucent: false, closed: true }),
        shadows: Cesium.ShadowMode.ENABLED,
      }),
    );
    total += predios.length;
    aoAtualizar({ total });
    return predios.length;
  }

  function carregar(chave) {
    if (!cidades.has(chave)) {
      const promessa = montar(chave);
      cidades.set(chave, promessa);
      promessa.catch((erro) => {
        console.warn(`Prédios de ${chave} indisponíveis:`, erro);
        cidades.delete(chave);
        aoAtualizar({ total, erro: total === 0 });
      });
    }
    return cidades.get(chave);
  }

  // Carrega sozinho a cidade de que a câmera se aproximar.
  viewer.camera.moveEnd.addEventListener(() => {
    const camera = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC);
    if (!camera || camera.height > DISTANCIA_PARA_CARREGAR_M) return;
    for (const [chave, { alvo }] of Object.entries(CIDADES)) {
      const distancia = Cesium.Cartesian3.distance(
        viewer.camera.positionWC,
        Cesium.Cartesian3.fromDegrees(alvo.lon, alvo.lat),
      );
      if (distancia < DISTANCIA_PARA_CARREGAR_M) carregar(chave);
    }
  });

  aoAtualizar({ total: 0 });

  return {
    prefixo: 'predio-',
    // A camada não é uma fonte de entidades: o liga/desliga mexe na coleção.
    fonte: {
      get show() {
        return colecao.show;
      },
      set show(valor) {
        colecao.show = valor;
      },
    },
    carregar,
    descrever: () => null,
  };
}
