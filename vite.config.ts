import { fileURLToPath } from 'node:url';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import flights from './api/flights.ts';
import military from './api/military.ts';
import satellites from './api/satellites.ts';
import world from './api/world.ts';

const cesiumSource = 'node_modules/cesium/Build/Cesium';
const cesiumBaseUrl = 'cesium';

const API_ROUTES = {
  '/api/flights': flights,
  '/api/military': military,
  '/api/world': world,
  '/api/satellites': satellites,
};

// Mounts the serverless functions on the dev and preview servers, so the app
// runs locally without the Vercel CLI.
function localApi(): Plugin {
  const mount = (server: { middlewares: Connect.Server }) => {
    for (const [path, handler] of Object.entries(API_ROUTES)) {
      server.middlewares.use(path, (req, res, next) => {
        // Connect also matches prefixes like /api/flights.ts; only serve the route itself.
        if (req.url && !/^\/?(\?|$)/.test(req.url)) return next();
        void handler(req, res);
      });
    }
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
  resolve: {
    alias: [
      // The package's default entry is the unbuilt source, which keeps ~2000
      // debug-only argument checks in hot paths. The prebuilt bundle strips them.
      {
        find: /^cesium$/,
        replacement: fileURLToPath(new URL(`./${cesiumSource}/index.js`, import.meta.url)),
      },
    ],
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
  build: {
    // Cesium alone is ~4.8 MB minified (~1.4 MB gzipped).
    chunkSizeWarningLimit: 5_500,
  },
  server: {
    port: 5180,
  },
  preview: {
    port: 5180,
  },
});
