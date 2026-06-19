import { parseProfile } from "./profile/parseProfile.js";
import { buildGuidedProfile, createDraft, guidedProfileOptions, inferDraftFromProfile } from "./profile/profileBuilder.js";
import { RoastSession } from "./roast/RoastSession.js";
import { formatMMSS } from "./ui/timeFormat.js";
import { developmentMetrics, weightLossPct } from "./domain/metrics.js";
import { feedbackText } from "./domain/feedback.js";
import { clearRoasts, deleteRoast, listRoasts, saveRoast, updateRoast } from "./storage/roastStore.js";
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
const writeProfileBtn = el("writeProfileBtn");
const deleteProfileBtn = el("deleteProfileBtn");
const storageStatus = el("storageStatus");
const openBuilderBtn = el("openBuilderBtn");
const editProfileBtn = el("editProfileBtn");

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
const summaryTitle = el("summaryTitle");
const summaryHint = el("summaryHint");
const greenWeight = el("greenWeight");
const roastedWeight = el("roastedWeight");
const summaryOutput = el("summaryOutput");
const saveSummaryBtn = el("saveSummary");
const closeSummaryBtn = el("closeSummary");

// Guided builder modal
const builderModal = el("builderModal");
const builderName = el("builderName");
const builderCountry = el("builderCountry");
const builderRegion = el("builderRegion");
const builderProcess = el("builderProcess");
const builderRoastLevel = el("builderRoastLevel");
const builderCropYear = el("builderCropYear");
const builderBatchSize = el("builderBatchSize");
const builderChargeTemp = el("builderChargeTemp");
const builderDryingMin = el("builderDryingMin");
const builderMaillardTemp = el("builderMaillardTemp");
const builderMaillardMin = el("builderMaillardMin");
const builderPeakTemp = el("builderPeakTemp");
const builderDevelopmentTemp = el("builderDevelopmentTemp");
const builderDevelopmentPct = el("builderDevelopmentPct");
const builderNotes = el("builderNotes");
const builderStatus = el("builderStatus");
const builderSummary = el("builderSummary");
const builderWarnings = el("builderWarnings");
const builderResetBtn = el("builderResetBtn");
const builderCancelBtn = el("builderCancel");
const builderPreviewBtn = el("builderPreviewBtn");
const builderSaveBtn = el("builderSaveBtn");
const builderExportBtn = el("builderExportBtn");
const builderWriteBtn = el("builderWriteBtn");

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
let builderAutoName = "";
let builderResult = null;
let builderDirectoryHandle = null;
let summaryContext = null;

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
    loadProfile(profile, `Loaded: ${profile.name}`);

  } catch (err) {
    session = null;
    profileStatus.textContent = `Profile error: ${err?.message || err}`;
    enableControls(false);
    renderIdle();
  }
});

function setGeneStartTimeFromProfile(profile) {
  const startMin = Number(profile?.roasterSettings?.geneStartTimeMin);
  if (Number.isFinite(startMin) && startMin > 0) {
    geneStartTimeEl.value = startMin.toFixed(1);
  }
}

function loadProfile(profile, statusText = `Loaded: ${profile.name}`) {
  session = new RoastSession(profile);
  profileStatus.textContent = statusText;
  enableControls(true);
  resetRoastActionButtons();
  setGeneStartTimeFromProfile(profile);
  graph.render(profile, session.actualReadings);
  renderIdle();
  renderProfileLibrary();
}

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

