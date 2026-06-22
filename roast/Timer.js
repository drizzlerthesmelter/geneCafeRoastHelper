export class Timer {
  constructor() {
    this.running = false;
    this._t0 = 0;
    this._elapsedMs = 0;
  }
  start() {
    this._elapsedMs = 0;
    this._t0 = performance.now();
    this.running = true;
  }
  pause() {
    if (!this.running) return;
    this._elapsedMs += performance.now() - this._t0;
    this.running = false;
  }
  resume() {
    if (this.running) return;
    this._t0 = performance.now();
    this.running = true;
  }
  stop() { this.pause(); }
  elapsedS() {
    const ms = this.running
      ? this._elapsedMs + (performance.now() - this._t0)
      : this._elapsedMs;
    return ms / 1000;
  }
}
