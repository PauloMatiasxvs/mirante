// Cidades com prédios em 3D. Usado pelo site (câmera e camada de prédios) e
// pelo script scripts/baixar-predios.mjs (área a baixar do OpenStreetMap).
//
// `vista` posiciona a câmera: ela fica recuada do alvo e olha para ele com o
// rumo (graus, 0 = norte) e a inclinação (graus abaixo do horizonte) indicados.

export const CIDADES = {
  fortaleza: {
    nome: 'Fortaleza',
    alvo: { lat: -3.7262, lon: -38.4985 },
    // Vista do mar para os prédios da Beira-Mar.
    vista: { altura: 900, inclinacao: -24, rumo: 170 },
    area: { oeste: -38.508, sul: -3.738, leste: -38.49, norte: -3.722 },
  },
  saopaulo: {
    nome: 'São Paulo',
    alvo: { lat: -23.5614, lon: -46.6565 },
    // Avenida Paulista vista do Paraíso em direção à Consolação.
    vista: { altura: 1250, inclinacao: -26, rumo: 305 },
    area: { oeste: -46.666, sul: -23.57, leste: -46.648, norte: -23.554 },
  },
  rio: {
    nome: 'Rio de Janeiro',
    alvo: { lat: -22.97, lon: -43.184 },
    // Copacabana vista do mar, com os morros ao fundo.
    vista: { altura: 1000, inclinacao: -22, rumo: 300 },
    area: { oeste: -43.194, sul: -22.982, leste: -43.176, norte: -22.964 },
  },
};
