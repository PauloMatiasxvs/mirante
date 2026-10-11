// Modo cockpit: a câmera embarca num avião ao vivo e olha para a frente, com
// fita de rumo, velocidade, altitude e a lista dos aviões ao redor.

import { numero } from './formatos.js';
import { nivelDeVoo } from './camadas/voos.js';

const { Cesium } = window;

const INCLINACAO_PADRAO = -6; // graus abaixo do horizonte
const SUAVIZACAO_POSICAO = 0.08;
const SUAVIZACAO_RUMO = 0.05;
const ALTURA_MINIMA_SOBRE_O_SOLO_M = 25;
const PIXELS_POR_GRAU = 6;
const CONTATOS_NA_LISTA = 6;
const INTERVALO_HUD_MS = 100;
const INTERVALO_CONTATOS_MS = 1_000;
const CARDEAIS = { 0: 'N', 90: 'L', 180: 'S', 270: 'O' };

// Menor diferença entre dois ângulos (radianos), no intervalo [-π, π].
function diferencaAngular(a, b) {
  return Cesium.Math.negativePiToPi(a - b);
}

function desenharFita(svg, rumo) {
  const partes = [];
  for (let grau = Math.floor((rumo - 50) / 5) * 5; grau <= rumo + 50; grau += 5) {
    const x = (grau - rumo) * PIXELS_POR_GRAU;
    const normal = ((grau % 360) + 360) % 360;
    const longo = normal % 10 === 0;
    partes.push(`<line x1="${x}" x2="${x}" y1="2" y2="${longo ? 14 : 8}"/>`);
    if (normal % 30 === 0) {
      const texto = CARDEAIS[normal] ?? String(normal / 10).padStart(2, '0');
      partes.push(`<text x="${x}" y="28">${texto}</text>`);
    }
  }
  partes.push('<path class="indice" d="M0 0 L-6 -9 H6 Z"/>');
  svg.innerHTML = partes.join('');
}

