// Cálculos geográficos simples, sem depender do Cesium.

const RAIO_TERRA_M = 6_371_000;
const RAD = Math.PI / 180;

// Ponto de chegada ao andar `distancia` metros a partir de (lat, lon) no `rumo` (graus).
export function projetar(lat, lon, rumo, distancia) {
  const angulo = distancia / RAIO_TERRA_M;
  const direcao = rumo * RAD;
  const lat1 = lat * RAD;
  const lon1 = lon * RAD;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angulo) + Math.cos(lat1) * Math.sin(angulo) * Math.cos(direcao),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(direcao) * Math.sin(angulo) * Math.cos(lat1),
      Math.cos(angulo) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: lat2 / RAD, lon: lon2 / RAD };
}

// Elevação do Sol (graus acima do horizonte) num local e instante, pela
// fórmula aproximada do Observatório Naval dos EUA (erro abaixo de 1°).
export function elevacaoDoSol(data, lat, lon) {
  const dias = data.getTime() / 86_400_000 - 10_957.5; // dias desde J2000
  const anomalia = (357.529 + 0.98560028 * dias) * RAD;
  const longitudeMedia = 280.459 + 0.98564736 * dias;
  const longitudeEcliptica =
    (longitudeMedia + 1.915 * Math.sin(anomalia) + 0.02 * Math.sin(2 * anomalia)) * RAD;
  const obliquidade = (23.439 - 0.00000036 * dias) * RAD;
  const declinacao = Math.asin(Math.sin(obliquidade) * Math.sin(longitudeEcliptica));
  const ascensaoReta = Math.atan2(
    Math.cos(obliquidade) * Math.sin(longitudeEcliptica),
    Math.cos(longitudeEcliptica),
  );
  const tempoSideral = (18.697374558 + 24.06570982441908 * dias) * 15; // graus
  const anguloHorario = (tempoSideral + lon) * RAD - ascensaoReta;
  const elevacao = Math.asin(
    Math.sin(lat * RAD) * Math.sin(declinacao) +
      Math.cos(lat * RAD) * Math.cos(declinacao) * Math.cos(anguloHorario),
  );
  return elevacao / RAD;
}
