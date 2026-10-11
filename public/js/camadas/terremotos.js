// Camada de terremotos: todos os sismos das últimas 24 horas, segundo o USGS.

import { numero, dataHora, haQuanto } from '../formatos.js';

const { Cesium } = window;

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson';
const INTERVALO_MS = 5 * 60_000;
const PERIODO_PULSO_S = 2.5;
const INICIO = Cesium.JulianDate.now();

function corDaMagnitude(magnitude) {
  if (magnitude >= 5) return Cesium.Color.fromCssColorString('#ef4444');
  if (magnitude >= 3) return Cesium.Color.fromCssColorString('#fb923c');
  return Cesium.Color.fromCssColorString('#facc15');
}

// Onda que se expande a partir dos sismos mais fortes. O raio depende só do
// instante recebido, então os dois eixos da elipse ficam sempre iguais.
function pulso(magnitude, cor) {
  const raioMaximo = 40_000 + magnitude * 35_000;
  const fase = (tempo) =>
    (Cesium.JulianDate.secondsDifference(tempo, INICIO) / PERIODO_PULSO_S) % 1;
  const raio = new Cesium.CallbackProperty((tempo) => 1_000 + fase(tempo) * raioMaximo, false);
  return {
    semiMajorAxis: raio,
    semiMinorAxis: raio,
    // Acima da maior parte do relevo, para a onda não sumir sob as montanhas.
    height: 4_000,
    material: new Cesium.ColorMaterialProperty(
      new Cesium.CallbackProperty((tempo) => cor.withAlpha(0.5 * (1 - fase(tempo))), false),
    ),
  };
}

export function criarCamadaTerremotos(viewer, aoAtualizar) {
  const fonte = new Cesium.CustomDataSource('terremotos');
  viewer.dataSources.add(fonte);
  const sismos = new Map();

  async function atualizar() {
    try {
      const resposta = await fetch(FEED);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const { features } = await resposta.json();

      fonte.entities.suspendEvents();
      fonte.entities.removeAll();
      sismos.clear();

      for (const sismo of features) {
        const [lon, lat] = sismo.geometry.coordinates;
        const magnitude = sismo.properties.mag ?? 0;
        const cor = corDaMagnitude(magnitude);
        const id = `sismo-${sismo.id}`;
        sismos.set(id, sismo);

        fonte.entities.add({
          id,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, 1_500),
          point: {
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            pixelSize: Math.max(6, 4 + magnitude * 3),
            color: cor.withAlpha(0.92),
            outlineColor: Cesium.Color.WHITE.withAlpha(0.85),
            outlineWidth: 1.5,
          },
          label:
            magnitude >= 4
              ? {
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                  text: `M${magnitude.toFixed(1)}`,
                  font: '600 12px "JetBrains Mono", monospace',
                  fillColor: Cesium.Color.WHITE,
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 3,
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  pixelOffset: new Cesium.Cartesian2(0, -18),
                }
              : undefined,
          ellipse: magnitude >= 4.5 ? pulso(magnitude, cor) : undefined,
        });
      }
      fonte.entities.resumeEvents();
      aoAtualizar({ total: sismos.size });
    } catch (erro) {
      console.warn('Terremotos indisponíveis:', erro);
      aoAtualizar({ erro: true });
    }
  }

  atualizar();
  setInterval(atualizar, INTERVALO_MS);

  return {
    prefixo: 'sismo-',
    fonte,
    descrever(entidade) {
      const sismo = sismos.get(entidade.id);
      if (!sismo) return null;
      const { mag, place, time, url } = sismo.properties;
      const profundidade = sismo.geometry.coordinates[2];
      return {
        tipo: 'Terremoto',
        titulo: `Magnitude ${(mag ?? 0).toFixed(1)}`,
        linhas: [
          ['Local', place ?? '—'],
          ['Quando', haQuanto(time)],
          ['Horário', dataHora(time)],
          ['Profundidade', profundidade != null ? `${numero(profundidade)} km` : '—'],
        ],
        link: url ? { url, texto: 'Detalhes no USGS ↗' } : null,
      };
    },
  };
}