export function criarCockpit(viewer, voos) {
  const { scene } = viewer;
  const { camera } = scene;
  const hud = document.getElementById('cockpit');
  const fita = document.getElementById('cockpit-fita');
  const lista = document.getElementById('cockpit-contatos');
  const campos = Object.fromEntries(
    [...hud.querySelectorAll('[data-cockpit]')].map((el) => [el.dataset.cockpit, el]),
  );

  let alvo = null;
  let historico = [];
  let posicaoSuave = null;
  let rumoSuave = 0;
  let olharRumo = 0;
  let olharInclinacao = 0;
  let ultimoHud = 0;
  let ultimosContatos = 0;
  let contatos = [];
  const aoMudar = new Set();

  const posicaoAtual = (id, tempo) => voos.fonte.entities.getById(id)?.position?.getValue(tempo);

  function entrar(id, { lembrar = true } = {}) {
    const voo = voos.dados(id);
    if (!voo || voo.onGround || !voos.fonte.entities.getById(id)) return false;
    if (alvo && lembrar) historico.push(alvo);
    if (alvo) mostrarAviao(alvo, true);

    alvo = id;
    ultimosContatos = 0;
    mostrarAviao(id, false);
    posicaoSuave = null;
    rumoSuave = Cesium.Math.toRadians(voo.track ?? 0);
    olharRumo = 0;
    olharInclinacao = 0;
    viewer.trackedEntity = undefined;
    viewer.selectedEntity = undefined;
    scene.screenSpaceCameraController.enableInputs = false;
    hud.hidden = false;
    document.body.classList.add('em-cockpit');
    aoMudar.forEach((funcao) => funcao(true));
    return true;
  }

  function mostrarAviao(id, visivel) {
    const entidade = voos.fonte.entities.getById(id);
    if (entidade) entidade.show = visivel;
  }

  function sair() {
    if (!alvo) return;
    const ultimaPosicao = posicaoSuave && Cesium.Cartographic.fromCartesian(posicaoSuave);
    mostrarAviao(alvo, true);
    alvo = null;
    historico = [];
    scene.screenSpaceCameraController.enableInputs = true;
    hud.hidden = true;
    document.body.classList.remove('em-cockpit');
    if (ultimaPosicao) {
      camera.flyTo({
        destination: Cesium.Cartesian3.fromRadians(ultimaPosicao.longitude, ultimaPosicao.latitude, 60_000),
        duration: 1.5,
      });
    }
    aoMudar.forEach((funcao) => funcao(false));
  }

  // Avião no ar mais perto de um ponto (para entrar sem ter nenhum selecionado).
  function maisProximo(ponto, excluir) {
    const tempo = viewer.clock.currentTime;
    let melhor = null;
    let menor = Infinity;
    for (const id of voos.noAr()) {
      if (id === excluir) continue;
      const posicao = posicaoAtual(id, tempo);
      if (!posicao) continue;
      const distancia = Cesium.Cartesian3.distance(ponto, posicao);
      if (distancia < menor) {
        menor = distancia;
        melhor = id;
      }
    }
    return melhor;
  }

  function atualizarContatos(tempo) {
    const aqui = posicaoSuave;
    contatos = voos
      .noAr()
      .filter((id) => id !== alvo)
      .map((id) => ({ id, posicao: posicaoAtual(id, tempo) }))
      .filter(({ posicao }) => posicao)
      .map(({ id, posicao }) => ({ id, distancia: Cesium.Cartesian3.distance(aqui, posicao) }))
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, CONTATOS_NA_LISTA);

    lista.replaceChildren(
      ...contatos.map(({ id, distancia }) => {
        const item = document.createElement('li');
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.dataset.id = id;
        const nome = document.createElement('b');
        nome.textContent = voos.nome(id);
        const detalhes = document.createElement('span');
        detalhes.textContent = `${numero(distancia / 1000)} km · ${nivelDeVoo(voos.dados(id))}`;
        botao.append(nome, detalhes);
        item.append(botao);
        return item;
      }),
    );
  }

  function atualizarHud(voo, tempo) {
    const agora = performance.now();
    if (agora - ultimoHud < INTERVALO_HUD_MS) return;
    ultimoHud = agora;

    const rumo = Cesium.Math.toDegrees(rumoSuave + olharRumo);
    desenharFita(fita, ((rumo % 360) + 360) % 360);
    campos.voo.textContent = voos.nome(alvo);
    campos.modelo.textContent = voos.modelo(alvo);
    campos.velocidade.textContent = voo.speedKt != null ? numero(voo.speedKt) : '—';
    campos.rumo.textContent = String(Math.round(((Cesium.Math.toDegrees(rumoSuave) % 360) + 360) % 360)).padStart(3, '0');
    campos.altitude.textContent = voo.altitudeFt != null ? numero(voo.altitudeFt) : '—';
    const subida = voo.verticalRateFpm ?? 0;
    campos.vertical.textContent =
      Math.abs(subida) < 200 ? 'nivelado' : `${subida > 0 ? '▲' : '▼'} ${numero(Math.abs(subida))} pés/min`;
    if (agora - ultimosContatos > INTERVALO_CONTATOS_MS) {
      ultimosContatos = agora;
      atualizarContatos(tempo);
    }
  }

  scene.preRender.addEventListener((_, tempo) => {
    if (!alvo) return;
    const voo = voos.dados(alvo);
    const posicao = voo && posicaoAtual(alvo, tempo);
    if (!posicao) {
      // O avião saiu da área de cobertura: pula para o mais próximo.
      const proximo = posicaoSuave && maisProximo(posicaoSuave, alvo);
      if (!proximo || !entrar(proximo, { lembrar: false })) sair();
      return;
    }

    if (!posicaoSuave) posicaoSuave = Cesium.Cartesian3.clone(posicao);
    else Cesium.Cartesian3.lerp(posicaoSuave, posicao, SUAVIZACAO_POSICAO, posicaoSuave);

    // Nunca abaixo do relevo (a altitude barométrica pode ficar abaixo do chão perto de pistas altas).
    const geo = Cesium.Cartographic.fromCartesian(posicaoSuave);
    const chao = scene.globe.getHeight(geo) ?? 0;
    if (geo.height < chao + ALTURA_MINIMA_SOBRE_O_SOLO_M) {
      geo.height = chao + ALTURA_MINIMA_SOBRE_O_SOLO_M;
      Cesium.Cartographic.toCartesian(geo, undefined, posicaoSuave);
    }

    const rumo = Cesium.Math.toRadians(voo.track ?? Cesium.Math.toDegrees(rumoSuave));
    rumoSuave += diferencaAngular(rumo, rumoSuave) * SUAVIZACAO_RUMO;

    camera.setView({
      destination: posicaoSuave,
      orientation: {
        heading: rumoSuave + olharRumo,
        pitch: Cesium.Math.toRadians(INCLINACAO_PADRAO) + olharInclinacao,
        roll: 0,
      },
    });
    atualizarHud(voo, tempo);
  });

  hud.addEventListener('click', (evento) => {
    const botao = evento.target.closest('button');
    if (!botao) return;
    if (botao.dataset.id) entrar(botao.dataset.id);
    else if (botao.dataset.cockpitAcao === 'sair') sair();
    else if (botao.dataset.cockpitAcao === 'proximo' && contatos[0]) entrar(contatos[0].id);
    else if (botao.dataset.cockpitAcao === 'anterior' && historico.length) {
      entrar(historico.pop(), { lembrar: false });
    }
  });

  document.addEventListener('keydown', (evento) => {
    if (!alvo) return;
    const passo = Cesium.Math.toRadians(5);
    if (evento.key === 'Escape') sair();
    else if (evento.key === 'ArrowLeft') olharRumo -= passo;
    else if (evento.key === 'ArrowRight') olharRumo += passo;
    else if (evento.key === 'ArrowUp') olharInclinacao = Math.min(olharInclinacao + passo, Cesium.Math.toRadians(40));
    else if (evento.key === 'ArrowDown') olharInclinacao = Math.max(olharInclinacao - passo, Cesium.Math.toRadians(-60));
    else return;
    evento.preventDefault();
  });

  return {
    entrar,
    sair,
    ativo: () => Boolean(alvo),
    // Entra no avião selecionado ou, sem seleção, no mais próximo do centro da tela.
    entrarNoMaisProximo() {
      const selecionado = viewer.selectedEntity?.id;
      if (selecionado?.startsWith(voos.prefixo) && entrar(selecionado)) return true;
      const centro = new Cesium.Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
      const raio = camera.getPickRay(centro);
      const ponto = (raio && scene.globe.pick(raio, scene)) ?? camera.positionWC;
      const id = maisProximo(ponto);
      return id ? entrar(id) : false;
    },
    aoMudar: (funcao) => aoMudar.add(funcao),
  };
}
