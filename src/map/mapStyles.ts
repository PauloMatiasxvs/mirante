import {
  createGooglePhotorealistic3DTileset,
  Credit,
  ImageryLayer,
  OpenStreetMapImageryProvider,
  UrlTemplateImageryProvider,
  type Cesium3DTileset,
  type Viewer,
} from 'cesium';

export type MapStyleId = 'satellite' | 'tactical' | 'streets' | 'photoreal';

export interface MapStyleOption {
  id: MapStyleId;
  label: string;
  hint: string;
}

const ESRI_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

// Browser key for the Map Tiles API. It ends up in the page by design, so it
// must be restricted to the site's domain in the Google Cloud console.
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export const MAP_STYLES: MapStyleOption[] = [
  { id: 'satellite', label: 'Satélite', hint: 'Imagens de satélite da Esri' },
  { id: 'tactical', label: 'Tático', hint: 'Satélite escurecido, para destacar os dados' },
  { id: 'streets', label: 'Ruas', hint: 'OpenStreetMap, com nomes no idioma local' },
  ...(GOOGLE_KEY
    ? [{ id: 'photoreal' as const, label: 'Fotorrealista', hint: 'Cidades em 3D do Google' }]
    : []),
];

function esriImagery() {
  return new UrlTemplateImageryProvider({
    url: ESRI_IMAGERY,
    maximumLevel: 19,
    credit: new Credit('Imagens © Esri, Maxar, Earthstar Geographics'),
  });
}

/**
 * Switches the globe's base imagery, and the Google photorealistic tileset when
 * a key is configured. While photorealistic tiles are on, the plain globe and
 * the OpenStreetMap building extrusions are hidden, since Google already has
 * real buildings everywhere.
 */
export function createMapStyles(viewer: Viewer, onPhotorealChange: (on: boolean) => void) {
  const { scene } = viewer;
  let tileset: Cesium3DTileset | null = null;
  let current: MapStyleId = 'satellite';

  function setImagery(id: Exclude<MapStyleId, 'photoreal'>) {
    viewer.imageryLayers.removeAll();
    const layer =
      id === 'streets'
        ? new ImageryLayer(new OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' }))
        : new ImageryLayer(esriImagery());
    if (id === 'tactical') {
      layer.brightness = 0.5;
      layer.contrast = 1.35;
      layer.saturation = 0.35;
      layer.gamma = 1.15;
    }
    viewer.imageryLayers.add(layer, 0);
  }

  async function showPhotoreal(on: boolean) {
    if (on && !tileset && GOOGLE_KEY) {
      tileset = await createGooglePhotorealistic3DTileset({ key: GOOGLE_KEY });
      if (viewer.isDestroyed()) return;
      scene.primitives.add(tileset);
    }
    if (tileset) tileset.show = on;
    scene.globe.show = !on;
    onPhotorealChange(on);
  }

  setImagery('satellite');

  return {
    get current() {
      return current;
    },
    async apply(id: MapStyleId) {
      current = id;
      if (id === 'photoreal') {
        await showPhotoreal(true);
        return;
      }
      await showPhotoreal(false);
      setImagery(id);
      scene.requestRender();
    },
  };
}
