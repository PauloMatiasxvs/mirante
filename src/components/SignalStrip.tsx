import { useMapState } from '../hooks/useMap';
import type { LayerId, LayerStatus } from '../map/types';
import './SignalStrip.css';

const COUNTERS: Array<{ id: LayerId; label: string }> = [
  { id: 'flights', label: 'VOOS BR' },
  { id: 'military', label: 'MIL' },
  { id: 'world', label: 'MUNDO' },
  { id: 'satellites', label: 'SAT' },
  { id: 'earthquakes', label: 'SISMOS' },
  { id: 'buildings', label: 'PRÉDIOS' },
];

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

function value({ count, error }: LayerStatus) {
  if (count) return compact.format(count);
  if (error) return 'OFF';
  return count === 0 ? '—' : '…';
}

/** Live counters in the margin above the screen frame. */
export function SignalStrip() {
  const layers = useMapState((state) => state.layers);
  return (
    <div className="signal-strip">
      <p>
        <span className="signal-strip__live">● AO VIVO</span>
        {COUNTERS.map(({ id, label }) => (
          <span key={id} className={layers[id].error && !layers[id].count ? 'signal-strip__off' : undefined}>
            {label} <b>{value(layers[id])}</b>
          </span>
        ))}
      </p>
      <p className="signal-strip__right">MIRANTE · DADOS ABERTOS · SEM CHAVES DE API</p>
    </div>
  );
}
