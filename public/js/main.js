import { criarCamadaVoos } from './camadas/voos.js';
import { criarCamadaTerremotos } from './camadas/terremotos.js';
import { criarCamadaSatelites } from './camadas/satelites.js';
import { criarCamadaPredios } from './camadas/predios.js';
import { aplicarModo } from './modos.js';
import { criarVisor } from './visor.js';
import { mostrarFicha, esconderFicha } from './ficha.js';
import { numero } from './formatos.js';
import { projetar } from './geo.js';
import { CIDADES } from './cidades.js';

const { Cesium } = window;

// Relevo do mundo todo, também da Esri e também sem chave.
const relevo = new Cesium.Terrain(
  Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
    'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
  ),
);
const terrenoPronto = new Promise((resolver) => {
  relevo.readyEvent.addEventListener(() => resolver());
  relevo.errorEvent.addEventListener((erro) => {
    console.warn('Relevo indisponível, seguindo sem ele:', erro);
    resolver();
  });
});

// Imagens de satélite da Esri: não exigem chave de API (somente atribuição).
const imagens = new Cesium.UrlTemplateImageryProvider({
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  maximumLevel: 19,
  credit: new Cesium.Credit('Imagens © Esri, Maxar, Earthstar Geographics'),
});
const nomesDeLugares = new Cesium.UrlTemplateImageryProvider({
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  maximumLevel: 19,
});

const viewer = new Cesium.Viewer('globo', {
  baseLayer: new Cesium.ImageryLayer(imagens),
  terrain: relevo,
  animation: false,
  timeline: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  fullscreenButton: false,
  infoBox: false,
  selectionIndicator: false,
  creditContainer: 'creditos-cesium',
});
viewer.imageryLayers.addImageryProvider(nomesDeLugares);
const { scene } = viewer;
scene.globe.showGroundAtmosphere = true;
// Cor de fundo enquanto as imagens de satélite carregam (o padrão é um azul forte).
scene.globe.baseColor = Cesium.Color.fromCssColorString('#0b1422');
scene.globe.depthTestAgainstTerrain = true;
scene.globe.enableLighting = true;
scene.postProcessStages.fxaa.enabled = true;
// O relógio do globo segue a hora real, para aviões e satélites andarem ao vivo.
viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
viewer.clock.shouldAnimate = true;

// ---------- Luz e sombras ----------

// Uma luz "de estúdio" que acompanha a câmera, vinda do noroeste e do alto:
// relevo e prédios ficam com volume e bem iluminados a qualquer hora do dia.
const luz = new Cesium.DirectionalLight({ direction: Cesium.Cartesian3.UNIT_Z, intensity: 2.2 });
scene.light = luz;
const DIRECAO_LOCAL_DA_LUZ = Cesium.Cartesian3.normalize(
  new Cesium.Cartesian3(0.5, -0.45, -0.74),
  new Cesium.Cartesian3(),
);
const referencialLocal = new Cesium.Matrix4();
scene.preRender.addEventListener(() => {
  Cesium.Transforms.eastNorthUpToFixedFrame(viewer.camera.positionWC, undefined, referencialLocal);
  Cesium.Matrix4.multiplyByPointAsVector(referencialLocal, DIRECAO_LOCAL_DA_LUZ, luz.direction);
  Cesium.Cartesian3.normalize(luz.direction, luz.direction);
});

// Sombras só de perto, onde fazem diferença e não pesam no desempenho.
viewer.shadowMap.softShadows = true;
viewer.shadowMap.darkness = 0.35;
viewer.shadowMap.maximumDistance = 6_000;
viewer.terrainShadows = Cesium.ShadowMode.RECEIVE_ONLY;
viewer.camera.changed.addEventListener(() => {
  viewer.shadows = viewer.camera.positionCartographic.height < 12_000;
});

// ---------- Câmera ----------

function voarPara(lon, lat, altura) {
  viewer.trackedEntity = undefined;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, altura),
    duration: 2.5,
  });
}

