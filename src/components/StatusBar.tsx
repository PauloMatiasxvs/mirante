import { useClock } from '../hooks/useClock';
import { useMapState } from '../hooks/useMap';
import { formatInt } from '../lib/format';
import type { LayerId, LayerStatus } from '../map/types';
import './StatusBar.css';

const utc = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const brasilia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
});

function counterLabel({ count, error }: LayerStatus) {
  if (count) return formatInt(count);
  if (error) return 'offline';
  return count === 0 ? '—' : '…';
}

const COUNTERS: Array<{ id: LayerId; title: string }> = [
  { id: 'flights', title: 'Voos no Brasil' },
  { id: 'military', title: 'Voos militares' },
  { id: 'world', title: 'Voos no mundo' },
  { id: 'earthquakes', title: 'Terremotos (24 h)' },
  { id: 'satellites', title: 'Satélites' },
  { id: 'buildings', title: 'Prédios em 3D' },
];

export function StatusBar() {
  const now = useClock();
  const layers = useMapState((state) => state.layers);

  return (
    <div className="status">
      <span className="status__utc">{utc.format(now)} UTC</span>
      <span className="status__local">Brasília {brasilia.format(now)}</span>
      <span className="status__counts" aria-label="Dados carregados">
        {COUNTERS.map(({ id, title }) => (
          <span key={id} title={layers[id].error ? `${title}: fonte indisponível` : title}>
            <i className={`dot dot--${id}`} />
            <b className={layers[id].error ? 'status__count--error' : undefined}>{counterLabel(layers[id])}</b>
          </span>
        ))}
      </span>
    </div>
  );
}
