import { Timer } from "./Timer.js";
import { plannedTempAt } from "./interpolate.js";
import { defaultCalibration } from "./calibration.js";

export class RoastSession {
  constructor(profile) {
    this.profile = profile;
    this.timer = new Timer();
    this.cal = defaultCalibration();
    this.correction = { val: 0 };
    this._fired = new Set();
    this.markers = {};
    this.actualReadings = [];
  }

  start() {
    this._fired.clear();
    this.markers = {};
    this.actualReadings = [];
    this.timer.start();
  }
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

  // Calibration: proportional correction (no decay).
  // We compute the error between planned and actual display temp,
  // apply a proportional gain, then clamp the correction.
  setCorrection(actualC) {
    const planned = this.plannedTempNowC();
    const error = planned - actualC;
    const KP = 0.6;
    const MAX_CORR = 20; // max correction applied from calibration
    const raw = error * KP;
    this.correction.val = Math.max(-MAX_CORR, Math.min(MAX_CORR, raw));
  }

  recommendedTempC({ stepC = 1 } = {}) {
    const planned = this.plannedTempNowC();

    // Apply calibrated correction (no decay)
    const adjustedTemp = planned + this.correction.val;
    return Math.round(adjustedTemp / stepC) * stepC;
  }

  resetCorrection() {
    this.correction.val = 0;
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

  addActualReading(tempC) {
    const tS = Math.round(this.elapsedS());
    const last = this.actualReadings[this.actualReadings.length - 1];
    if (last && last.tS === tS) {
      last.tempC = tempC;
      return;
    }
    this.actualReadings.push({ tS, tempC });
  }
}
