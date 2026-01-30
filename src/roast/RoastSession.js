import { Timer } from "./Timer.js";
import { plannedTempAt } from "./interpolate.js";
import { defaultCalibration } from "./calibration.js";

export class RoastSession {
  constructor(profile) {
    this.profile = profile;
    this.timer = new Timer();
    this.cal = defaultCalibration();
    this.correction = { val: 0, startS: 0 };
    this._fired = new Set();
    this.markers = {};
  }

  start() { this._fired.clear(); this.timer.start(); }
  pause() { this.timer.pause(); }
  resume() { this.timer.resume(); }
  stop() { this.timer.stop(); }

  running() { return this.timer.running; }
  elapsedS() { return this.timer.elapsedS(); }

  effectiveTimeS() {
    return Math.max(0, this.elapsedS() - (this.cal.timeShiftS || 0));
  }

  plannedTempNowC() {
    return plannedTempAt(this.profile.points, this.effectiveTimeS());
  }

  // New Logic: Store the Correction needed.
  // We want to apply correction that DECAYS over time (e.g. 3 mins).
  setCorrection(actualC) {
    const planned = this.plannedTempNowC();
    this.correction.val = planned - actualC; // Initial Error
    this.correction.startS = this.elapsedS();
  }

  recommendedTempC({ stepC = 1 } = {}) {
    const planned = this.plannedTempNowC();

    // Decay Logic
    const DURATION_S = 180; // 3 minutes decay
    const elapsedSince = this.elapsedS() - (this.correction.startS || 0);
    const factor = Math.max(0, 1 - (elapsedSince / DURATION_S));

    const adjustment = this.correction.val * factor;

    // Apply adjusted correction
    const adjustedTemp = planned + adjustment;
    return Math.round(adjustedTemp / stepC) * stepC;
  }

  nextEvent() {
    const t = this.effectiveTimeS();
    return (this.profile.events || []).find(ev => ev.tS > t) || null;
  }

  dueEvents() {
    const t = this.effectiveTimeS();
    const due = [];
    for (const ev of (this.profile.events || [])) {
      const key = `${ev.tS}:${ev.label}`;
      if (t >= ev.tS && !this._fired.has(key)) {
        due.push(ev);
        this._fired.add(key);
      }
    }
    return due;
  }

  mark(type) {
    const tS = Math.round(this.elapsedS());
    if (type === "yellow") this.markers.yellowAtS = tS;
    if (type === "firstCrack") this.markers.firstCrackAtS = tS;
    if (type === "drop") this.markers.dropAtS = tS;
  }
}
