import { useEngine, useMapState } from '../hooks/useMap';
import type { Destination, VisionMode } from '../map/types';
import './Dock.css';

const DESTINATIONS: Array<{ id: Destination; label: string }> = [
  { id: 'brazil', label: 'Brasil' },
  { id: 'planet', label: 'Planeta' },
  { id: 'sao-paulo', label: 'São Paulo' },
  { id: 'rio-de-janeiro', label: 'Rio' },
  { id: 'fortaleza', label: 'Fortaleza' },
  { id: 'iss', label: 'ISS' },
];

const MODES: Array<{ id: VisionMode; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'night', label: 'Noturna' },
  { id: 'thermal', label: 'Térmica' },
];

function DockButton({ active, onClick, children }: { active?: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" className={active ? 'dock__button dock__button--active' : 'dock__button'} onClick={onClick}>
      {children}
    </button>
  );
}

export function Dock() {
  const engine = useEngine();
  const mode = useMapState((state) => state.visionMode);
  const visor = useMapState((state) => state.visor);
  const inCockpit = useMapState((state) => state.cockpit !== null);

  return (
    <nav className="dock" aria-label="Destinos e modos de visão">
      <div className="dock__group" role="group" aria-label="Ir para">
        {DESTINATIONS.map(({ id, label }) => (
          <DockButton key={id} onClick={() => engine.goTo(id)}>
            {label}
          </DockButton>
        ))}
        <DockButton
          active={inCockpit}
          onClick={() => (engine.cockpit.active ? engine.cockpit.exit() : engine.cockpit.enterNearest())}
        >
          Cockpit
        </DockButton>
      </div>
      <span className="dock__divider" aria-hidden="true" />
      <div className="dock__group" role="group" aria-label="Modo de visão">
        {MODES.map(({ id, label }) => (
          <DockButton key={id} active={mode === id} onClick={() => engine.setVisionMode(id)}>
            {label}
          </DockButton>
        ))}
        <DockButton active={visor} onClick={() => engine.setVisor(!visor)}>
          Visor
        </DockButton>
      </div>
    </nav>
  );
}
