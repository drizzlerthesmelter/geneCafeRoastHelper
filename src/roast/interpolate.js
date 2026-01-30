export function plannedTempAt(points, tS) {
  if (!points.length) throw new Error("No points");
  if (tS <= points[0].tS) return points[0].tempC;
  if (tS >= points[points.length - 1].tS) return points[points.length - 1].tempC;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (tS >= a.tS && tS <= b.tS) {
      const r = (tS - a.tS) / (b.tS - a.tS);
      return a.tempC + r * (b.tempC - a.tempC);
    }
  }
  return points[points.length - 1].tempC;
}
