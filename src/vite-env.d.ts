/// <reference types="vite/client" />

import type { MapEngine } from './map/engine';

declare global {
  interface Window {
    __mirante?: MapEngine;
  }
}
