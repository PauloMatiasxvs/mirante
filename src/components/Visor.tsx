import { useMapState } from '../hooks/useMap';
import './Visor.css';

const CARDINALS: Array<[number, string]> = [
  [0, 'N'],
  [90, 'L'],
  [180, 'S'],
  [270, 'O'],
];

// Static compass ring: fine ticks every 2°, longer every 10° and 30°. It
// rotates as a whole with the camera heading.
const COMPASS = (
  <>
    <circle className="lens__rim" r={99.5} />
    <circle className="lens__rim lens__rim--inner" r={93} />
    {Array.from({ length: 180 }, (_, i) => i * 2).map((deg) => {
      const major = deg % 30 === 0;
      const medium = deg % 10 === 0;
      return (
        <line
          key={deg}
          y1={-99.5}
          y2={major ? -94 : medium ? -96 : -97.8}
          transform={`rotate(${deg})`}
          className={major ? 'lens__tick lens__tick--major' : medium ? 'lens__tick lens__tick--medium' : 'lens__tick'}
        />
      );
    })}
    {CARDINALS.map(([deg, letter]) => (
      <text key={letter} y={-88.5} transform={`rotate(${deg})`}>
        {letter}
      </text>
    ))}
  </>
);

/** The circular lens: soft-edged scope, rotating compass ring and reticle. */
export function Visor() {
  const visor = useMapState((state) => state.visor);
  const inCockpit = useMapState((state) => state.cockpit !== null);
  const heading = useMapState((state) => state.telemetry?.heading ?? 0);
  if (!visor || inCockpit) return null;

  return (
    <div className="lens" aria-hidden="true">
      <div className="lens__outside" />
      <svg className="lens__compass" viewBox="-100 -100 200 200" style={{ transform: `rotate(${-heading}deg)` }}>
        {COMPASS}
      </svg>
      <svg className="lens__reticle" viewBox="-60 -60 120 120">
        <path d="M-60 0H-16M16 0H60M0-60V-16M0 16V60" />
        <path d="M-30-22V-30H-22M22-30H30V-22M30 22V30H22M-22 30H-30V22" />
        <circle r={1.8} />
      </svg>
    </div>
  );
}
