export function developmentMetrics(firstCrackAtS, dropAtS) {
  if (!Number.isFinite(firstCrackAtS) || !Number.isFinite(dropAtS)) return null;
  if (dropAtS <= 0 || dropAtS < firstCrackAtS) return null;

  const devS = dropAtS - firstCrackAtS;
  const totalS = dropAtS;
  const devPct = (devS / totalS) * 100;
  return { devS, totalS, devPct };
}

export function weightLossPct(greenG, roastedG) {
  if (!Number.isFinite(greenG) || !Number.isFinite(roastedG)) return null;
  if (greenG <= 0 || roastedG <= 0 || roastedG > greenG) return null;
  return ((greenG - roastedG) / greenG) * 100;
}
