import { Cartesian2, Cartesian3, Cartographic, Math as CesiumMath, type JulianDate, type Viewer } from 'cesium';
import { aircraftModel, flightLevel, flightName } from '../lib/aircraft';
import { normalizeDegrees } from '../lib/geo';
import type { FlightsLayer } from './layers/flights';

const DEFAULT_PITCH = CesiumMath.toRadians(-6);
const POSITION_SMOOTHING = 0.08;
const HEADING_SMOOTHING = 0.05;
const MIN_CLEARANCE_M = 25;
const HUD_INTERVAL_MS = 100;
const CONTACTS_INTERVAL_MS = 1_000;
const CONTACT_COUNT = 6;
const LOOK_LIMITS = { up: CesiumMath.toRadians(40), down: CesiumMath.toRadians(-60) };

export interface CockpitContact {
  id: string;
  name: string;
  distanceKm: number;
  level: string;
}

export interface CockpitState {
  callsign: string;
  model: string;
  speedKt: number | null;
  altitudeFt: number | null;
  verticalRateFpm: number | null;
  /** Aircraft track, degrees. */
  track: number;
  /** Where the camera looks (track plus the user's look offset), degrees. */
  viewHeading: number;
  contacts: CockpitContact[];
  canGoBack: boolean;
}

export class CockpitController {
  private target: string | null = null;
  private history: string[] = [];
  private smoothedPosition: Cartesian3 | null = null;
  private smoothedHeading = 0;
  private lookHeading = 0;
  private lookPitch = 0;
  private contacts: CockpitContact[] = [];
  private lastHud = 0;
  private lastContacts = 0;
  private readonly removeRenderListener: () => void;

  constructor(
    private readonly viewer: Viewer,
    private readonly flights: FlightsLayer,
    private readonly onChange: (state: CockpitState | null) => void,
  ) {
    this.removeRenderListener = viewer.scene.preRender.addEventListener((_, time) => this.update(time));
  }

  get active() {
    return this.target !== null;
  }

  enter(id: string, { remember = true } = {}): boolean {
    const flight = this.flights.get(id);
    if (!flight || flight.onGround || !this.flights.dataSource.entities.getById(id)) return false;
    if (this.target) {
      if (remember) this.history.push(this.target);
      this.setPlaneVisible(this.target, true);
    }
    this.target = id;
    this.setPlaneVisible(id, false);
    this.smoothedPosition = null;
    this.smoothedHeading = CesiumMath.toRadians(flight.track ?? 0);
    this.lookHeading = 0;
    this.lookPitch = 0;
    this.lastContacts = 0;
    this.viewer.trackedEntity = undefined;
    this.viewer.selectedEntity = undefined;
    this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    return true;
  }

  exit() {
    if (!this.target) return;
    const last = this.smoothedPosition && Cartographic.fromCartesian(this.smoothedPosition);
    this.setPlaneVisible(this.target, true);
    this.target = null;
    this.history = [];
    this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    if (last) {
      this.viewer.camera.flyTo({
        destination: Cartesian3.fromRadians(last.longitude, last.latitude, 60_000),
        duration: 1.5,
      });
    }
    this.onChange(null);
  }

  next() {
    const nearest = this.contacts[0];
    if (nearest) this.enter(nearest.id);
  }

  back() {
    const previous = this.history.pop();
    if (previous) this.enter(previous, { remember: false });
  }

  look(headingDeg: number, pitchDeg: number) {
    this.lookHeading += CesiumMath.toRadians(headingDeg);
    this.lookPitch = CesiumMath.clamp(
      this.lookPitch + CesiumMath.toRadians(pitchDeg),
      LOOK_LIMITS.down,
      LOOK_LIMITS.up,
    );
  }

