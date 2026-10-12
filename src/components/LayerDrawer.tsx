import { useState } from 'react';
import { useEngine } from '../hooks/useMap';
import type { LayerId } from '../map/types';
import './LayerDrawer.css';

const LAYERS: Array<{ id: LayerId; label: string }> = [
  { id: 'flights', label: 'Voos no Brasil' },
  { id: 'military', label: 'Voos militares' },
  { id: 'world', label: 'Voos no mundo' },
  { id: 'earthquakes', label: 'Terremotos (24 h)' },
  { id: 'satellites', label: 'Satélites e estações' },
  { id: 'buildings', label: 'Prédios em 3D' },
];

export function LayerDrawer() {
  const engine = useEngine();
  const [visible, setVisible] = useState<Record<LayerId, boolean>>(
    () => Object.fromEntries(LAYERS.map(({ id }) => [id, true])) as Record<LayerId, boolean>,
  );

  function toggle(id: LayerId, value: boolean) {
    engine.setLayerVisible(id, value);
    setVisible((current) => ({ ...current, [id]: value }));
  }

  return (
    <details className="drawer">
      <summary className="drawer__title">Camadas</summary>
      {LAYERS.map(({ id, label }) => (
        <label key={id} className="drawer__item">
          <input type="checkbox" checked={visible[id]} onChange={(event) => toggle(id, event.target.checked)} />
          <i className={`dot dot--${id}`} />
          <span>{label}</span>
        </label>
      ))}
    </details>
  );
}
