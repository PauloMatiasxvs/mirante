import { useEngine, useMapState } from '../hooks/useMap';
import { formatInt } from '../lib/format';
import type { FlightKind } from '../map/engine';
import './TrafficPanel.css';

const KINDS: Array<{ kind: FlightKind; label: string }> = [
  { kind: 'flight', label: 'Brasil' },
  { kind: 'military', label: 'Militares' },
  { kind: 'world', label: 'Mundo' },
];

export function TrafficPanel() {
  const engine = useEngine();
  const traffic = useMapState((state) => state.traffic);
  if (!traffic) return null;

  const total = traffic.counts.flight + traffic.counts.military + traffic.counts.world;

  return (
    <section className="traffic panel" aria-label="Aviões ao redor">
      <header className="traffic__header">
        <h2>Sinais ao vivo</h2>
        <span>raio {formatInt(traffic.radiusKm)} km</span>
      </header>
      <p className="traffic__total">
        <strong>{formatInt(total)}</strong> no ar
      </p>
      <ul className="traffic__counts">
        {KINDS.map(({ kind, label }) => (
          <li key={kind}>
            <i className={`dot dot--${kind}`} />
            {label} <b>{formatInt(traffic.counts[kind])}</b>
          </li>
        ))}
      </ul>
      {traffic.items.length > 0 ? (
        <ol className="traffic__list">
          {traffic.items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => engine.focusFlight(item.id)}>
                <i className={`dot dot--${item.kind}`} />
                <span className="traffic__name">
                  <b>{item.name}</b>
                  <small>{item.detail}</small>
                </span>
                <span className="traffic__meta">
                  {item.level}
                  <small>{formatInt(item.distanceKm)} km</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="traffic__empty">Nenhum avião nesta área agora.</p>
      )}
    </section>
  );
}
