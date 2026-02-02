import { parseProfile } from "./profile/parseProfile.js";
import { RoastSession } from "./roast/RoastSession.js";
import { formatMMSS, toGeneMinutes } from "./ui/timeFormat.js";
import { developmentMetrics, weightLossPct } from "./domain/metrics.js";
import { feedbackText } from "./domain/feedback.js";
import { clearRoasts, deleteRoast, listRoasts, saveRoast } from "./storage/roastStore.js";
import { deleteProfile, getProfile, listProfiles, saveProfile } from "./storage/profileStore.js";
import { showToast } from "./ui/toast.js";
import { RoastGraph } from "./ui/Graph.js";
import { plannedTempAt } from "./roast/interpolate.js";

const el = (id) => document.getElementById(id);

const profileFile = el("profileFile");
const profileStatus = el("profileStatus");
const profileSelect = el("profileSelect");
const profileCount = el("profileCount");
const saveProfileBtn = el("saveProfileBtn");
const loadProfileBtn = el("loadProfileBtn");
const exportProfileBtn = el("exportProfileBtn");
const deleteProfileBtn = el("deleteProfileBtn");
const storageStatus = el("storageStatus");

const setTempEl = el("setTemp");
const profileTempEl = el("profileTemp");
const elapsedEl = el("elapsed");
const geneTimeEl = el("geneTime");
const geneStartTimeEl = el("geneStartTime");
const nextEventEl = el("nextEvent");

const startBtn = el("startBtn");
const pauseBtn = el("pauseBtn");
const resumeBtn = el("resumeBtn");
const dropBtn = el("dropBtn");

const yellowBtn = el("yellowBtn");
const fcBtn = el("fcBtn");
const calBtn = el("calBtn");
const resetCalBtn = el("resetCalBtn");
const calIndicator = el("calIndicator");
const audioToggle = el("audioToggle");
const testAudioBtn = el("testAudioBtn");
const audioStatus = el("audioStatus");
const analyticsSummary = el("analyticsSummary");
const analyticsList = el("analyticsList");
const clearAnalyticsBtn = el("clearAnalyticsBtn");

// Event modal
const eventModal = el("eventModal");
const eventTitle = el("eventTitle");
const eventInstruction = el("eventInstruction");
const eventOk = el("eventOk");

// Calibration modal
const calModal = el("calModal");
const calInput = el("calInput");
const applyTempOffsetBtn = el("applyTempOffset");
const closeCalBtn = el("closeCal");

// Summary modal
const summaryModal = el("summaryModal");
const greenWeight = el("greenWeight");
const roastedWeight = el("roastedWeight");
const summaryOutput = el("summaryOutput");
const saveSummaryBtn = el("saveSummary");
const closeSummaryBtn = el("closeSummary");

// Start modal
const startModal = el("startModal");
const confirmStartBtn = el("confirmStart");
const cancelStartBtn = el("cancelStart");

const actualInlineInput = el("actualInlineInput");
const saveActualInlineBtn = el("saveActualInlineBtn");
const actualInlineStatus = el("actualInlineStatus");

let session = null;
let tickHandle = null;
const graph = new RoastGraph(document.getElementById("roastChart"));
let audioEnabled = false;
let audioCtx = null;
let approachFired = new Set();
let nextActualPromptS = null;
let actualPromptDue = false;

const AUDIO_KEY = "gene_audio_enabled_v1";
const APPROACH_EVENT_S = 30;

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  audioStatus.textContent = `Audio: ${audioCtx.state}`;
  return audioCtx;
}

function playBeep({ frequency = 880, durationMs = 180, volume = 0.18 } = {}) {
  if (!audioEnabled) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  setTimeout(() => osc.stop(), durationMs);
}

function playEventAlert() {
  playBeep({ frequency: 880, durationMs: 140, volume: 0.2 });
  setTimeout(() => playBeep({ frequency: 660, durationMs: 160, volume: 0.18 }), 180);
}

function playApproachAlert() {
  playBeep({ frequency: 520, durationMs: 120, volume: 0.18 });
  setTimeout(() => playBeep({ frequency: 520, durationMs: 120, volume: 0.18 }), 160);
}

function playYellowAlert() {
  playBeep({ frequency: 740, durationMs: 120, volume: 0.2 });
  setTimeout(() => playBeep({ frequency: 740, durationMs: 120, volume: 0.2 }), 160);
}

