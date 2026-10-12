import { useEffect, useRef } from 'react';
import { createMapEngine, type MapEngine } from '../map/engine';
import './Globe.css';

interface Props {
  onReady: (engine: MapEngine | null) => void;
}

export function Globe({ onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const creditsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const engine = createMapEngine({
      container: containerRef.current!,
      creditContainer: creditsRef.current!,
    });
    onReady(engine);
    // Handy for poking at the map from devtools; stripped from production builds.
    if (import.meta.env.DEV) window.__mirante = engine;
    return () => {
      onReady(null);
      engine.destroy();
    };
  }, [onReady]);

  return (
    <>
      <div ref={containerRef} className="globe" />
      <div className="vignette" aria-hidden="true" />
      <footer className="credits">
        <div ref={creditsRef} className="credits__cesium" />
        <span>
          <a href="https://adsb.lol" target="_blank" rel="noreferrer">adsb.lol</a> ·{' '}
          <a href="https://opensky-network.org" target="_blank" rel="noreferrer">OpenSky</a> ·{' '}
          <a href="https://earthquake.usgs.gov" target="_blank" rel="noreferrer">USGS</a> ·{' '}
          <a href="https://celestrak.org" target="_blank" rel="noreferrer">CelesTrak</a> ·{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> ·
          Natural Earth · Esri
        </span>
      </footer>
    </>
  );
}
