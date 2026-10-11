// Nomes de países, cidades e mares em português e as fronteiras, desenhados
// pelo próprio Mirante a partir do Natural Earth (domínio público). As
// camadas prontas de rótulos disponíveis sem chave só existem em inglês.

const { Cesium } = window;

const BRANCO = Cesium.Color.WHITE;
const CONTORNO = Cesium.Color.BLACK.withAlpha(0.85);
const COR_MAR = Cesium.Color.fromCssColorString('#bae6fd').withAlpha(0.8);

// Até que distância da câmera (m) cada nome aparece, pela importância.
function alcanceDoPais(nivel) {
  if (nivel <= 2) return 3.5e7;
  if (nivel <= 3) return 1.6e7;
  if (nivel <= 4) return 9e6;
  return 5e6;
}

function alcanceDaCidade(importancia, doBrasil) {
  const alcance = importancia <= 1 ? 6e6 : importancia <= 3 ? 3e6 : importancia <= 5 ? 1.4e6 : 7e5;
  return doBrasil ? alcance * 2 : alcance;
}

const estiloDoTexto = {
  outlineColor: CONTORNO,
  outlineWidth: 3,
  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
  horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
};

function desenharLinhas(scene, listas, largura, cor) {
  const instancias = listas
    .filter((lista) => lista.length >= 4)
    .map(
      (lista) =>
        new Cesium.GeometryInstance({
          geometry: new Cesium.GroundPolylineGeometry({
            positions: Cesium.Cartesian3.fromDegreesArray(lista),
            width: largura,
          }),
        }),
    );
  scene.groundPrimitives.add(
    new Cesium.GroundPolylinePrimitive({
      geometryInstances: instancias,
      appearance: new Cesium.PolylineMaterialAppearance({
        material: Cesium.Material.fromType('Color', { color: cor }),
      }),
    }),
  );
}

export async function criarMapaBase(viewer) {
  const { scene } = viewer;
  const [rotulos, fronteiras] = await Promise.all(
    ['dados/rotulos.json', 'dados/fronteiras.json'].map((url) =>
      fetch(url).then((resposta) => resposta.json()),
    ),
  );

  desenharLinhas(scene, fronteiras.paises, 1.5, BRANCO.withAlpha(0.55));
  desenharLinhas(scene, fronteiras.estados, 1, BRANCO.withAlpha(0.28));

  const textos = scene.primitives.add(new Cesium.LabelCollection());
  const pontos = scene.primitives.add(new Cesium.PointPrimitiveCollection());

  for (const [nome, lon, lat, nivel] of rotulos.paises) {
    textos.add({
      ...estiloDoTexto,
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 8_000),
      text: nome.toUpperCase(),
      font: '600 13px Inter, sans-serif',
      fillColor: BRANCO.withAlpha(0.92),
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(8e5, alcanceDoPais(nivel)),
    });
  }

  for (const [nome, lon, lat] of rotulos.mares) {
    textos.add({
      ...estiloDoTexto,
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      text: nome,
      font: 'italic 500 13px Inter, sans-serif',
      fillColor: COR_MAR,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(2e6, 4e7),
    });
  }

  for (const [nome, lon, lat, importancia, doBrasil] of rotulos.cidades) {
    // Um pouco acima do chão para não sumir sob o relevo (as cidades
    // brasileiras são mais baixas que as andinas).
    const posicao = Cesium.Cartesian3.fromDegrees(lon, lat, doBrasil ? 1_500 : 4_500);
    const visivel = new Cesium.DistanceDisplayCondition(25_000, alcanceDaCidade(importancia, doBrasil));
    pontos.add({
      position: posicao,
      pixelSize: importancia <= 1 ? 5 : 4,
      color: BRANCO.withAlpha(0.9),
      outlineColor: CONTORNO,
      outlineWidth: 1,
      distanceDisplayCondition: visivel,
    });
    textos.add({
      ...estiloDoTexto,
      position: posicao,
      text: nome,
      font: `${importancia <= 1 ? 600 : 500} 12px Inter, sans-serif`,
      fillColor: Cesium.Color.fromCssColorString('#e2e8f0'),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -7),
      distanceDisplayCondition: visivel,
    });
  }
}