function playFirstCrackAlert() {
  playBeep({ frequency: 980, durationMs: 120, volume: 0.2 });
  setTimeout(() => playBeep({ frequency: 780, durationMs: 140, volume: 0.2 }), 160);
}

// ---- File import (B) ----
profileFile.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;

  try {
    const text = await f.text();
    const raw = JSON.parse(text);
    const profile = parseProfile(raw);

    session = new RoastSession(profile);
    profileStatus.textContent = `Loaded: ${profile.name}`;
    enableControls(true);

    // Render Graph
    graph.render(profile, session.actualReadings);

    renderIdle();
    renderProfileLibrary();

  } catch (err) {
    session = null;
    profileStatus.textContent = `Profile error: ${err?.message || err}`;
    enableControls(false);
    renderIdle();
  }
});

function enableControls(enabled) {
  startBtn.disabled = !enabled;
  pauseBtn.disabled = true;
  resumeBtn.disabled = true;
  dropBtn.disabled = true;
  yellowBtn.disabled = true;
  fcBtn.disabled = true;
  calBtn.disabled = true;
  resetCalBtn.disabled = true;
  actualInlineInput.disabled = true;
  saveActualInlineBtn.disabled = true;
}

function renderIdle() {
  if (session) {
    const plannedC = Math.round(session.plannedTempNowC());
    const recTempC = session.recommendedTempC({ stepC: 1 });
    profileTempEl.textContent = `${plannedC}°C`;
    setTempEl.textContent = `${recTempC}°C`;
  } else {
    profileTempEl.textContent = "--°C";
    setTempEl.textContent = "--°C";
  }

  elapsedEl.textContent = "00:00";

  // Fix: Show the currently set start time instead of resetting to 0.0
  const startVal = parseFloat(geneStartTimeEl.value) || 15.0;
  geneTimeEl.textContent = startVal.toFixed(1);

  nextEventEl.textContent = "—";
  calIndicator.textContent = "CAL: 0°C";
}

function renderProfileLibrary() {
  const profiles = listProfiles();
  profileCount.textContent = `${profiles.length} saved`;

  if (!profiles.length) {
    profileSelect.innerHTML = `<option value="">No profiles yet</option>`;
    return;
  }

  const current = session?.profile?.name || profileSelect.value;
  profileSelect.innerHTML = profiles.map((p) => {
    const selected = p.name === current ? "selected" : "";
    return `<option value="${p.name}" ${selected}>${p.name}</option>`;
  }).join("");

  if (!profileSelect.value && profiles.length) {
    profileSelect.value = profiles[0].name;
  }
}

