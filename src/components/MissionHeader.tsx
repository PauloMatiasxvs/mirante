import { useMapState } from '../hooks/useMap';
import { formatDistance, formatInt } from '../lib/format';
import type { VisionMode } from '../map/types';
import './MissionHeader.css';

export const VISION_LABELS: Record<VisionMode, string> = {
  normal: 'NORMAL',
  crt: 'CRT',
  night: 'VISÃO NOTURNA',
  thermal: 'TÉRMICA',
  noir: 'NOIR',
};

const hemisphere = (value: number, positive: string, negative: string) =>
  `${Math.abs(value).toFixed(1)}${value >= 0 ? positive : negative}`;

/** Brand, active vision mode and a one-line summary of what the lens sees. */
export function MissionHeader() {
  const mode = useMapState((state) => state.visionMode);
  const telemetry = useMapState((state) => state.telemetry);
  const target = telemetry?.target;

  const where = target
    ? target.nearby
      ? `PERTO DE ${target.nearby.name.toUpperCase()} ${formatInt(target.nearby.distanceKm)} KM`
      : `SETOR ${hemisphere(target.lat, 'N', 'S')} ${hemisphere(target.lon, 'L', 'O')}`
    : 'ESPAÇO';
  const summary = telemetry
    ? [
        telemetry.band,
        where,
        target?.region,
        `ALT ${formatDistance(telemetry.cameraHeight).toUpperCase()}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : '—';

  return (
    <header className="mission">
      <div className="mission__brand">
        <img src="/favicon.svg" alt="" width={36} height={36} />
        <div>
          <h1>
            MIRANTE <span>BR</span>
          </h1>
          <p className="hud-label">O planeta em tempo real</p>
        </div>
      </div>

      <div className="mission__block">
        <p className="mission__line mission__line--accent">FONTES ABERTAS // ADS-B · USGS · CELESTRAK</p>
        <p className="mission__line">MRT-1 · SENSOR ÓPTICO · SEM CHAVES</p>
        <p className="mission__mode">{VISION_LABELS[mode]}</p>
        <p className="hud-label">Resumo</p>
        <p className="mission__line mission__summary">{summary}</p>
      </div>
    </header>
  );
}