// Voo baixo e inclinado, olhando para o ponto de destaque da cidade.
async function voarParaCidade(chave) {
  const { alvo, vista } = CIDADES[chave];
  viewer.trackedEntity = undefined;
  camadas.predios.carregar(chave);

  await terrenoPronto;
  const [solo] = await Cesium.sampleTerrain(scene.terrainProvider, 12, [
    Cesium.Cartographic.fromDegrees(alvo.lon, alvo.lat),
  ]).catch(() => [{ height: 0 }]);
  const chao = Number.isFinite(solo?.height) ? solo.height : 0;

  const recuo = vista.altura / Math.tan(Cesium.Math.toRadians(-vista.inclinacao));
  const camera = projetar(alvo.lat, alvo.lon, (vista.rumo + 180) % 360, recuo);
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(camera.lon, camera.lat, chao + vista.altura),
    orientation: {
      heading: Cesium.Math.toRadians(vista.rumo),
      pitch: Cesium.Math.toRadians(vista.inclinacao),
      roll: 0,
    },
    duration: 3,
  });
}

viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(-52, -15, 7_500_000),
});

// ---------- Camadas ----------

function aoAtualizar(nome) {
  return ({ total, erro }) => {
    const contagem = document.getElementById(`conta-${nome}`);
    contagem.textContent = erro ? 'offline' : total ? numero(total) : '—';
    contagem.classList.toggle('erro', Boolean(erro));
    contagem.title = erro ? 'Fonte indisponível no momento' : `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
  };
}

const camadas = {
  voos: criarCamadaVoos(viewer, aoAtualizar('voos')),
  terremotos: criarCamadaTerremotos(viewer, aoAtualizar('terremotos')),
  satelites: criarCamadaSatelites(viewer, aoAtualizar('satelites')),
  predios: criarCamadaPredios(viewer, terrenoPronto, aoAtualizar('predios')),
};

for (const rotulo of document.querySelectorAll('.camada')) {
  const camada = camadas[rotulo.dataset.camada];
  rotulo.querySelector('input').addEventListener('change', (evento) => {
    camada.fonte.show = evento.target.checked;
    if (!evento.target.checked && viewer.selectedEntity?.id.startsWith(camada.prefixo)) {
      viewer.selectedEntity = undefined;
    }
  });
}

// ---------- Ficha de detalhes ----------

function atualizarFicha() {
  const entidade = viewer.selectedEntity;
  const camada = entidade && Object.values(camadas).find((c) => entidade.id.startsWith(c.prefixo));
  const conteudo = camada?.descrever(entidade);
  if (conteudo) mostrarFicha(conteudo);
  else esconderFicha();
}

viewer.selectedEntityChanged.addEventListener(atualizarFicha);
setInterval(atualizarFicha, 1000);
document.getElementById('fechar-ficha').addEventListener('click', () => {
  viewer.selectedEntity = undefined;
});

// ---------- Botões ----------

const destinos = {
  brasil: () => voarPara(-52, -15, 7_500_000),
  planeta: () => voarPara(-35, -5, 22_000_000),
  saopaulo: () => voarParaCidade('saopaulo'),
  rio: () => voarParaCidade('rio'),
  fortaleza: () => voarParaCidade('fortaleza'),
  iss: () => camadas.satelites.seguirISS(),
};

for (const botao of document.querySelectorAll('[data-destino]')) {
  botao.addEventListener('click', () => destinos[botao.dataset.destino]());
}

for (const botao of document.querySelectorAll('[data-modo]')) {
  botao.addEventListener('click', () => {
    aplicarModo(viewer, botao.dataset.modo);
    for (const outro of document.querySelectorAll('[data-modo]')) {
      outro.classList.toggle('ativo', outro === botao);
    }
  });
}

const visor = criarVisor(viewer);
visor.alternar(true);
const botaoVisor = document.getElementById('alternar-visor');
botaoVisor.addEventListener('click', () => {
  const ligado = visor.alternar();
  botaoVisor.classList.toggle('ativo', ligado);
  botaoVisor.setAttribute('aria-pressed', String(ligado));
});

// ---------- Relógio ----------

const formatoUTC = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const formatoBrasilia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});

function atualizarRelogio() {
  const agora = new Date();
  document.getElementById('relogio-utc').textContent = `${formatoUTC.format(agora)} UTC`;
  document.getElementById('relogio-brasilia').textContent = `Brasília ${formatoBrasilia.format(agora)}`;
}

atualizarRelogio();
setInterval(atualizarRelogio, 1000);

// Útil para depurar no console do navegador.
window.mirante = { viewer, camadas, destinos, visor };