function loadProfileByName(name) {
  if (!name) return;
  const record = getProfile(name);
  if (!record) return;
  const profile = parseProfile(record.profile);
  session = new RoastSession(profile);
  profileStatus.textContent = `Loaded: ${profile.name}`;
  enableControls(true);
  graph.render(profile, session.actualReadings);
  renderIdle();
  renderProfileLibrary();
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeFilename(input) {
  return String(input || "roast")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function renderAnalytics() {
  if (!analyticsSummary || !analyticsList) return;
  const roasts = listRoasts();
  const count = roasts.length;
  const devVals = roasts.map((r) => r.metrics?.devPct).filter((v) => Number.isFinite(v));
  const lossVals = roasts.map((r) => r.metrics?.weightLossPct).filter((v) => Number.isFinite(v));
  const actualDeltaVals = roasts.map((r) => r.actualMetrics?.avgDeltaC).filter((v) => Number.isFinite(v));

  const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : null;
  const avgDev = avg(devVals);
  const avgLoss = avg(lossVals);
  const avgActualDelta = avg(actualDeltaVals);

  const last = roasts[0];
  const lastDate = last?.createdAtISO ? new Date(last.createdAtISO).toLocaleString() : "—";

  const lines = [];
  lines.push(`Total roasts: ${count}`);
  lines.push(`Avg dev %: ${avgDev != null ? avgDev.toFixed(1) + "%" : "—"}`);
  lines.push(`Avg weight loss: ${avgLoss != null ? avgLoss.toFixed(1) + "%" : "—"}`);
  lines.push(`Avg actual Δ: ${avgActualDelta != null ? `${avgActualDelta.toFixed(1)}°C` : "—"}`);
  lines.push(`Last roast: ${lastDate}`);
  analyticsSummary.textContent = lines.join("\n");

  if (!count) {
    analyticsList.innerHTML = `<div class="status-pill">No roasts saved yet</div>`;
    return;
  }

  const items = roasts.slice(0, 6).map((r) => {
    const date = r.createdAtISO ? new Date(r.createdAtISO).toLocaleString() : "—";
    const dev = Number.isFinite(r.metrics?.devPct) ? `${r.metrics.devPct.toFixed(1)}% dev` : "dev —";
    const loss = Number.isFinite(r.metrics?.weightLossPct) ? `${r.metrics.weightLossPct.toFixed(1)}% loss` : "loss —";
    const avgDelta = Number.isFinite(r.actualMetrics?.avgDeltaC) ? `Δ ${r.actualMetrics.avgDeltaC.toFixed(1)}°C` : "Δ —";
    const inW = Number.isFinite(r.greenWeightG) ? `${r.greenWeightG}g in` : "in —";
    const outW = Number.isFinite(r.roastedWeightG) ? `${r.roastedWeightG}g out` : "out —";
    return `
      <div class="analytics-item">
        <div>
          <div style="font-weight:700;">${r.profileName || "Unknown profile"}</div>
          <div style="color:var(--text-muted); font-size:12px;">${date}</div>
        </div>
        <div class="badge">${dev}</div>
        <div class="badge">${loss}</div>
        <div class="badge">${avgDelta}</div>
        <div class="badge">${inW}</div>
        <div class="badge">${outW}</div>
        <div class="analytics-actions">
          <button class="mini-btn" data-action="export" data-id="${r.id}">Export</button>
          <button class="mini-btn danger" data-action="delete" data-id="${r.id}">Delete</button>
        </div>
      </div>
    `;
  }).join("");

  analyticsList.innerHTML = `<div class="analytics-list">${items}</div>`;
}

function storageAvailable() {
  try {
    const key = "__gene_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// ---- Roast controls ----
startBtn.addEventListener("click", () => {
  if (!session) return;
  startModal.showModal();
});

confirmStartBtn.addEventListener("click", () => {
  startModal.close();
  startRoast();
});

cancelStartBtn.addEventListener("click", () => {
  startModal.close();
});

function startRoast() {
  if (!session) return;
  session.start();
  approachFired = new Set();
  nextActualPromptS = 120;
  actualPromptDue = false;
  graph.render(session.profile, session.actualReadings);
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  dropBtn.disabled = false;
  yellowBtn.disabled = false;
  fcBtn.disabled = false;
  calBtn.disabled = false;
  resetCalBtn.disabled = false;
  actualInlineInput.disabled = false;
  saveActualInlineBtn.disabled = false;
  updateActualInlineStatus();

  if (tickHandle) clearInterval(tickHandle);
  tickHandle = setInterval(tick, 250);
}

pauseBtn.addEventListener("click", () => {
  if (!session) return;
  session.pause();
  pauseBtn.disabled = true;
  resumeBtn.disabled = false;
});

resumeBtn.addEventListener("click", () => {
  if (!session) return;
  session.resume();
  resumeBtn.disabled = true;
  pauseBtn.disabled = false;
});

yellowBtn.addEventListener("click", () => {
  if (!session) return;
  session.mark("yellow");

  const t = formatMMSS(session.markers.yellowAtS);
  showToast(`Yellowing marked at ${t}`);
  playYellowAlert();

  yellowBtn.textContent = `Yellow @ ${t}`;
  yellowBtn.style.opacity = "0.7";
});

fcBtn.addEventListener("click", () => {
  if (!session) return;
  session.mark("firstCrack");

  const t = formatMMSS(session.markers.firstCrackAtS);
  showToast(`First Crack marked at ${t}`);
  playFirstCrackAlert();

  fcBtn.textContent = `1C @ ${t}`;
  fcBtn.style.opacity = "0.7";
});

dropBtn.addEventListener("click", () => {
  if (!session) return;

  session.mark("drop");
  session.stop();
  if (tickHandle) clearInterval(tickHandle);
  nextActualPromptS = null;

  pauseBtn.disabled = true;
  resumeBtn.disabled = true;
  dropBtn.disabled = true;
  yellowBtn.disabled = true;
  fcBtn.disabled = true;
  calBtn.disabled = true;
  resetCalBtn.disabled = true;
  actualInlineInput.disabled = true;
  saveActualInlineBtn.disabled = true;
  updateActualInlineStatus();

  nextEventEl.textContent = "Roast ended (Drop).";

  // Open summary modal
  greenWeight.value = "";
  roastedWeight.value = "";
  renderSummaryPreview();
  summaryModal.showModal();
  setTimeout(() => greenWeight.focus(), 50);
});

yellowBtn.addEventListener("click", () => session?.mark("yellow"));
fcBtn.addEventListener("click", () => session?.mark("firstCrack"));

// ---- Calibration ----
calBtn.addEventListener("click", () => {
  if (!session) return;
  calInput.value = "";
  calModal.showModal();
  setTimeout(() => calInput.focus(), 50);
});

closeCalBtn.addEventListener("click", () => calModal.close());

applyTempOffsetBtn.addEventListener("click", () => {
  if (!session) return;
  const actual = Number(calInput.value);
  if (!Number.isFinite(actual)) return;

  // Compute offset based on current planned temp at this moment.
  session.setCorrection(actual);

  // Force update immediately
  calIndicator.textContent = `CORR: Active`;
  calModal.close();
});

resetCalBtn.addEventListener("click", () => {
  if (!session) return;
  session.resetCorrection();
  calIndicator.textContent = "CORR: 0°C";
});


// ---- Event modal ----
eventOk.addEventListener("click", () => eventModal.close());

function showEvent(ev, recTempC) {
  eventTitle.textContent = ev.label;
  eventInstruction.textContent =
    (ev.instruction ? `${ev.instruction}\n\n` : "") + `Recommended SET now: ${Math.round(recTempC)}°C`;
  eventModal.showModal();
}

// ---- Summary modal ----
function renderSummaryPreview() {
  if (!session) return;

  const fc = session.markers.firstCrackAtS;
  const drop = session.markers.dropAtS;

  const dev = developmentMetrics(fc, drop);
  const greenG = Number(greenWeight.value);
  const roastedG = Number(roastedWeight.value);
  const lossPct = weightLossPct(greenG, roastedG);

  const hasDev = !!dev;
  const actualReadings = Array.isArray(session.actualReadings) ? session.actualReadings : [];
  const timeShiftS = session.cal?.timeShiftS || 0;
  const actualDeltas = actualReadings.map((r) => {
    const planned = plannedTempAt(session.profile.points, Math.max(0, r.tS - timeShiftS));
    return r.tempC - planned;
  });
  const actualAvg = actualDeltas.length ? actualDeltas.reduce((a, b) => a + b, 0) / actualDeltas.length : null;
  const actualMax = actualDeltas.length ? Math.max(...actualDeltas) : null;
  const actualMin = actualDeltas.length ? Math.min(...actualDeltas) : null;

  const lines = [];
  lines.push(`Profile: ${session.profile.name}`);
  lines.push(`Total time: ${formatMMSS(drop ?? session.elapsedS())}`);

  if (dev) {
    lines.push(`1C start: ${formatMMSS(fc)}`);
    lines.push(`Development: ${formatMMSS(dev.devS)} (${dev.devPct.toFixed(1)}%)`);
  } else {
    lines.push(`Development: (mark 1C Start for dev%)`);
  }

  if (lossPct != null) lines.push(`Weight loss: ${lossPct.toFixed(1)}%`);
  else lines.push(`Weight loss: —`);

  if (actualAvg != null) {
    lines.push(`Actual Δ avg: ${actualAvg.toFixed(1)}°C (min ${actualMin.toFixed(1)} / max ${actualMax.toFixed(1)})`);
  } else {
    lines.push(`Actual Δ avg: —`);
  }

  lines.push("");
  lines.push("Feedback:");
  lines.push(feedbackText({ devPct: dev?.devPct ?? null, lossPct, hasDev }));

  summaryOutput.textContent = lines.join("\n");
}

greenWeight.addEventListener("input", renderSummaryPreview);
roastedWeight.addEventListener("input", renderSummaryPreview);

closeSummaryBtn.addEventListener("click", () => summaryModal.close());

saveSummaryBtn.addEventListener("click", () => {
  if (!session) return;

  const greenG = Number(greenWeight.value);
  const roastedG = Number(roastedWeight.value);

  const fc = session.markers.firstCrackAtS;
  const drop = session.markers.dropAtS;

  const dev = developmentMetrics(fc, drop);
  const lossPct = weightLossPct(greenG, roastedG);

  const actualReadings = Array.isArray(session.actualReadings) ? session.actualReadings : [];
  const timeShiftS = session.cal?.timeShiftS || 0;
  const actualDeltas = actualReadings.map((r) => {
    const planned = plannedTempAt(session.profile.points, Math.max(0, r.tS - timeShiftS));
    return r.tempC - planned;
  });
  const actualAvg = actualDeltas.length ? actualDeltas.reduce((a, b) => a + b, 0) / actualDeltas.length : null;
  const actualMax = actualDeltas.length ? Math.max(...actualDeltas) : null;
  const actualMin = actualDeltas.length ? Math.min(...actualDeltas) : null;

  const record = {
    id: crypto.randomUUID(),
    createdAtISO: new Date().toISOString(),
    profileName: session.profile.name,
    greenWeightG: Number.isFinite(greenG) ? greenG : null,
    roastedWeightG: Number.isFinite(roastedG) ? roastedG : null,
    markers: { ...session.markers },
    calibration: { ...session.cal },
    actualReadings,
    actualMetrics: actualDeltas.length ? {
      avgDeltaC: actualAvg,
      maxDeltaC: actualMax,
      minDeltaC: actualMin
    } : null,
    metrics: {
      devS: dev?.devS ?? null,
      devPct: dev?.devPct ?? null,
      weightLossPct: lossPct
    },
    feedback: feedbackText({ devPct: dev?.devPct ?? null, lossPct, hasDev: !!dev })
  };

  try {
    saveRoast(record);
    summaryModal.close();
    profileStatus.textContent = `Saved roast: ${session.profile.name}`;
    renderAnalytics();
  } catch (err) {
    showToast(err?.message || "Failed to save roast.");
    profileStatus.textContent = err?.message || "Failed to save roast.";
  }
});

// ---- Main tick loop ----
function tick() {
  if (!session || !session.running()) return;

  const elapsedS = session.elapsedS();

  // Update Graph Cursor & Markers
  graph.update(elapsedS, session.markers);

  const recTempC = session.recommendedTempC({ stepC: 1 });
  const plannedC = Math.round(session.plannedTempNowC());

  profileTempEl.textContent = `${plannedC}°C`;
  const MAX_SET_C = 250;
  const clampedRec = Math.min(MAX_SET_C, Math.max(0, recTempC));
  setTempEl.textContent = `${clampedRec}°C`;

  // Update correction indicator dynamic
  const correctionVal = clampedRec - plannedC;
  if (Math.abs(correctionVal) > 0) {
    calIndicator.textContent = `CORR: ${correctionVal > 0 ? "+" : ""}${correctionVal}°C`;
    calIndicator.style.opacity = "1";
  } else {
    calIndicator.textContent = `CORR: 0°C`;
    calIndicator.style.opacity = "0.5";
  }

  elapsedEl.textContent = formatMMSS(elapsedS);

  // Gene Time Logic: Count down from the start time
  const startTimeMin = parseFloat(geneStartTimeEl.value) || 15.0;
  const elapsedMin = elapsedS / 60;
  const remainingMin = Math.max(0, startTimeMin - elapsedMin);

  // Display with one decimal place, e.g. "14.9"
  geneTimeEl.textContent = remainingMin.toFixed(1);

  const next = session.nextEvent();
  if (next) {
    const eta = Math.max(0, next.tS - session.effectiveTimeS());
    nextEventEl.textContent = `${next.label} in ${formatMMSS(eta)}`;
    const key = `${next.tS}:${next.label}`;
    if (eta > 0 && eta <= APPROACH_EVENT_S && !approachFired.has(key)) {
      approachFired.add(key);
      playApproachAlert();
      showToast(`Upcoming: ${next.label} in ${formatMMSS(eta)}`);
    }
  } else {
    nextEventEl.textContent = "No more events.";
  }

  const due = session.dueEvents();
  if (due.length) {
    showEvent(due[0], recTempC);
    playEventAlert();
  }

  if (nextActualPromptS != null && elapsedS >= nextActualPromptS && !actualPromptDue) {
    actualPromptDue = true;
    actualInlineStatus.textContent = "Log actual temp now";
    actualInlineStatus.classList.add("warn");
    playApproachAlert();
  }
}

// ---- Profile library controls ----
saveProfileBtn.addEventListener("click", () => {
  if (!session) return;
  try {
    saveProfile(session.profile);
    showToast(`Saved profile: ${session.profile.name}`);
    renderProfileLibrary();
    profileSelect.value = session.profile.name;
  } catch (err) {
    showToast(err?.message || "Failed to save profile.");
    profileStatus.textContent = err?.message || "Failed to save profile.";
  }
});

loadProfileBtn.addEventListener("click", () => {
  const name = profileSelect.value;
  if (!name) return;
  loadProfileByName(name);
});

exportProfileBtn.addEventListener("click", () => {
  const name = profileSelect.value;
  if (!name) return;
  const record = getProfile(name);
  if (!record) return;
  downloadJson(`${name}.json`, record.profile);
});

deleteProfileBtn.addEventListener("click", () => {
  const name = profileSelect.value;
  if (!name) return;
  const ok = window.confirm(`Delete profile "${name}" from library?`);
  if (!ok) return;
  deleteProfile(name);
  renderProfileLibrary();
});

// ---- Audio controls ----
audioToggle.addEventListener("change", () => {
  audioEnabled = audioToggle.checked;
  localStorage.setItem(AUDIO_KEY, audioEnabled ? "1" : "0");
  if (audioEnabled) {
    const ctx = ensureAudio();
    if (!ctx) {
      showToast("Audio not supported in this browser.");
      audioStatus.textContent = "Audio: unsupported";
    } else {
      showToast("Audio armed.");
      audioStatus.textContent = `Audio: ${ctx.state}`;
      playBeep({ frequency: 660, durationMs: 120, volume: 0.16 });
    }
  } else {
    audioStatus.textContent = "Audio: off";
  }
});

testAudioBtn.addEventListener("click", () => {
  audioEnabled = audioToggle.checked;
  playBeep({ frequency: 660, durationMs: 180, volume: 0.18 });
});

// ---- Init ----
function initFromStorage() {
  const storageOk = storageAvailable();
  storageStatus.textContent = storageOk ? "Storage: OK" : "Storage: blocked";
  if (!storageOk) {
    showToast("Storage blocked. Profiles and analytics will not persist.");
  }

  audioEnabled = localStorage.getItem(AUDIO_KEY) === "1";
  audioToggle.checked = audioEnabled;
  audioStatus.textContent = audioEnabled ? "Audio: armed" : "Audio: off";
  renderProfileLibrary();
  renderAnalytics();
  updateActualInlineStatus();
}

initFromStorage();

// ---- Actual temp logging ----
function updateActualInlineStatus() {
  if (!actualInlineStatus) return;
  if (!session?.running()) {
    actualInlineStatus.textContent = "Log every 2 minutes while roasting";
    actualInlineStatus.classList.remove("warn");
    return;
  }
  if (actualPromptDue) {
    actualInlineStatus.textContent = "Log actual temp now";
    actualInlineStatus.classList.add("warn");
    return;
  }
  if (nextActualPromptS != null) {
    actualInlineStatus.textContent = `Next log at ${formatMMSS(nextActualPromptS)}`;
  }
  actualInlineStatus.classList.remove("warn");
}

function saveActualReading() {
  if (!session) return;
  const tempC = Number(actualInlineInput.value);
  if (!Number.isFinite(tempC)) return;
  session.addActualReading(tempC);
  showToast(`Actual temp logged: ${tempC}°C`);
  actualInlineInput.value = "";
  nextActualPromptS = session.elapsedS() + 120;
  actualPromptDue = false;
  updateActualInlineStatus();

  // Re-render graph with actual curve and keep cursor/markers current.
  graph.render(session.profile, session.actualReadings);
  graph.update(session.elapsedS(), session.markers);
}

saveActualInlineBtn.addEventListener("click", saveActualReading);
actualInlineInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveActualReading();
});

// ---- Analytics controls ----
clearAnalyticsBtn.addEventListener("click", () => {
  const ok = window.confirm("Clear all saved roast history?");
  if (!ok) return;
  try {
    clearRoasts();
    renderAnalytics();
  } catch (err) {
    showToast(err?.message || "Failed to clear history.");
  }
});

analyticsList.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!id) return;

  const roasts = listRoasts();
  const roast = roasts.find((r) => r.id === id);
  if (!roast) return;

  if (action === "export") {
    const date = roast.createdAtISO ? new Date(roast.createdAtISO).toISOString().slice(0, 19).replace(/:/g, "-") : "unknown-date";
    const name = safeFilename(roast.profileName || "roast");
    downloadJson(`${name}-${date}.json`, roast);
    return;
  }

  if (action === "delete") {
    const ok = window.confirm(`Delete roast "${roast.profileName || "Unknown"}" from history?`);
    if (!ok) return;
    try {
      deleteRoast(id);
      renderAnalytics();
    } catch (err) {
      showToast(err?.message || "Failed to delete roast.");
    }
  }
});
