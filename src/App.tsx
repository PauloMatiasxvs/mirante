import { useEffect, useState } from 'react';
import { CockpitHud } from './components/CockpitHud';
import { CoordReadout } from './components/CoordReadout';
import { Dock } from './components/Dock';
import { EdgeText } from './components/EdgeText';
import { Globe } from './components/Globe';
import { LayerPanel } from './components/LayerPanel';
import { MapControls } from './components/MapControls';
import { MissionHeader } from './components/MissionHeader';
import { RecBadge } from './components/RecBadge';
import { RightRail } from './components/RightRail';
import { SignalStrip } from './components/SignalStrip';
import { Visor } from './components/Visor';
import { MapContext, useMapState } from './hooks/useMap';
import type { MapEngine } from './map/engine';
import './App.css';

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
      {engine && <SignalStrip />}
      <main className="screen">
        <Globe onReady={setEngine} />
        <span className="screen__corner screen__corner--tl" aria-hidden="true" />
        <span className="screen__corner screen__corner--tr" aria-hidden="true" />
        <span className="screen__corner screen__corner--bl" aria-hidden="true" />
        <span className="screen__corner screen__corner--br" aria-hidden="true" />
        {engine ? (
          <>
            <VisionTheme />
            <Visor />
            <MissionHeader />
            <RecBadge />
            <MapControls />
            <LayerPanel />
            <RightRail />
            <CoordReadout />
            <EdgeText />
            <CockpitHud />
            <Dock />
          </>
        ) : (
          <p className="screen__boot hud-label">Inicializando o globo…</p>
        )}
      </main>
    </MapContext.Provider>
  );
}
