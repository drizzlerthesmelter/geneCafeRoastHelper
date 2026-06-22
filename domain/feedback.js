export function feedbackText({ devPct, lossPct, hasDev }) {
  const lines = [];

  if (!hasDev) {
    lines.push("Development: (mark 1C Start next time for development calculations)");
  } else {
    if (devPct < 20) lines.push("Development: short (may taste sharp/underdeveloped).");
    else if (devPct <= 25) lines.push("Development: balanced.");
    else lines.push("Development: long (may taste roasty or muted).");
  }

  if (lossPct == null) {
    lines.push("Roast level: (enter green + roasted weights)");
  } else {
    let level = "Light";
    let flavor = "Bright acidity, floral/fruit notes, lighter body.";
    if (lossPct > 13 && lossPct <= 15) {
      level = "Medium";
      flavor = "Balanced sweetness, caramel, rounder body.";
    } else if (lossPct > 15 && lossPct <= 17) {
      level = "Medium-Dark";
      flavor = "Lower acidity, chocolate/nutty, heavier body.";
    } else if (lossPct > 17) {
      level = "Dark";
      flavor = "Roasty, bitter/smoky notes, very low acidity.";
    }
    lines.push(`Roast level: ${level}`);
    lines.push(`Flavor: ${flavor}`);
  }

  return lines.join("\n");
}
