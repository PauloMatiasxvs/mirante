import { useEffect } from 'react';
import { useEngine, useMapState } from '../hooks/useMap';
import { verticalTrend } from '../lib/aircraft';
import { formatInt } from '../lib/format';
import { normalizeDegrees } from '../lib/geo';
import './CockpitHud.css';

const PIXELS_PER_DEGREE = 6;
const CARDINALS: Record<number, string> = { 0: 'N', 90: 'L', 180: 'S', 270: 'O' };
const LOOK_STEP_DEG = 5;

function HeadingTape({ heading }: { heading: number }) {
  const start = Math.floor((heading - 50) / 5) * 5;
  const marks = Array.from({ length: 21 }, (_, i) => start + i * 5);
  return (
    <svg className="cockpit__tape" viewBox="-300 -12 600 46" aria-hidden="true">
      {marks.map((deg) => {
        const x = (deg - heading) * PIXELS_PER_DEGREE;
        const value = normalizeDegrees(deg);
        return (
          <g key={deg}>
            <line x1={x} x2={x} y1={2} y2={value % 10 === 0 ? 14 : 8} />
            {value % 30 === 0 && (
              <text x={x} y={28}>
                {CARDINALS[value] ?? String(value / 10).padStart(2, '0')}
              </text>
            )}
          </g>
        );
      })}
      <path className="cockpit__tape-index" d="M0 0 L-6 -9 H6 Z" />
    </svg>
  );
}

function verticalLabel(fpm: number | null) {
  const trend = verticalTrend(fpm);
  if (trend === 'level') return 'nivelado';
  return `${trend === 'climbing' ? '▲' : '▼'} ${formatInt(Math.abs(fpm ?? 0))} pés/min`;
}

export function CockpitHud() {
  const { cockpit } = useEngine();
  const state = useMapState((s) => s.cockpit);
  const active = state !== null;

  useEffect(() => {
    document.body.classList.toggle('in-cockpit', active);
    if (!active) return;
    const keys: Record<string, () => void> = {
      Escape: () => cockpit.exit(),
      ArrowLeft: () => cockpit.look(-LOOK_STEP_DEG, 0),
      ArrowRight: () => cockpit.look(LOOK_STEP_DEG, 0),
      ArrowUp: () => cockpit.look(0, LOOK_STEP_DEG),
      ArrowDown: () => cockpit.look(0, -LOOK_STEP_DEG),
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const action = keys[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('in-cockpit');
    };
  }, [active, cockpit]);

  if (!state) return null;

  return (
    <div className="cockpit">
      <p className="cockpit__title">
        <span className="cockpit__live">●</span> PRIMEIRA PESSOA · <b>{state.callsign}</b>{' '}
        <span className="cockpit__model">{state.model}</span>
      </p>
      <HeadingTape heading={state.viewHeading} />
      <svg className="cockpit__marker" viewBox="-40 -20 80 40" aria-hidden="true">
        <circle r={6} />
        <path d="M-32 0H-6M6 0H32M0-6V-15" />
      </svg>

      <div className="cockpit__readouts">
        <div>
          <small>Velocidade</small>
          <strong>{state.speedKt != null ? formatInt(state.speedKt) : '—'}</strong>
          <small>nós</small>
        </div>
        <div className="cockpit__heading">
          <small>Rumo</small>
          <strong>{String(Math.round(state.track) % 360).padStart(3, '0')}</strong>
          <small>graus</small>
        </div>
        <div>
          <small>Altitude</small>
          <strong>{state.altitudeFt != null ? formatInt(state.altitudeFt) : '—'}</strong>
          <small>{verticalLabel(state.verticalRateFpm)}</small>
        </div>
      </div>

      <aside className="cockpit__contacts">
        <h2>Aviões ao redor</h2>
        <ol>
          {state.contacts.map((contact) => (
            <li key={contact.id}>
              <button type="button" onClick={() => cockpit.enter(contact.id)}>
                <b>{contact.name}</b>
                <span>
                  {formatInt(contact.distanceKm)} km · {contact.level}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <div className="cockpit__actions">
        <button type="button" disabled={!state.canGoBack} onClick={() => cockpit.back()}>
          ◀ Anterior
        </button>
        <button type="button" onClick={() => cockpit.exit()}>
          Sair do cockpit
        </button>
        <button type="button" disabled={state.contacts.length === 0} onClick={() => cockpit.next()}>
          Próximo ▶
        </button>
      </div>
      <p className="cockpit__hint">Esc sai · setas olham em volta</p>
    </div>
  );
}
