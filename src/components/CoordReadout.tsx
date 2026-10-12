import { useMapState } from '../hooks/useMap';
import { formatDecimal, formatDistance, formatDms, formatGroundResolution, formatInt } from '../lib/format';
import { normalizeDegrees } from '../lib/geo';
import './CoordReadout.css';

/** Bottom corners: grid reference on the left, imaging geometry on the right. */
export function CoordReadout() {
  const telemetry = useMapState((state) => state.telemetry);
  const inCockpit = useMapState((state) => state.cockpit !== null);
  if (inCockpit) return null;

  const target = telemetry?.target;
  const dash = '—';
  const heading = telemetry ? String(Math.round(normalizeDegrees(telemetry.heading)) % 360).padStart(3, '0') : dash;

  return (
    <>
      <div className="readout readout--left">
        <p>
          <span className="readout__key">MGRS</span> {target?.mgrs ?? dash}
        </p>
        <p className="readout__big">
          {target ? `${formatDms(target.lat, 'N', 'S')}  ${formatDms(target.lon, 'L', 'O')}` : dash}
        </p>
      </div>
      <div className="readout readout--right">
        <p>
          <span className="readout__key">RESOLUÇÃO</span> {target ? formatGroundResolution(target.metersPerPixel) : dash}
          <span className="readout__key"> · SOLO</span> {target ? `${formatInt(target.ground)} m` : dash}
        </p>
        <p className="readout__big">
          ALT {telemetry ? formatDistance(telemetry.cameraHeight) : dash} · SOL{' '}
          {target ? `${formatDecimal(target.sunElevation)}° ELEV` : dash}
        </p>
        <p>
          <span className="readout__key">RUMO</span> {heading}°<span className="readout__key"> · INCL</span>{' '}
          {telemetry ? `${Math.round(telemetry.pitch)}°` : dash}
        </p>
      </div>
    </>
  );
}
