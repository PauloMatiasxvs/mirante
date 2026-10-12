import { useClock } from '../hooks/useClock';
import { useMapState } from '../hooks/useMap';
import { formatDecimal, formatDistance, formatDms, formatGroundResolution, formatInt } from '../lib/format';
import { normalizeDegrees } from '../lib/geo';
import './Visor.css';

const utc = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const CARDINALS: Array<[number, string]> = [
  [0, 'N'],
  [90, 'L'],
  [180, 'S'],
  [270, 'O'],
];

// Static compass ring: ticks every 5°, longer every 30°. It rotates as a whole.
const COMPASS = (
  <>
    <circle className="visor__rim" r={99.5} />
    {Array.from({ length: 72 }, (_, i) => i * 5).map((deg) => (
      <line
        key={deg}
        y1={-99}
        y2={deg % 30 === 0 ? -90 : -95}
        transform={`rotate(${deg})`}
        className={deg % 30 === 0 ? 'visor__tick visor__tick--major' : 'visor__tick'}
      />
    ))}
    {CARDINALS.map(([deg, letter]) => (
      <text key={letter} y={-82} transform={`rotate(${deg})`}>
        {letter}
      </text>
    ))}
  </>
);

function Readout({ items }: { items: Array<[string, string]> }) {
  return (
    <>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </>
  );
}

export function Visor() {
  const now = useClock();
  const visor = useMapState((state) => state.visor);
  const inCockpit = useMapState((state) => state.cockpit !== null);
  const telemetry = useMapState((state) => state.telemetry);
  if (!visor || inCockpit) return null;

  const target = telemetry?.target;
  const dash = '—';

  return (
    <div className="visor">
      <svg
        className="visor__compass"
        viewBox="-100 -100 200 200"
        style={{ transform: `rotate(${-(telemetry?.heading ?? 0)}deg)` }}
        aria-hidden="true"
      >
        {COMPASS}
      </svg>
      <svg className="visor__reticle" viewBox="-60 -60 120 120" aria-hidden="true">
        <path d="M-60 0H-14M14 0H60M0-60V-14M0 14V60" />
        <path d="M-32-24V-32H-24M24-32H32V-24M32 24V32H24M-24 32H-32V24" />
        <circle r={2} />
      </svg>
      <p className="visor__header">
        <span className="visor__rec">●</span> REC {utc.format(now)}Z
      </p>
      <dl className="visor__data visor__data--left">
        <Readout
          items={[
            ['Alvo', target ? `${formatDms(target.lat, 'N', 'S')} ${formatDms(target.lon, 'L', 'O')}` : dash],
            ['Solo', target ? `${formatInt(target.ground)} m` : dash],
            ['Altitude', telemetry ? formatDistance(telemetry.cameraHeight) : dash],
            ['Distância', target ? formatDistance(target.distance) : dash],
          ]}
        />
      </dl>
      <dl className="visor__data visor__data--right">
        <Readout
          items={[
            ['Rumo', telemetry ? `${String(Math.round(normalizeDegrees(telemetry.heading)) % 360).padStart(3, '0')}°` : dash],
            ['Inclinação', telemetry ? `${Math.round(telemetry.pitch)}°` : dash],
            ['Resolução', target ? formatGroundResolution(target.metersPerPixel) : dash],
            ['Sol', target ? `${formatDecimal(target.sunElevation)}°` : dash],
          ]}
        />
      </dl>
    </div>
  );
}
