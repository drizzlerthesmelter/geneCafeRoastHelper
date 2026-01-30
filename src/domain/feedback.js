export function feedbackText({ devPct, lossPct, hasDev }) {
  const lines = [];

  if (!hasDev) {
    lines.push("Dev%: (mark 1C Start next time for development calculations)");
  } else {
    if (devPct < 12) lines.push("Development looks low → possible underdevelopment (sharp/grassy).");
    else if (devPct <= 20) lines.push("Development looks in a common range for light–medium roasts.");
    else lines.push("Development looks high → possible roastiness/flattened acidity (or darker style).");
  }

  if (lossPct == null) {
    lines.push("Weight loss: (enter valid green + roasted weights)");
  } else {
    if (lossPct < 11) lines.push("Weight loss low → likely very light roast or slow heat application.");
    else if (lossPct <= 15) lines.push("Weight loss in a common range for light–medium roasts.");
    else lines.push("Weight loss high → likely darker roast (more roast character/bitterness).");
  }

  if (hasDev && lossPct != null) {
    if (devPct >= 20 && lossPct < 12) {
      lines.push("Combo note: high dev% + low weight loss can indicate baking/low momentum late.");
    }
    if (devPct < 12 && lossPct >= 14) {
      lines.push("Combo note: low dev% + higher weight loss can indicate late heat spike.");
    }
  }

  return lines.join("\n");
}
