import { useEffect, useState } from 'react';
import { useEngine, useMapState } from '../hooks/useMap';
import { MAP_STYLES } from '../map/mapStyles';
import type { Destination, VisionMode } from '../map/types';
import { CockpitIcon, MapStyleIcons, PinIcon, PresetIcons } from './icons';
import './Dock.css';

const DESTINATIONS: Array<{ id: Destination; label: string; hint: string }> = [
  { id: 'brazil', label: 'Brasil', hint: 'Visão do país' },
  { id: 'planet', label: 'Planeta', hint: 'Globo inteiro' },
  { id: 'sao-paulo', label: 'São Paulo', hint: 'Av. Paulista em 3D' },
  { id: 'rio-de-janeiro', label: 'Rio de Janeiro', hint: 'Copacabana em 3D' },
  { id: 'fortaleza', label: 'Fortaleza', hint: 'Beira-Mar em 3D' },
  { id: 'iss', label: 'Seguir a ISS', hint: 'Estação Espacial' },
];

const MODES: Array<{ id: VisionMode; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'crt', label: 'CRT' },
  { id: 'night', label: 'Noturna' },
  { id: 'thermal', label: 'Térmica' },
  { id: 'noir', label: 'Noir' },
];

type Tray = 'destinations' | 'styles' | null;

export function Dock() {
  const engine = useEngine();
  const mode = useMapState((state) => state.visionMode);
  const mapStyle = useMapState((state) => state.mapStyle);
  const visor = useMapState((state) => state.visor);
  const inCockpit = useMapState((state) => state.cockpit !== null);
  const [tray, setTray] = useState<Tray>(null);

  useEffect(() => {
    if (!tray) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setTray(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tray]);

  const toggleTray = (next: Exclude<Tray, null>) => setTray((current) => (current === next ? null : next));

  return (
    <div className="dock">
      {tray === 'destinations' && (
        <div className="dock__tray panel" role="menu" aria-label="Ir para">
          <p className="hud-label dock__tray-title">Ir para</p>
          <div className="dock__grid dock__grid--wide">
            {DESTINATIONS.map(({ id, label, hint }) => (
              <button
                key={id}
                type="button"
                className="dock__tile dock__tile--text"
                onClick={() => {
                  engine.goTo(id);
                  setTray(null);
                }}
              >
                <b>{label}</b>
                <small>{hint}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {tray === 'styles' && (
        <div className="dock__tray panel" role="menu" aria-label="Estilos visuais">
          <p className="hud-label dock__tray-title">Estilo visual</p>
          <div className="dock__grid">
            {MODES.map(({ id, label }) => {
              const Icon = PresetIcons[id];
              return (
                <button
                  key={id}
                  type="button"
                  className={mode === id ? 'dock__tile dock__tile--active' : 'dock__tile'}
                  aria-pressed={mode === id}
                  onClick={() => engine.setVisionMode(id)}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <p className="hud-label dock__tray-title">Base do mapa</p>
          <div className="dock__grid">
            {MAP_STYLES.map(({ id, label, hint }) => {
              const Icon = MapStyleIcons[id];
              return (
                <button
                  key={id}
                  type="button"
                  title={hint}
                  className={mapStyle === id ? 'dock__tile dock__tile--active' : 'dock__tile'}
                  aria-pressed={mapStyle === id}
                  onClick={() => engine.setMapStyle(id)}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              );
            })}
            <button
              type="button"
              className={visor ? 'dock__tile dock__tile--active' : 'dock__tile'}
              aria-pressed={visor}
              onClick={() => engine.setVisor(!visor)}
            >
              <PresetIcons.normal />
              <span>Lente</span>
            </button>
          </div>
        </div>
      )}

      <nav className="dock__bar" aria-label="Navegação">
        <button
          type="button"
          className={tray === 'destinations' ? 'dock__pod dock__pod--open' : 'dock__pod'}
          aria-expanded={tray === 'destinations'}
          onClick={() => toggleTray('destinations')}
        >
          <PinIcon />
          Destinos
        </button>
        <button
          type="button"
          className={inCockpit ? 'dock__cockpit dock__cockpit--active' : 'dock__cockpit'}
          aria-pressed={inCockpit}
          title={inCockpit ? 'Sair do cockpit' : 'Entrar no cockpit do avião selecionado ou mais próximo'}
          onClick={() => {
            setTray(null);
            if (engine.cockpit.active) engine.cockpit.exit();
            else engine.enterCockpit();
          }}
        >
          <CockpitIcon />
          <small>{inCockpit ? 'Sair' : 'Cockpit'}</small>
        </button>
        <button
          type="button"
          className={tray === 'styles' ? 'dock__pod dock__pod--open' : 'dock__pod'}
          aria-expanded={tray === 'styles'}
          onClick={() => toggleTray('styles')}
        >
          <PresetIcons.crt />
          Estilos visuais
        </button>
      </nav>
    </div>
  );
}
