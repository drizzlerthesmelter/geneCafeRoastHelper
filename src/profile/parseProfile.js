export function parseProfile(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Profile must be an object.");
  if (typeof raw.name !== "string" || !raw.name.trim()) throw new Error("Profile needs a name.");

  const points = raw.points;
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error("Profile.points must be an array with at least 2 points.");
  }

  const normPoints = points.map((p, i) => {
    const tS = Number(p.tS ?? p.t ?? p.timeS ?? p.time);
    const tempC = Number(p.tempC ?? p.temp ?? p.temperatureC ?? p.temperature);
    if (!Number.isFinite(tS) || tS < 0) throw new Error(`Point ${i} has invalid time.`);
    if (!Number.isFinite(tempC)) throw new Error(`Point ${i} has invalid temp.`);
    return { tS, tempC };
  }).sort((a, b) => a.tS - b.tS);

  const events = Array.isArray(raw.events) ? raw.events : [];
  const normEvents = events.map((ev, i) => {
    const tS = Number(ev.tS ?? ev.t ?? ev.timeS ?? ev.time);
    const label = String(ev.label ?? ev.name ?? `Event ${i + 1}`);
    const instruction = ev.instruction ? String(ev.instruction) : "";
    const requireAck = Boolean(ev.requireAck ?? true);
    if (!Number.isFinite(tS) || tS < 0) throw new Error(`Event ${i} has invalid time.`);
    return { tS, label, instruction, requireAck };
  }).sort((a, b) => a.tS - b.tS);

  return {
    name: raw.name.trim(),
    points: normPoints,
    events: normEvents
  };
}
