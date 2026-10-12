import { useEngine, useMapState } from '../hooks/useMap';
import './InfoCard.css';

export function InfoCard() {
  const engine = useEngine();
  const info = useMapState((state) => state.selection);
  if (!info) return null;

  const safeLink = info.link?.url.startsWith('https://') ? info.link : undefined;
  const target = info.cockpitTarget;

  return (
    <article className="info-card" aria-live="polite">
      <button type="button" className="info-card__close" aria-label="Fechar" onClick={() => engine.clearSelection()}>
        ×
      </button>
      <p className="info-card__kind">{info.kind}</p>
      <h3 className="info-card__title">{info.title}</h3>
      <dl className="info-card__rows">
        {info.rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {safeLink && (
        <a className="info-card__link" href={safeLink.url} target="_blank" rel="noreferrer">
          {safeLink.label}
        </a>
      )}
      {target && (
        <button type="button" className="info-card__action" onClick={() => engine.cockpit.enter(target)}>
          Entrar no cockpit
        </button>
      )}
    </article>
  );
}
