import { formatMMSS } from "../ui/timeFormat.js";

const DEFAULT_COUNTRY = "Colombia";
const DEFAULT_PROCESS = "Washed";
const DEFAULT_ROAST_LEVEL = "Medium";

const COUNTRY_GROUPS = {
  delicate: ["Ethiopia", "Kenya", "Rwanda", "Burundi", "Panama", "Yemen"],
  balanced: ["Colombia", "Costa Rica", "Guatemala", "El Salvador", "Honduras", "Nicaragua", "Peru", "Mexico", "Ecuador"],
  comfort: ["Brazil", "Sumatra", "India"]
};

const COUNTRY_SET = new Set([
  ...COUNTRY_GROUPS.delicate,
  ...COUNTRY_GROUPS.balanced,
  ...COUNTRY_GROUPS.comfort
]);

const PROCESS_OPTIONS = ["Washed", "Honey", "Natural", "Wet Hulled", "Experimental"];
const ROAST_LEVEL_OPTIONS = ["Light", "Medium", "Medium+", "Dark"];

const ROAST_BASELINES = {
  Light: {
    chargeTempC: 158,
    dryingMin: 4.5,
    maillardTempC: 236,
    maillardMin: 4.8,
    peakTempC: 242,
    developmentTempC: 223,
    developmentPct: 15.5,
    preheatTempC: 205
  },
  Medium: {
    chargeTempC: 160,
    dryingMin: 4.8,
    maillardTempC: 235,
    maillardMin: 5.0,
    peakTempC: 241,
    developmentTempC: 226,
    developmentPct: 17.5,
    preheatTempC: 205
  },
  "Medium+": {
    chargeTempC: 162,
    dryingMin: 4.9,
    maillardTempC: 236,
    maillardMin: 5.2,
    peakTempC: 242,
    developmentTempC: 228,
    developmentPct: 20,
    preheatTempC: 206
  },
  Dark: {
    chargeTempC: 164,
    dryingMin: 4.8,
    maillardTempC: 238,
    maillardMin: 5.1,
    peakTempC: 243,
    developmentTempC: 230,
    developmentPct: 22.5,
    preheatTempC: 208
  }
};

const PROCESS_MODIFIERS = {
  Washed: {
    dryingMin: -0.1,
    maillardTempC: 1,
    maillardMin: 0,
    peakTempC: 1,
    developmentTempC: -1,
    developmentPct: -0.8,
    preheatTempC: 0
  },
  Honey: {
    dryingMin: 0.1,
    maillardTempC: 0,
    maillardMin: 0.2,
    peakTempC: 0,
    developmentTempC: 1,
    developmentPct: 0.2,
    preheatTempC: 0
  },
  Natural: {
    dryingMin: 0.25,
    maillardTempC: -1,
    maillardMin: 0.25,
    peakTempC: -1,
    developmentTempC: 1,
    developmentPct: 0.8,
    preheatTempC: -1
  },
  "Wet Hulled": {
    dryingMin: 0.2,
    maillardTempC: -2,
    maillardMin: 0.2,
    peakTempC: -2,
    developmentTempC: 1,
    developmentPct: 1.4,
    preheatTempC: -1
  },
  Experimental: {
    dryingMin: 0.15,
    maillardTempC: -1,
    maillardMin: 0.2,
    peakTempC: 0,
    developmentTempC: 1,
    developmentPct: 0.8,
    preheatTempC: 0
  }
};

const COUNTRY_MODIFIERS = {
  delicate: {
    dryingMin: 0.15,
    maillardTempC: 1,
    peakTempC: 1,
    developmentPct: -0.2,
    preheatTempC: 1
  },
  balanced: {
    dryingMin: 0,
    maillardTempC: 0,
    peakTempC: 0,
    developmentPct: 0,
    preheatTempC: 0
  },
  comfort: {
    dryingMin: -0.1,
    maillardTempC: -1,
    peakTempC: -1,
    developmentPct: 0.6,
    preheatTempC: -1
  }
};

