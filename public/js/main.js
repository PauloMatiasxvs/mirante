import { criarCamadaVoos } from './camadas/voos.js';
import { criarCamadaTerremotos } from './camadas/terremotos.js';
import { criarCamadaSatelites } from './camadas/satelites.js';
import { aplicarModo } from './modos.js';
import { mostrarFicha, esconderFicha } from './ficha.js';
import { numero } from './formatos.js';

const { Cesium } = window;

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
  terrainProvider: new Cesium.EllipsoidTerrainProvider(),
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
viewer.scene.globe.showGroundAtmosphere = true;
viewer.scene.postProcessStages.fxaa.enabled = true;
// O relógio do globo segue a hora real, para aviões e satélites andarem ao vivo.
viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
viewer.clock.shouldAnimate = true;

// ---------- Câmera ----------

function voarPara(lon, lat, altura, inclinacao = -90) {
  viewer.trackedEntity = undefined;
  // Recua a câmera para o sul, para olhar o alvo de frente quando inclinada.
  const recuo = inclinacao <= -89 ? 0 : altura / Math.tan(Cesium.Math.toRadians(-inclinacao));
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat - recuo / 111_320, altura),
    orientation: { heading: 0, pitch: Cesium.Math.toRadians(inclinacao), roll: 0 },
    duration: 2.5,
  });
}

viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(-52, -15, 7_500_000),
});

// ---------- Camadas ----------

function aoAtualizar(nome) {
  return ({ total, erro }) => {
    const contagem = document.getElementById(`conta-${nome}`);
    contagem.textContent = erro ? 'offline' : numero(total);
    contagem.classList.toggle('erro', Boolean(erro));
    contagem.title = erro ? 'Fonte indisponível no momento' : `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
  };
}

const camadas = {
  voos: criarCamadaVoos(viewer, aoAtualizar('voos')),
  terremotos: criarCamadaTerremotos(viewer, aoAtualizar('terremotos')),
  satelites: criarCamadaSatelites(viewer, aoAtualizar('satelites')),
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
  saopaulo: () => voarPara(-46.55, -23.55, 90_000, -40),
  rio: () => voarPara(-43.2, -22.9, 70_000, -40),
  planeta: () => voarPara(-35, -5, 22_000_000),
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

const painel = document.getElementById('painel');
const alternar = document.getElementById('painel-alternar');
alternar.addEventListener('click', () => {
  const recolhido = painel.classList.toggle('recolhido');
  alternar.setAttribute('aria-expanded', String(!recolhido));
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
window.mirante = { viewer, camadas, destinos };
