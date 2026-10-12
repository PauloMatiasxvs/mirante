import { useEngine } from '../hooks/useMap';
import { CompassIcon, GlobeIcon, TiltIcon } from './icons';
import './MapControls.css';

export function MapControls() {
  const engine = useEngine();
  return (
    <div className="map-controls" role="toolbar" aria-label="Câmera">
      <button type="button" title="Norte para cima" aria-label="Norte para cima" onClick={() => engine.resetNorth()}>
        <CompassIcon />
      </button>
      <button
        type="button"
        title="Alternar visão de cima e inclinada"
        aria-label="Alternar visão de cima e inclinada"
        onClick={() => engine.toggleTilt()}
      >
        <TiltIcon />
      </button>
      <button type="button" title="Ver o planeta inteiro" aria-label="Ver o planeta inteiro" onClick={() => engine.goTo('planet')}>
        <GlobeIcon />
      </button>
    </div>
  );
}