const LIMITS = {
  batchSizeG: { min: 150, max: 300, step: 5 },
  chargeTempC: { min: 150, max: 175, step: 1 },
  dryingMin: { min: 4.0, max: 6.25, step: 0.25 },
  maillardTempC: { min: 230, max: 240, step: 1 },
  maillardMin: { min: 4.0, max: 6.5, step: 0.25 },
  peakTempC: { min: 236, max: 245, step: 1 },
  developmentTempC: { min: 220, max: 232, step: 1 },
  developmentPct: { min: 15, max: 26, step: 0.5 },
  preheatTempC: { min: 195, max: 215, step: 1 }
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

function snapValue(value, limits, fallback) {
  const raw = Number(value);
  const source = Number.isFinite(raw) ? raw : fallback;
  return clamp(roundToStep(source, limits.step), limits.min, limits.max);
}

function snapQuarter(value, fallback) {
  return snapValue(value, LIMITS.dryingMin, fallback);
}

function roundToNearest15(seconds) {
  return Math.max(0, Math.round(seconds / 15) * 15);
}

function roastLevelFromText(input) {
  const text = String(input || "").trim().toLowerCase();
  if (!text) return DEFAULT_ROAST_LEVEL;
  if (text.includes("dark") || text.includes("french") || text.includes("vienna")) return "Dark";
  if (text.includes("medium+") || text.includes("medium plus") || text.includes("full city+")) return "Medium+";
  if (text.includes("full city")) return "Medium+";
  if (text.includes("medium")) return "Medium";
  if (text.includes("light") || text.includes("city")) return "Light";
  return DEFAULT_ROAST_LEVEL;
}

function processFromText(input) {
  const text = String(input || "").trim().toLowerCase();
  if (!text) return DEFAULT_PROCESS;
  if (text.includes("wet hulled")) return "Wet Hulled";
  if (text.includes("natural")) return "Natural";
  if (text.includes("honey")) return "Honey";
  if (text.includes("experimental") || text.includes("anaerobic") || text.includes("carbonic")) return "Experimental";
  if (text.includes("washed")) return "Washed";
  return DEFAULT_PROCESS;
}

function findCountryGroup(country) {
  if (COUNTRY_GROUPS.delicate.includes(country)) return "delicate";
  if (COUNTRY_GROUPS.comfort.includes(country)) return "comfort";
  return "balanced";
}

function countryFromOrigin(origin) {
  const text = String(origin || "");
  for (const country of COUNTRY_SET) {
    if (text.toLowerCase().includes(country.toLowerCase())) return country;
  }
  return DEFAULT_COUNTRY;
}

function regionFromOrigin(origin, country) {
  const text = String(origin || "").trim();
  if (!text) return "";
  const pattern = new RegExp(`^${country}\\s*[\\u2014\\-,:|]?\\s*`, "i");
  return text.replace(pattern, "").trim();
}

function buildOrigin(country, region) {
  return region ? `${country} - ${region}` : country;
}

function buildName({ country, region, process, roastLevel, batchSizeG }) {
  const parts = [country];
  if (region) parts.push(region);
  parts.push(process);
  parts.push(`${batchSizeG}g`);
  parts.push(roastLevel);
  return parts.join(" ");
}

function timingLine(tS, totalS) {
  const remainingS = Math.max(0, totalS - tS);
  const geneMinutes = (tS / 60).toFixed(1);
  const geneRemaining = (remainingS / 60).toFixed(1);
  return `Elapsed ${formatMMSS(tS)} (${geneMinutes}) | Remaining ${formatMMSS(remainingS)} (${geneRemaining})`;
}

export const guidedProfileOptions = {
  countries: [
    "Brazil",
    "Burundi",
    "Colombia",
    "Costa Rica",
    "Ecuador",
    "El Salvador",
    "Ethiopia",
    "Guatemala",
    "Honduras",
    "India",
    "Kenya",
    "Mexico",
    "Nicaragua",
    "Panama",
    "Peru",
    "Rwanda",
    "Sumatra",
    "Yemen"
  ],
  processes: PROCESS_OPTIONS,
  roastLevels: ROAST_LEVEL_OPTIONS
};

export function getBaselineSettings({ country = DEFAULT_COUNTRY, process = DEFAULT_PROCESS, roastLevel = DEFAULT_ROAST_LEVEL } = {}) {
  const roastBaseline = ROAST_BASELINES[roastLevel] || ROAST_BASELINES[DEFAULT_ROAST_LEVEL];
  const processModifier = PROCESS_MODIFIERS[process] || PROCESS_MODIFIERS[DEFAULT_PROCESS];
  const countryModifier = COUNTRY_MODIFIERS[findCountryGroup(country)] || COUNTRY_MODIFIERS.balanced;

  return {
    chargeTempC: roastBaseline.chargeTempC,
    dryingMin: roastBaseline.dryingMin + processModifier.dryingMin + countryModifier.dryingMin,
    maillardTempC: roastBaseline.maillardTempC + processModifier.maillardTempC + countryModifier.maillardTempC,
    maillardMin: roastBaseline.maillardMin + processModifier.maillardMin,
    peakTempC: roastBaseline.peakTempC + processModifier.peakTempC + countryModifier.peakTempC,
    developmentTempC: roastBaseline.developmentTempC + processModifier.developmentTempC,
    developmentPct: roastBaseline.developmentPct + processModifier.developmentPct + countryModifier.developmentPct,
    preheatTempC: roastBaseline.preheatTempC + processModifier.preheatTempC + countryModifier.preheatTempC
  };
}

export function createDraft(seed = {}) {
  const country = guidedProfileOptions.countries.includes(seed.country) ? seed.country : DEFAULT_COUNTRY;
  const process = PROCESS_OPTIONS.includes(seed.process) ? seed.process : DEFAULT_PROCESS;
  const roastLevel = ROAST_LEVEL_OPTIONS.includes(seed.roastLevel) ? seed.roastLevel : DEFAULT_ROAST_LEVEL;
  const baseline = getBaselineSettings({ country, process, roastLevel });
  const batchSizeG = snapValue(seed.batchSizeG, LIMITS.batchSizeG, 250);
  const region = String(seed.region || "").trim();
  const name = String(seed.name || "").trim() || buildName({ country, region, process, roastLevel, batchSizeG });

  return {
    name,
    country,
    region,
    process,
    roastLevel,
    cropYear: String(seed.cropYear || new Date().getFullYear()),
    batchSizeG,
    notes: String(seed.notes || "").trim(),
    chargeTempC: snapValue(seed.chargeTempC, LIMITS.chargeTempC, baseline.chargeTempC),
    dryingMin: snapQuarter(seed.dryingMin, baseline.dryingMin),
    maillardTempC: snapValue(seed.maillardTempC, LIMITS.maillardTempC, baseline.maillardTempC),
    maillardMin: snapQuarter(seed.maillardMin, baseline.maillardMin),
    peakTempC: snapValue(seed.peakTempC, LIMITS.peakTempC, baseline.peakTempC),
    developmentTempC: snapValue(seed.developmentTempC, LIMITS.developmentTempC, baseline.developmentTempC),
    developmentPct: snapValue(seed.developmentPct, LIMITS.developmentPct, baseline.developmentPct),
    preheatTempC: snapValue(seed.preheatTempC, LIMITS.preheatTempC, baseline.preheatTempC)
  };
}

export function buildGuidedProfile(seed = {}) {
  const draft = createDraft(seed);
  const adjustments = [];
  const warnings = [];

  let peakTempC = Math.max(draft.peakTempC, draft.maillardTempC + 1);
  if (peakTempC !== draft.peakTempC) adjustments.push("Raised peak push to stay above the Maillard setpoint.");

  let developmentTempC = draft.developmentTempC;
  const maxDevelopmentTemp = peakTempC - 4;
  if (developmentTempC > maxDevelopmentTemp) {
    developmentTempC = maxDevelopmentTemp;
    adjustments.push("Lowered the development setpoint to keep a controlled finish.");
  }

  let preheatTempC = Math.max(draft.preheatTempC, draft.chargeTempC + 30);
  if (preheatTempC !== draft.preheatTempC) adjustments.push("Raised preheat to keep enough thermal momentum after charge.");
  preheatTempC = snapValue(preheatTempC, LIMITS.preheatTempC, preheatTempC);

  const dryingS = roundToNearest15(draft.dryingMin * 60);
  const maillardS = roundToNearest15(draft.maillardMin * 60);
  const preDevelopmentS = dryingS + maillardS;

  let totalS = roundToNearest15(preDevelopmentS / (1 - draft.developmentPct / 100));
  let developmentS = totalS - preDevelopmentS;

  if (developmentS < 105) {
    developmentS = 105;
    totalS = preDevelopmentS + developmentS;
    adjustments.push("Raised development time to a minimum of 1:45.");
  }

  if (developmentS > 240) {
    developmentS = 240;
    totalS = preDevelopmentS + developmentS;
    adjustments.push("Capped development time at 4:00.");
  }

  if (totalS < 630) {
    totalS = 630;
    developmentS = totalS - preDevelopmentS;
    adjustments.push("Raised total roast time to stay out of the underdeveloped zone.");
  }

  if (totalS > 930) {
    totalS = 930;
    developmentS = totalS - preDevelopmentS;
    adjustments.push("Capped total roast time to avoid flattening the cup.");
  }

  const actualDevelopmentPct = Number(((developmentS / totalS) * 100).toFixed(1));
  const developmentStartS = totalS - developmentS;
  let peakStartS = Math.max(dryingS + 210, developmentStartS - 75);
  peakStartS = Math.min(peakStartS, developmentStartS - 30);

  const points = [
    { tS: 0, tempC: draft.chargeTempC },
    { tS: dryingS, tempC: draft.chargeTempC },
    { tS: dryingS + 30, tempC: draft.maillardTempC }
  ];

  if (peakStartS > dryingS + 45) {
    points.push({ tS: peakStartS, tempC: peakTempC });
  }

  points.push({ tS: developmentStartS, tempC: developmentTempC });
  points.push({ tS: totalS, tempC: developmentTempC });

  const watchFirstCrackS = Math.max(dryingS + 180, developmentStartS - 75);
  const events = [
    {
      tS: 0,
      label: "Charge / Start",
      instruction: `Preheat empty drum to ${preheatTempC}C until stable.\nLoad ${draft.batchSizeG}g and set ${draft.chargeTempC}C for drying.\n${timingLine(0, totalS)}`,
      requireAck: true
    },
    {
      tS: dryingS,
      label: `End Drying -> ${draft.maillardTempC}C`,
      instruction: `Aim for a clear yellowing transition, then move to ${draft.maillardTempC}C for Maillard development.\n${timingLine(dryingS, totalS)}`,
      requireAck: true
    },
    {
      tS: watchFirstCrackS,
      label: "Watch for 1C soon",
      instruction: `Listen for first crack. If the roast is lagging badly, the short peak push should help it arrive cleanly.\n${timingLine(watchFirstCrackS, totalS)}`,
      requireAck: false
    }
  ];

  if (peakStartS > dryingS + 45) {
    events.push({
      tS: peakStartS,
      label: `Peak Push -> ${peakTempC}C`,
      instruction: `Use a short push to ${peakTempC}C, then step down once first crack is established.\n${timingLine(peakStartS, totalS)}`,
      requireAck: true
    });
  }

  events.push(
    {
      tS: developmentStartS,
      label: `Development Control -> ${developmentTempC}C`,
      instruction: `Drop to ${developmentTempC}C and finish with control. This plan targets ${actualDevelopmentPct}% development.\n${timingLine(developmentStartS, totalS)}`,
      requireAck: true
    },
    {
      tS: totalS,
      label: "Drop / Cool",
      instruction: `Drop now and cool aggressively outside the roaster.\n${timingLine(totalS, totalS)}`,
      requireAck: true
    }
  );

  const dryingPct = Number(((dryingS / totalS) * 100).toFixed(1));
  const maillardPct = Number(((maillardS / totalS) * 100).toFixed(1));

  if (dryingPct < 32 || dryingPct > 46) warnings.push("Drying is outside the normal 32-46% range. Use bean color, not the timer alone.");
  if (maillardPct < 28 || maillardPct > 46) warnings.push("Maillard is stretched. Expect either a thin cup or a baked cup if you follow it blindly.");
  if (actualDevelopmentPct < 15 || actualDevelopmentPct > 25) warnings.push("Development is near the edge of a safe range for most coffees.");
  if (peakTempC >= 244) warnings.push("Peak setpoint is high. Watch for tipping or smoky finish.");
  if (draft.batchSizeG >= 285) warnings.push("Large batch selected. Expect slower turning point and be ready to trim drying by 15-30 seconds next roast.");

  const origin = buildOrigin(draft.country, draft.region);
  const name = draft.name || buildName(draft);
  const profile = {
    name,
    author: "Gene Cafe Guided Builder",
    description: [
      `${draft.roastLevel} guided profile for ${draft.batchSizeG}g ${draft.process.toLowerCase()} coffee from ${origin}.`,
      `Targets: drying ${formatMMSS(dryingS)}, Maillard ${formatMMSS(maillardS)}, development ${formatMMSS(developmentS)} (${actualDevelopmentPct}%), drop at ${formatMMSS(totalS)}.`,
      warnings.length ? `Watchouts: ${warnings.join(" ")}` : "",
      draft.notes || ""
    ].filter(Boolean).join("\n\n"),
    beanInfo: {
      origin,
      process: draft.process,
      cropYear: draft.cropYear,
      targetRoastLevel: draft.roastLevel,
      batchSizeG: draft.batchSizeG
    },
    roasterSettings: {
      preheatTempC,
      geneStartTimeMin: Number((totalS / 60).toFixed(1)),
      batchSizeG: draft.batchSizeG
    },
    points,
    events
  };

  const summaryLines = [
    `Profile: ${name}`,
    `Origin: ${origin}`,
    `Roast target: ${draft.roastLevel} | Process: ${draft.process} | Batch: ${draft.batchSizeG}g`,
    `Total: ${formatMMSS(totalS)} | Drying: ${formatMMSS(dryingS)} (${dryingPct}%) | Maillard: ${formatMMSS(maillardS)} (${maillardPct}%) | Development: ${formatMMSS(developmentS)} (${actualDevelopmentPct}%)`,
    `Setpoints: preheat ${preheatTempC}C -> drying ${draft.chargeTempC}C -> Maillard ${draft.maillardTempC}C -> peak ${peakTempC}C -> finish ${developmentTempC}C`
  ];

  if (adjustments.length) summaryLines.push(`Guardrails: ${adjustments.join(" ")}`);
  if (warnings.length) summaryLines.push(`Warnings: ${warnings.join(" ")}`);

  return {
    draft: {
      ...draft,
      name,
      peakTempC,
      developmentTempC,
      preheatTempC,
      developmentPct: actualDevelopmentPct
    },
    profile,
    summaryLines,
    warnings,
    adjustments,
    derived: {
      totalS,
      dryingS,
      maillardS,
      developmentS,
      developmentPct: actualDevelopmentPct
    }
  };
}

function inferDryingEndS(points) {
  for (let i = 1; i < points.length; i += 1) {
    if (points[i].tempC >= points[0].tempC + 8) {
      return Math.max(points[i - 1]?.tS || points[i].tS, 240);
    }
  }
  return Math.max(points[1]?.tS || 300, 240);
}

function inferDevelopmentStartS(points) {
  const peakTemp = Math.max(...points.map((p) => p.tempC));
  for (let i = points.length - 2; i >= 0; i -= 1) {
    if (points[i].tempC >= peakTemp && points[i + 1].tempC <= peakTemp - 3) {
      return points[i + 1].tS;
    }
  }
  return Math.max(points[points.length - 1].tS - 150, 540);
}

export function inferDraftFromProfile(profile) {
  const beanInfo = profile?.beanInfo || {};
  const country = countryFromOrigin(beanInfo.origin);
  const process = processFromText(beanInfo.process);
  const roastLevel = roastLevelFromText(beanInfo.targetRoastLevel);
  const region = regionFromOrigin(beanInfo.origin, country);
  const points = Array.isArray(profile?.points) ? profile.points : [];

  if (points.length < 2) return createDraft({ country, process, roastLevel, region, name: profile?.name });

  const totalS = points[points.length - 1].tS;
  const dryingS = inferDryingEndS(points);
  const developmentStartS = inferDevelopmentStartS(points);
  const maillardS = Math.max(240, developmentStartS - dryingS);
  const peakTempC = Math.max(...points.map((p) => p.tempC));
  const chargeTempC = points[0].tempC;
  const developmentTempC = points[points.length - 1].tempC;
  const maillardTempC = points.find((p) => p.tS > dryingS)?.tempC || Math.max(chargeTempC + 10, 235);
  const developmentPct = totalS > 0 ? ((totalS - developmentStartS) / totalS) * 100 : 18;

  return createDraft({
    name: profile?.name,
    country,
    region,
    process,
    roastLevel,
    cropYear: beanInfo.cropYear,
    batchSizeG: beanInfo.batchSizeG || profile?.roasterSettings?.batchSizeG || 250,
    notes: profile?.description || "",
    chargeTempC,
    dryingMin: dryingS / 60,
    maillardTempC,
    maillardMin: maillardS / 60,
    peakTempC,
    developmentTempC,
    developmentPct,
    preheatTempC: profile?.roasterSettings?.preheatTempC
  });
}
