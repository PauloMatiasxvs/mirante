// Visor de satélite: máscara circular, bússola que gira com a câmera e
// telemetria ao vivo do ponto no centro da tela.

import { elevacaoDoSol } from './geo.js';
import { numero } from './formatos.js';

const { Cesium } = window;

const SVG = 'http://www.w3.org/2000/svg';
const INTERVALO_MS = 100;

const horaUTC = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function elementoSvg(tag, atributos) {
  const el = document.createElementNS(SVG, tag);
  for (const [nome, valor] of Object.entries(atributos)) el.setAttribute(nome, valor);
  return el;
}

// Marcações a cada 5°, maiores a cada 30°, e os pontos cardeais.
function desenharBussola(svg) {
  svg.append(elementoSvg('circle', { r: 99.5, class: 'aro' }));
  for (let grau = 0; grau < 360; grau += 5) {
    const longo = grau % 30 === 0;
    svg.append(
      elementoSvg('line', {
        y1: -99,
        y2: longo ? -90 : -95,
        transform: `rotate(${grau})`,
        class: longo ? 'longo' : '',
      }),
    );
  }
  for (const [grau, letra] of [[0, 'N'], [90, 'L'], [180, 'S'], [270, 'O']]) {
    const texto = elementoSvg('text', { y: -82, transform: `rotate(${grau})` });
    texto.textContent = letra;
    svg.append(texto);
  }
}

function grausMinutosSegundos(valor, positivo, negativo) {
  const absoluto = Math.abs(valor);
  const graus = Math.floor(absoluto);
  const minutos = Math.floor((absoluto - graus) * 60);
  const segundos = Math.round(((absoluto - graus) * 60 - minutos) * 60);
  return `${graus}°${String(minutos).padStart(2, '0')}'${String(segundos).padStart(2, '0')}"${valor >= 0 ? positivo : negativo}`;
}

function distanciaLegivel(metros) {
  return metros >= 10_000 ? `${numero(metros / 1000)} km` : `${numero(metros)} m`;
}

function resolucaoLegivel(metrosPorPixel) {
  if (metrosPorPixel < 10) return `${metrosPorPixel.toFixed(2).replace('.', ',')} m/px`;
  if (metrosPorPixel < 1000) return `${numero(metrosPorPixel)} m/px`;
  return `${numero(metrosPorPixel / 1000)} km/px`;
}

export function criarVisor(viewer) {
  const visor = document.getElementById('visor');
  const bussola = document.getElementById('visor-bussola');
  const campos = Object.fromEntries(
    [...visor.querySelectorAll('[data-campo]')].map((el) => [el.dataset.campo, el]),
  );
  desenharBussola(bussola);

  const centroDaTela = new Cesium.Cartesian2();
  let ativo = false;
  let ultimaAtualizacao = 0;

  function escrever(campo, texto) {
    if (campos[campo].textContent !== texto) campos[campo].textContent = texto;
  }

  function atualizar() {
    const agora = performance.now();
    if (!ativo || agora - ultimaAtualizacao < INTERVALO_MS) return;
    ultimaAtualizacao = agora;

    const { camera, canvas, globe } = viewer.scene;
    const data = new Date();
    const rumo = Cesium.Math.toDegrees(camera.heading);
    bussola.style.transform = `rotate(${-rumo}deg)`;

    escrever('rec', `${horaUTC.format(data)}Z`);
    escrever('rumo', `${String(Math.round(rumo) % 360).padStart(3, '0')}°`);
    escrever('inclinacao', `${Math.round(Cesium.Math.toDegrees(camera.pitch))}°`);
    escrever('altitude', distanciaLegivel(camera.positionCartographic.height));

    centroDaTela.x = canvas.clientWidth / 2;
    centroDaTela.y = canvas.clientHeight / 2;
    const raio = camera.getPickRay(centroDaTela);
    const ponto = raio && globe.pick(raio, viewer.scene);
    if (!ponto) {
      for (const campo of ['alvo', 'solo', 'distancia', 'resolucao', 'sol']) escrever(campo, '—');
      return;
    }

    const alvo = Cesium.Cartographic.fromCartesian(ponto);
    const lat = Cesium.Math.toDegrees(alvo.latitude);
    const lon = Cesium.Math.toDegrees(alvo.longitude);
    const distancia = Cesium.Cartesian3.distance(camera.positionWC, ponto);
    const larguraDaTela = Math.max(canvas.clientWidth, canvas.clientHeight);
    const metrosPorPixel = (2 * distancia * Math.tan(camera.frustum.fov / 2)) / larguraDaTela;

    escrever('alvo', `${grausMinutosSegundos(lat, 'N', 'S')} ${grausMinutosSegundos(lon, 'L', 'O')}`);
    escrever('solo', `${numero(alvo.height)} m`);
    escrever('distancia', distanciaLegivel(distancia));
    escrever('resolucao', resolucaoLegivel(metrosPorPixel));
    escrever('sol', `${elevacaoDoSol(data, lat, lon).toFixed(1).replace('.', ',')}°`);
  }

  viewer.scene.postRender.addEventListener(atualizar);

  return {
    alternar(ligar = !ativo) {
      ativo = ligar;
      visor.hidden = !ativo;
      document.body.classList.toggle('com-visor', ativo);
      return ativo;
    },
  };
}
