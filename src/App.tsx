import { useEffect, useState } from 'react';
import { Brand } from './components/Brand';
import { CockpitHud } from './components/CockpitHud';
import { Dock } from './components/Dock';
import { Globe } from './components/Globe';
import { InfoCard } from './components/InfoCard';
import { LayerDrawer } from './components/LayerDrawer';
import { StatusBar } from './components/StatusBar';
import { Visor } from './components/Visor';
import { MapContext, useMapState } from './hooks/useMap';
import type { MapEngine } from './map/engine';

// The UI accent color follows the vision mode (see global.css).
function VisionTheme() {
  const mode = useMapState((state) => state.visionMode);
  useEffect(() => {
    document.body.dataset.mode = mode;
  }, [mode]);
  return null;
}

export function App() {
  const [engine, setEngine] = useState<MapEngine | null>(null);

  return (
    <MapContext.Provider value={engine}>
      <Globe onReady={setEngine} />
      <Brand />
      {engine && (
        <>
          <VisionTheme />
          <Visor />
          <CockpitHud />
          <StatusBar />
          <LayerDrawer />
          <InfoCard />
          <Dock />
        </>
      )}
    </MapContext.Provider>
  );
}