  /** Boards the selected flight or, with nothing selected, the one nearest the screen center. */
  enterNearest(): boolean {
    const selected = this.viewer.selectedEntity?.id;
    if (selected?.startsWith(this.flights.entityPrefix) && this.enter(selected)) return true;
    const { scene, camera } = this.viewer;
    const ray = camera.getPickRay(new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2));
    const point = (ray && scene.globe.pick(ray, scene)) ?? camera.positionWC;
    const id = this.nearestTo(point);
    return id ? this.enter(id) : false;
  }

  destroy() {
    this.removeRenderListener();
  }

  private setPlaneVisible(id: string, visible: boolean) {
    const entity = this.flights.dataSource.entities.getById(id);
    if (entity) entity.show = visible;
  }

  private positionOf(id: string, time: JulianDate) {
    return this.flights.dataSource.entities.getById(id)?.position?.getValue(time);
  }

  private nearestTo(point: Cartesian3, exclude?: string) {
    const time = this.viewer.clock.currentTime;
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const id of this.flights.airborne()) {
      const position = id !== exclude && this.positionOf(id, time);
      if (!position) continue;
      const distance = Cartesian3.distance(point, position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = id;
      }
    }
    return best;
  }

  private update(time: JulianDate) {
    if (!this.target) return;
    const flight = this.flights.get(this.target);
    const position = flight && this.positionOf(this.target, time);
    if (!flight || !position) {
      // The plane left coverage: hop to the nearest one instead of dropping out.
      const fallback = this.smoothedPosition && this.nearestTo(this.smoothedPosition, this.target);
      if (!fallback || !this.enter(fallback, { remember: false })) this.exit();
      return;
    }

    if (!this.smoothedPosition) this.smoothedPosition = Cartesian3.clone(position);
    else Cartesian3.lerp(this.smoothedPosition, position, POSITION_SMOOTHING, this.smoothedPosition);

    // Barometric altitude can read below ground near high runways.
    const geo = Cartographic.fromCartesian(this.smoothedPosition);
    const ground = this.viewer.scene.globe.getHeight(geo) ?? 0;
    if (geo.height < ground + MIN_CLEARANCE_M) {
      geo.height = ground + MIN_CLEARANCE_M;
      Cartographic.toCartesian(geo, undefined, this.smoothedPosition);
    }

    const track = CesiumMath.toRadians(flight.track ?? CesiumMath.toDegrees(this.smoothedHeading));
    this.smoothedHeading += CesiumMath.negativePiToPi(track - this.smoothedHeading) * HEADING_SMOOTHING;

    this.viewer.camera.setView({
      destination: this.smoothedPosition,
      orientation: {
        heading: this.smoothedHeading + this.lookHeading,
        pitch: DEFAULT_PITCH + this.lookPitch,
        roll: 0,
      },
    });
    this.publish(time);
  }

  private refreshContacts(time: JulianDate) {
    const here = this.smoothedPosition;
    if (!here) return;
    this.contacts = this.flights
      .airborne()
      .filter((id) => id !== this.target)
      .flatMap((id) => {
        const position = this.positionOf(id, time);
        const flight = this.flights.get(id);
        return position && flight ? [{ id, flight, distance: Cartesian3.distance(here, position) }] : [];
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, CONTACT_COUNT)
      .map(({ id, flight, distance }) => ({
        id,
        name: flightName(flight),
        distanceKm: distance / 1000,
        level: flightLevel(flight),
      }));
  }

  private publish(time: JulianDate) {
    const now = performance.now();
    if (now - this.lastHud < HUD_INTERVAL_MS || !this.target) return;
    this.lastHud = now;
    if (now - this.lastContacts > CONTACTS_INTERVAL_MS) {
      this.lastContacts = now;
      this.refreshContacts(time);
    }
    const flight = this.flights.get(this.target);
    if (!flight) return;
    this.onChange({
      callsign: flightName(flight),
      model: aircraftModel(flight),
      speedKt: flight.speedKt,
      altitudeFt: flight.altitudeFt,
      verticalRateFpm: flight.verticalRateFpm,
      track: normalizeDegrees(CesiumMath.toDegrees(this.smoothedHeading)),
      viewHeading: normalizeDegrees(CesiumMath.toDegrees(this.smoothedHeading + this.lookHeading)),
      contacts: this.contacts,
      canGoBack: this.history.length > 0,
    });
  }
}
