import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import flightsHandler from './api/flights.ts';

const cesiumSource = 'node_modules/cesium/Build/Cesium';
const cesiumBaseUrl = 'cesium';

// Mounts the serverless function on the dev and preview servers, so the app
// runs locally without the Vercel CLI.
function localApi(): Plugin {
  const mount = (server: { middlewares: Connect.Server }) => {
    server.middlewares.use('/api/flights', (req, res) => {
      void flightsHandler(req, res);
    });
  };
  return {
    name: 'local-api',
    configureServer: mount,
    configurePreviewServer: mount,
  };
}

export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`),
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: ['ThirdParty', 'Workers', 'Assets', 'Widgets'].map((dir) => ({
        src: `${cesiumSource}/${dir}`,
        dest: cesiumBaseUrl,
        // Drop "node_modules/cesium/Build/Cesium" so files land at /cesium/<dir>/...
        rename: { stripBase: 4 },
      })),
    }),
    localApi(),
  ],
  server: {
    port: 5180,
  },
});
