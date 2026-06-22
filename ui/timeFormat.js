export function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// Gene-style "decimal minutes"
export function toGeneMinutes(totalSeconds) {
  return Math.max(0, totalSeconds) / 60;
}
