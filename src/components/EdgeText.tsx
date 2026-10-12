import { useMapState } from '../hooks/useMap';
import type { LayerId } from '../map/types';
import './EdgeText.css';

/** Thin vertical captions along the screen edges. */
export function EdgeText() {
  const target = useMapState((state) => state.telemetry?.target);
  const layers = useMapState((state) => state.layers);
  const online = (Object.keys(layers) as LayerId[]).filter((id) => layers[id].count && !layers[id].error).length;

  return (
    <>
      <p className="edge edge--left">
        {target ? `LAT ${target.lat.toFixed(4)} · LON ${target.lon.toFixed(4)}` : 'SEM ALVO NO SOLO'}
      </p>
      <p className="edge edge--right">VARREDURA CONTÍNUA · {online} FONTES ATIVAS</p>
    </>
  );
}
