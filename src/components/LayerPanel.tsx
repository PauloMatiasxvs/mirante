import { useState, type ComponentType } from 'react';
import { useClock } from '../hooks/useClock';
import { useEngine, useMapState } from '../hooks/useMap';
import type { LayerId, LayerStatus } from '../map/types';
import { BuildingIcon, GlobeIcon, JetIcon, LayersIcon, PlaneIcon, QuakeIcon, SatelliteIcon } from './icons';
import './LayerPanel.css';

const LAYERS: Array<{ id: LayerId; label: string; source: string; Icon: ComponentType }> = [
  { id: 'flights', label: 'Voos no Brasil', source: 'adsb.lol', Icon: PlaneIcon },
  { id: 'military', label: 'Voos militares', source: 'adsb.lol', Icon: JetIcon },
  { id: 'world', label: 'Voos no mundo', source: 'OpenSky', Icon: GlobeIcon },
  { id: 'satellites', label: 'Satélites', source: 'CelesTrak', Icon: SatelliteIcon },
  { id: 'earthquakes', label: 'Terremotos (24 h)', source: 'USGS', Icon: QuakeIcon },
  { id: 'buildings', label: 'Prédios em 3D', source: 'OpenStreetMap', Icon: BuildingIcon },
];

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

function freshness({ count, error, updatedAt }: LayerStatus, now: number) {
  if (error && !count) return 'indisponível';
  if (count === null) return 'carregando…';
  if (!updatedAt) return 'aguardando';
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 60) return `há ${seconds} s`;
  return `há ${Math.floor(seconds / 60)} min`;
}

export function LayerPanel() {
  const engine = useEngine();
  const now = useClock().getTime();
  const layers = useMapState((state) => state.layers);
  // Starts collapsed on phones, where it would cover most of the globe.
  const [open, setOpen] = useState(() => window.innerWidth > 720);
  const [visible, setVisible] = useState<Record<LayerId, boolean>>(
    () => Object.fromEntries(LAYERS.map(({ id }) => [id, true])) as Record<LayerId, boolean>,
  );

  function toggle(id: LayerId) {
    const next = !visible[id];
    engine.setLayerVisible(id, next);
    setVisible((current) => ({ ...current, [id]: next }));
  }

  return (
    <section className={`layer-panel panel ${open ? '' : 'layer-panel--closed'}`} aria-label="Camadas de dados">
      <button type="button" className="layer-panel__header" aria-expanded={open} onClick={() => setOpen(!open)}>
        <LayersIcon />
        <span className="hud-label">Camadas de dados</span>
        <span className="layer-panel__chevron">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <ul className="layer-panel__list">
          {LAYERS.map(({ id, label, source, Icon }) => {
            const status = layers[id];
            const on = visible[id];
            return (
              <li key={id} className={on ? undefined : 'layer-panel__item--off'}>
                <span className={`layer-panel__icon layer-panel__icon--${id}`}>
                  <Icon />
                </span>
                <span className="layer-panel__name">
                  <b>{label}</b>
                  <small>
                    {source} · {freshness(status, now)}
                  </small>
                </span>
                <span className="layer-panel__count">{status.count ? compact.format(status.count) : '—'}</span>
                <button
                  type="button"
                  className={on ? 'toggle toggle--on' : 'toggle'}
                  aria-pressed={on}
                  aria-label={`${on ? 'Desligar' : 'Ligar'} ${label}`}
                  onClick={() => toggle(id)}
                >
                  {on ? 'LIG' : 'DESL'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
