// Camada de voos: aviões ao vivo sobre o Brasil, vindos do adsb.lol via /api/flights.

import { numero } from '../formatos.js';
import { projetar } from '../geo.js';

const { Cesium } = window;

const INTERVALO_MS = 30_000;
const PES_EM_METROS = 0.3048;
const NOS_EM_MS = 0.514444;
// Por quanto tempo o avião segue "voando" sozinho entre uma atualização e outra.
const PROJECAO_S = 180;

// Modelos mais comuns nos céus brasileiros (código ICAO -> nome).
const MODELOS = {
  A319: 'Airbus A319',
  A320: 'Airbus A320',
  A20N: 'Airbus A320neo',
  A321: 'Airbus A321',
  A21N: 'Airbus A321neo',
  A332: 'Airbus A330-200',
  A339: 'Airbus A330-900neo',
  A359: 'Airbus A350-900',
  AT72: 'ATR 72',
  AT76: 'ATR 72-600',
  B737: 'Boeing 737-700',
  B738: 'Boeing 737-800',
  B38M: 'Boeing 737 MAX 8',
  B763: 'Boeing 767-300',
  B77W: 'Boeing 777-300ER',
  B788: 'Boeing 787-8',
  B789: 'Boeing 787-9',
  E190: 'Embraer E190',
  E195: 'Embraer E195',
  E295: 'Embraer E195-E2',
  E145: 'Embraer ERJ-145',
  E35L: 'Embraer Legacy 600',
  E55P: 'Embraer Phenom 300',
  C208: 'Cessna Caravan',
};

// Avião desenhado em SVG apontando para o norte; o Cesium gira pelo rumo.
const ICONE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
      '<path fill="#7dd3fc" stroke="#082f49" stroke-width="2.5" stroke-linejoin="round" ' +
      'd="M32 4c2.5 0 4 3 4 7v13l22 13v5l-22-7v15l7 5v4l-11-3-11 3v-4l7-5V35l-22 7v-5l22-13V11c0-4 1.5-7 4-7z"/>' +
      '</svg>',
  );

function altitudeEmMetros(voo) {
  if (voo.onGround) return 0;
  return Math.max(30, (voo.altitudeFt ?? 0) * PES_EM_METROS);
}

// Avião no chão fica colado ao relevo; no ar, usa a altitude informada.
function referenciaDeAltura(voo) {
  return voo.onGround ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE;
}

// Posição que se move sozinha: do último ponto conhecido até onde o avião
// estará daqui a alguns minutos, mantendo velocidade e rumo.
function trajetoria(voo, instante) {
  const altura = altitudeEmMetros(voo);
  const posicao = new Cesium.SampledPositionProperty();
  posicao.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
  posicao.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
  posicao.addSample(instante, Cesium.Cartesian3.fromDegrees(voo.lon, voo.lat, altura));

  if (!voo.onGround && voo.speedKt && voo.track != null) {
    const destino = projetar(voo.lat, voo.lon, voo.track, voo.speedKt * NOS_EM_MS * PROJECAO_S);
    posicao.addSample(
      Cesium.JulianDate.addSeconds(instante, PROJECAO_S, new Cesium.JulianDate()),
      Cesium.Cartesian3.fromDegrees(destino.lon, destino.lat, altura),
    );
  }
  return posicao;
}

function nomeDoVoo(voo) {
  return voo.callsign ?? voo.registration ?? voo.id.toUpperCase();
}

export function criarCamadaVoos(viewer, aoAtualizar) {
  const fonte = new Cesium.CustomDataSource('voos');
  viewer.dataSources.add(fonte);
  const voos = new Map();

  function sincronizar({ updatedAt, flights }) {
    const base = Date.parse(updatedAt) || Date.now();
    const vistos = new Set();

    fonte.entities.suspendEvents();
    for (const voo of flights) {
      const id = `voo-${voo.id}`;
      vistos.add(id);
      voos.set(id, voo);

      const instante = Cesium.JulianDate.fromDate(new Date(base - voo.seenSeconds * 1000));
      const position = trajetoria(voo, instante);
      const rotation = -Cesium.Math.toRadians(voo.track ?? 0);
      const existente = fonte.entities.getById(id);

      const heightReference = referenciaDeAltura(voo);

      if (existente) {
        existente.position = position;
        existente.billboard.rotation = rotation;
        existente.billboard.heightReference = heightReference;
        existente.label.heightReference = heightReference;
        existente.label.text = nomeDoVoo(voo);
        continue;
      }

      fonte.entities.add({
        id,
        position,
        billboard: {
          image: ICONE,
          heightReference,
          rotation,
          alignedAxis: Cesium.Cartesian3.UNIT_Z,
          scale: 0.5,
          scaleByDistance: new Cesium.NearFarScalar(2e4, 1.1, 8e6, 0.3),
        },
        label: {
          text: nomeDoVoo(voo),
          heightReference,
          font: '600 12px "JetBrains Mono", monospace',
          fillColor: Cesium.Color.fromCssColorString('#e0f2fe'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -24),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 400_000),
        },
      });
    }

    for (const id of [...voos.keys()]) {
      if (!vistos.has(id)) {
        voos.delete(id);
        fonte.entities.removeById(id);
      }
    }
    fonte.entities.resumeEvents();
  }

  async function atualizar() {
    try {
      const resposta = await fetch('/api/flights');
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      sincronizar(await resposta.json());
      aoAtualizar({ total: voos.size });
    } catch (erro) {
      console.warn('Voos indisponíveis:', erro);
      aoAtualizar({ erro: true });
    }
  }

  atualizar();
  setInterval(atualizar, INTERVALO_MS);

  return {
    prefixo: 'voo-',
    fonte,
    descrever(entidade) {
      const voo = voos.get(entidade.id);
      if (!voo) return null;
      const altitude = voo.onGround
        ? 'No solo'
        : voo.altitudeFt != null
          ? `${numero(voo.altitudeFt)} pés (${numero(voo.altitudeFt * PES_EM_METROS)} m)`
          : '—';
      const subida = voo.verticalRateFpm;
      return {
        tipo: 'Voo ao vivo',
        titulo: nomeDoVoo(voo),
        linhas: [
          ['Aeronave', MODELOS[voo.type] ?? voo.type ?? '—'],
          ['Matrícula', voo.registration ?? '—'],
          ['Altitude', altitude],
          [
            'Velocidade',
            voo.speedKt != null
              ? `${numero(voo.speedKt * 1.852)} km/h`
              : '—',
          ],
          ['Rumo', voo.track != null ? `${numero(voo.track)}°` : '—'],
          [
            'Vertical',
            subida == null || Math.abs(subida) < 200
              ? 'Nivelado'
              : `${subida > 0 ? 'Subindo' : 'Descendo'} ${numero(Math.abs(subida))} pés/min`,
          ],
        ],
        link: {
          url: `https://globe.adsb.lol/?icao=${encodeURIComponent(voo.id)}`,
          texto: 'Ver trajeto no adsb.lol ↗',
        },
      };
    },
  };
}
