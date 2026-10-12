import { InfoCard } from './InfoCard';
import { TrafficPanel } from './TrafficPanel';
import './RightRail.css';

/** Stacks the selection card above the nearby-traffic panel. */
export function RightRail() {
  return (
    <aside className="right-rail">
      <InfoCard />
      <TrafficPanel />
    </aside>
  );
}
