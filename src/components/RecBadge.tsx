import { useClock } from '../hooks/useClock';
import { useMapState } from '../hooks/useMap';
import { MAP_STYLES } from '../map/mapStyles';
import { VISION_LABELS } from './MissionHeader';
import './RecBadge.css';

const pad = (n: number) => String(n).padStart(2, '0');
const isoUtc = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
  `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;

const brasilia = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

export function RecBadge() {
  const now = useClock();
  const mode = useMapState((state) => state.visionMode);
  const mapStyle = useMapState((state) => state.mapStyle);
  const base = MAP_STYLES.find((style) => style.id === mapStyle)?.label ?? mapStyle;

  return (
    <div className="rec">
      <p className="rec__time">
        <span className="rec__dot">●</span> REC {isoUtc(now)}
      </p>
      <p className="rec__line">BRASÍLIA {brasilia.format(now)} · BASE {base.toUpperCase()}</p>
      <p className="hud-label rec__label">Estilo ativo</p>
      <p className="rec__mode">{VISION_LABELS[mode]}</p>
    </div>
  );
}