function resetRoastActionButtons() {
  yellowBtn.textContent = "Mark Yellow";
  yellowBtn.style.opacity = "";
  fcBtn.textContent = "Mark 1C Start";
  fcBtn.style.opacity = "";
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
  loadProfile(profile, `Loaded: ${profile.name}`);
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

function populateBuilderSelect(selectEl, options) {
  selectEl.innerHTML = options.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function buildBuilderSeed() {
  return {
    name: builderName.value.trim(),
    country: builderCountry.value,
    region: builderRegion.value.trim(),
    process: builderProcess.value,
    roastLevel: builderRoastLevel.value,
    cropYear: builderCropYear.value.trim(),
    batchSizeG: Number(builderBatchSize.value),
    chargeTempC: Number(builderChargeTemp.value),
    dryingMin: Number(builderDryingMin.value),
    maillardTempC: Number(builderMaillardTemp.value),
    maillardMin: Number(builderMaillardMin.value),
    peakTempC: Number(builderPeakTemp.value),
    developmentTempC: Number(builderDevelopmentTemp.value),
    developmentPct: Number(builderDevelopmentPct.value),
    notes: builderNotes.value.trim()
  };
}

function refreshBuilderAutoName(force = false) {
  const autoDraft = createDraft({
    country: builderCountry.value,
    region: builderRegion.value.trim(),
    process: builderProcess.value,
    roastLevel: builderRoastLevel.value,
    batchSizeG: Number(builderBatchSize.value)
  });
  const currentName = builderName.value.trim();
  if (force || !currentName || currentName === builderAutoName) {
    builderName.value = autoDraft.name;
  }
  builderAutoName = autoDraft.name;
}

function applyBuilderDraft(draft) {
  builderCountry.value = draft.country;
  builderRegion.value = draft.region;
  builderProcess.value = draft.process;
  builderRoastLevel.value = draft.roastLevel;
  builderCropYear.value = draft.cropYear;
  builderBatchSize.value = draft.batchSizeG;
  builderChargeTemp.value = draft.chargeTempC;
  builderDryingMin.value = draft.dryingMin;
  builderMaillardTemp.value = draft.maillardTempC;
  builderMaillardMin.value = draft.maillardMin;
  builderPeakTemp.value = draft.peakTempC;
  builderDevelopmentTemp.value = draft.developmentTempC;
  builderDevelopmentPct.value = draft.developmentPct;
  builderNotes.value = draft.notes || "";
  refreshBuilderAutoName(true);
  builderName.value = draft.name || builderAutoName;
}

function resetBuilderToBaseline() {
  const draft = createDraft({
    country: builderCountry.value,
    region: builderRegion.value.trim(),
    process: builderProcess.value,
    roastLevel: builderRoastLevel.value,
    cropYear: builderCropYear.value.trim(),
    batchSizeG: Number(builderBatchSize.value),
    notes: builderNotes.value.trim()
  });
  applyBuilderDraft(draft);
  renderBuilderPreview();
}

function renderBuilderPreview() {
  builderResult = buildGuidedProfile(buildBuilderSeed());
  builderSummary.textContent = builderResult.summaryLines.join("\n");

  const warningLines = [];
  if (builderResult.adjustments.length) {
    warningLines.push(`Guardrails applied: ${builderResult.adjustments.join(" ")}`);
  }
  if (builderResult.warnings.length) {
    warningLines.push(`Watchouts: ${builderResult.warnings.join(" ")}`);
  }
  if (!warningLines.length) {
    warningLines.push("Profile stays inside conservative first-pass bounds.");
  }

  builderWarnings.textContent = warningLines.join("\n\n");
  builderStatus.textContent = `Gene start ${builderResult.profile.roasterSettings.geneStartTimeMin.toFixed(1)} min`;
  return builderResult;
}

function openGuidedBuilder(draft = createDraft()) {
  applyBuilderDraft(draft);
  renderBuilderPreview();
  builderModal.showModal();
  setTimeout(() => builderName.focus(), 50);
}

function getProfileForEditing() {
  if (session?.profile) return session.profile;
  const selectedName = profileSelect.value;
  if (!selectedName) return null;
  return getProfile(selectedName)?.profile || null;
}

async function writeProfileJsonFile(profile) {
  if (!window.showDirectoryPicker) {
    throw new Error("Direct file writing is not supported in this browser. Use Export instead.");
  }

  if (!builderDirectoryHandle) {
    builderDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
  }

  if (typeof builderDirectoryHandle.requestPermission === "function") {
    const permission = await builderDirectoryHandle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") throw new Error("Folder permission was not granted.");
  }

  const filename = `${safeFilename(profile.name)}.json`;
  const fileHandle = await builderDirectoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(profile, null, 2));
  await writable.close();
  return filename;
}

function positiveNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function defaultGreenWeightG(profile) {
  return positiveNumberOrNull(profile?.beanInfo?.batchSizeG ?? profile?.roasterSettings?.batchSizeG);
}

function actualMetricsForSession(roastSession) {
  const actualReadings = Array.isArray(roastSession.actualReadings) ? roastSession.actualReadings : [];
  const timeShiftS = roastSession.cal?.timeShiftS || 0;
  const actualDeltas = actualReadings.map((r) => {
    const planned = plannedTempAt(roastSession.profile.points, Math.max(0, r.tS - timeShiftS));
    return r.tempC - planned;
  });

  if (!actualDeltas.length) return null;

  return {
    avgDeltaC: actualDeltas.reduce((a, b) => a + b, 0) / actualDeltas.length,
    maxDeltaC: Math.max(...actualDeltas),
    minDeltaC: Math.min(...actualDeltas)
  };
}

function buildRoastRecordFromSession(roastSession, { status = "complete", greenWeightG = null, roastedWeightG = null } = {}) {
  const greenG = positiveNumberOrNull(greenWeightG);
  const roastedG = positiveNumberOrNull(roastedWeightG);
  const fc = roastSession.markers.firstCrackAtS;
  const drop = roastSession.markers.dropAtS;
  const dev = developmentMetrics(fc, drop);
  const lossPct = weightLossPct(greenG, roastedG);
  const actualReadings = Array.isArray(roastSession.actualReadings) ? roastSession.actualReadings : [];
  const feedback = feedbackText({ devPct: dev?.devPct ?? null, lossPct, hasDev: !!dev });

  return {
    id: crypto.randomUUID(),
    createdAtISO: new Date().toISOString(),
    completedAtISO: status === "complete" ? new Date().toISOString() : null,
    status,
    profileName: roastSession.profile.name,
    greenWeightG: greenG,
    roastedWeightG: roastedG,
    markers: { ...roastSession.markers },
    calibration: { ...roastSession.cal },
    actualReadings,
    actualMetrics: actualMetricsForSession(roastSession),
    metrics: {
      devS: dev?.devS ?? null,
      devPct: dev?.devPct ?? null,
      weightLossPct: lossPct
    },
    feedback
  };
}

function finalizeRoastRecord(record, greenG, roastedG) {
  const lossPct = weightLossPct(greenG, roastedG);
  const hasDev = Number.isFinite(record.metrics?.devPct);

  return {
    ...record,
    status: "complete",
    completedAtISO: new Date().toISOString(),
    greenWeightG: greenG,
    roastedWeightG: roastedG,
    metrics: {
      ...(record.metrics || {}),
      weightLossPct: lossPct
    },
    feedback: feedbackText({ devPct: record.metrics?.devPct ?? null, lossPct, hasDev })
  };
}

function renderAnalytics() {
  if (!analyticsSummary || !analyticsList) return;
  const roasts = listRoasts();
  const count = roasts.length;
  const pendingCount = roasts.filter((r) => r.status === "pendingWeight").length;
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
  lines.push(`Pending final weight: ${pendingCount}`);
  lines.push(`Avg dev %: ${avgDev != null ? avgDev.toFixed(1) + "%" : "—"}`);
  lines.push(`Avg weight loss: ${avgLoss != null ? avgLoss.toFixed(1) + "%" : "—"}`);
  lines.push(`Avg actual Δ: ${avgActualDelta != null ? `${avgActualDelta.toFixed(1)}°C` : "—"}`);
  lines.push(`Last roast: ${lastDate}`);
  analyticsSummary.textContent = lines.join("\n");

  if (!count) {
    analyticsList.innerHTML = `<div class="status-pill">No roasts saved yet</div>`;
    return;
  }

  const pendingRoasts = roasts.filter((r) => r.status === "pendingWeight");
  const completedRoasts = roasts.filter((r) => r.status !== "pendingWeight");
  const displayRoasts = [...pendingRoasts, ...completedRoasts].slice(0, 6);

  const items = displayRoasts.map((r) => {
    const pending = r.status === "pendingWeight";
    const date = r.createdAtISO ? new Date(r.createdAtISO).toLocaleString() : "—";
    const dev = Number.isFinite(r.metrics?.devPct) ? `${r.metrics.devPct.toFixed(1)}% dev` : "dev —";
    const loss = pending ? "needs weight" : (Number.isFinite(r.metrics?.weightLossPct) ? `${r.metrics.weightLossPct.toFixed(1)}% loss` : "loss —");
    const avgDelta = Number.isFinite(r.actualMetrics?.avgDeltaC) ? `Δ ${r.actualMetrics.avgDeltaC.toFixed(1)}°C` : "Δ —";
    const inW = Number.isFinite(r.greenWeightG) ? `${r.greenWeightG}g in` : "in —";
    const outW = Number.isFinite(r.roastedWeightG) ? `${r.roastedWeightG}g out` : "out —";
    const completeAction = pending
      ? `<button class="mini-btn primary" data-action="complete" data-id="${r.id}">Complete</button>`
      : "";
    return `
      <div class="analytics-item">
        <div>
          <div style="font-weight:700;">${r.profileName || "Unknown profile"}</div>
          <div style="color:var(--text-muted); font-size:12px;">${date}</div>
        </div>
        ${pending ? `<div class="badge pending">Cooling</div>` : ""}
        <div class="badge">${dev}</div>
        <div class="badge">${loss}</div>
        <div class="badge">${avgDelta}</div>
        <div class="badge">${inW}</div>
        <div class="badge">${outW}</div>
        <div class="analytics-actions">
          ${completeAction}
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
  actualPromptDue = false;

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

  const droppedSession = session;
  const pendingRecord = buildRoastRecordFromSession(droppedSession, {
    status: "pendingWeight",
    greenWeightG: defaultGreenWeightG(droppedSession.profile),
    roastedWeightG: null
  });

  try {
    saveRoast(pendingRecord);
    renderAnalytics();
    showToast("Roast dropped. Final weight can be added after cooling.");
    profileStatus.textContent = `Cooling: ${droppedSession.profile.name}`;

    session = new RoastSession(droppedSession.profile);
    enableControls(true);
    resetRoastActionButtons();
    setGeneStartTimeFromProfile(session.profile);
    graph.render(session.profile, session.actualReadings);
    renderIdle();
  } catch (err) {
    showToast(err?.message || "Failed to save pending roast.");
    profileStatus.textContent = err?.message || "Failed to save pending roast.";
  }
});

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
  const record = summaryContext?.record || null;
  if (!record) return;

  const fc = record.markers?.firstCrackAtS;
  const drop = record.markers?.dropAtS;
  const dev = developmentMetrics(fc, drop);
  const greenG = Number(greenWeight.value);
  const roastedG = Number(roastedWeight.value);
  const lossPct = weightLossPct(greenG, roastedG);
  const hasDev = !!dev || Number.isFinite(record.metrics?.devPct);
  const actualAvg = record.actualMetrics?.avgDeltaC ?? null;
  const actualMax = record.actualMetrics?.maxDeltaC ?? null;
  const actualMin = record.actualMetrics?.minDeltaC ?? null;

  const lines = [];
  lines.push(`Profile: ${record.profileName || "Unknown profile"}`);
  lines.push(`Total time: ${formatMMSS(drop ?? 0)}`);

  if (dev) {
    lines.push(`1C start: ${formatMMSS(fc)}`);
    lines.push(`Development: ${formatMMSS(dev.devS)} (${dev.devPct.toFixed(1)}%)`);
  } else if (Number.isFinite(record.metrics?.devS) && Number.isFinite(record.metrics?.devPct)) {
    lines.push(`1C start: ${Number.isFinite(fc) ? formatMMSS(fc) : "—"}`);
    lines.push(`Development: ${formatMMSS(record.metrics.devS)} (${record.metrics.devPct.toFixed(1)}%)`);
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
  lines.push(feedbackText({ devPct: dev?.devPct ?? record.metrics?.devPct ?? null, lossPct, hasDev }));

  summaryOutput.textContent = lines.join("\n");
}

greenWeight.addEventListener("input", renderSummaryPreview);
roastedWeight.addEventListener("input", renderSummaryPreview);

function openSummaryForRecord(record) {
  summaryContext = { record };
  summaryTitle.textContent = record.status === "pendingWeight" ? "Finalize Roast Weight" : "Roast Summary";
  summaryHint.textContent = record.status === "pendingWeight"
    ? "Enter the cooled roasted weight, adjust green weight if needed, then save the finished log."
    : "Review or update the saved roast weights.";
  saveSummaryBtn.textContent = record.status === "pendingWeight" ? "Save Final Weight" : "Save Log";
  greenWeight.value = Number.isFinite(record.greenWeightG) ? record.greenWeightG : "";
  roastedWeight.value = Number.isFinite(record.roastedWeightG) ? record.roastedWeightG : "";
  renderSummaryPreview();
  summaryModal.showModal();
  setTimeout(() => roastedWeight.focus(), 50);
}

closeSummaryBtn.addEventListener("click", () => {
  summaryModal.close();
});

summaryModal.addEventListener("close", () => {
  summaryContext = null;
});

saveSummaryBtn.addEventListener("click", () => {
  const record = summaryContext?.record;
  if (!record) return;
  const greenG = Number(greenWeight.value);
  const roastedG = Number(roastedWeight.value);
  const lossPct = weightLossPct(greenG, roastedG);

  if (lossPct == null) {
    showToast("Enter valid green and roasted weights.");
    return;
  }

  try {
    const updated = updateRoast(record.id, (current) => finalizeRoastRecord(current, greenG, roastedG));
    if (!updated) throw new Error("Roast log was not found.");
    summaryModal.close();
    summaryContext = null;
    profileStatus.textContent = `Saved roast: ${record.profileName}`;
    renderAnalytics();
    showToast("Final weight saved.");
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

writeProfileBtn.addEventListener("click", async () => {
  const name = profileSelect.value || session?.profile?.name;
  if (!name) return;
  const record = getProfile(name);
  const profile = record?.profile || session?.profile;
  if (!profile) return;

  try {
    const filename = await writeProfileJsonFile(profile);
    showToast(`Wrote ${filename}`);
  } catch (err) {
    showToast(err?.message || "Failed to write JSON file.");
  }
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

// ---- Guided builder controls ----
openBuilderBtn.addEventListener("click", () => openGuidedBuilder(createDraft()));

editProfileBtn.addEventListener("click", () => {
  const profile = getProfileForEditing();
  if (!profile) {
    showToast("Load or select a profile first.");
    return;
  }
  openGuidedBuilder(inferDraftFromProfile(profile));
});

builderCancelBtn.addEventListener("click", () => builderModal.close());
builderResetBtn.addEventListener("click", resetBuilderToBaseline);

[builderCountry, builderProcess, builderRoastLevel].forEach((input) => {
  input.addEventListener("change", resetBuilderToBaseline);
});

[builderRegion, builderBatchSize].forEach((input) => {
  input.addEventListener("input", () => {
    refreshBuilderAutoName();
    renderBuilderPreview();
  });
});

[
  builderName,
  builderCropYear,
  builderChargeTemp,
  builderDryingMin,
  builderMaillardTemp,
  builderMaillardMin,
  builderPeakTemp,
  builderDevelopmentTemp,
  builderDevelopmentPct,
  builderNotes
].forEach((input) => {
  input.addEventListener("input", renderBuilderPreview);
});

builderPreviewBtn.addEventListener("click", () => {
  const result = renderBuilderPreview();
  loadProfile(parseProfile(result.profile), `Previewing: ${result.profile.name}`);
  builderModal.close();
});

builderSaveBtn.addEventListener("click", () => {
  const result = renderBuilderPreview();
  try {
    saveProfile(result.profile);
    loadProfile(parseProfile(result.profile), `Loaded: ${result.profile.name}`);
    renderProfileLibrary();
    profileSelect.value = result.profile.name;
    builderModal.close();
    showToast(`Saved profile: ${result.profile.name}`);
  } catch (err) {
    showToast(err?.message || "Failed to save profile.");
  }
});

builderExportBtn.addEventListener("click", () => {
  const result = renderBuilderPreview();
  downloadJson(`${safeFilename(result.profile.name)}.json`, result.profile);
});

builderWriteBtn.addEventListener("click", async () => {
  const result = renderBuilderPreview();
  try {
    const filename = await writeProfileJsonFile(result.profile);
    showToast(`Wrote ${filename}`);
  } catch (err) {
    showToast(err?.message || "Failed to write JSON file.");
  }
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
  populateBuilderSelect(builderCountry, guidedProfileOptions.countries);
  populateBuilderSelect(builderProcess, guidedProfileOptions.processes);
  populateBuilderSelect(builderRoastLevel, guidedProfileOptions.roastLevels);
  applyBuilderDraft(createDraft());
  renderBuilderPreview();
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

  if (action === "complete") {
    openSummaryForRecord(roast);
    return;
  }

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
