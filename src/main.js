import { parseProfile } from "./profile/parseProfile.js";
import { RoastSession } from "./roast/RoastSession.js";
import { formatMMSS, toGeneMinutes } from "./ui/timeFormat.js";
import { developmentMetrics, weightLossPct } from "./domain/metrics.js";
import { feedbackText } from "./domain/feedback.js";
import { saveRoast } from "./storage/roastStore.js";
import { showToast } from "./ui/toast.js";
import { RoastGraph } from "./ui/Graph.js";

const el = (id) => document.getElementById(id);

const profileFile = el("profileFile");
const profileStatus = el("profileStatus");

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
const calIndicator = el("calIndicator");

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

let session = null;
let tickHandle = null;
const graph = new RoastGraph(document.getElementById("roastChart"));

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
    graph.render(profile);

    renderIdle();

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
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  dropBtn.disabled = false;
  yellowBtn.disabled = false;
  fcBtn.disabled = false;
  calBtn.disabled = false;

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

  yellowBtn.textContent = `Yellow @ ${t}`;
  yellowBtn.style.opacity = "0.7";
});

fcBtn.addEventListener("click", () => {
  if (!session) return;
  session.mark("firstCrack");

  const t = formatMMSS(session.markers.firstCrackAtS);
  showToast(`First Crack marked at ${t}`);

  fcBtn.textContent = `1C @ ${t}`;
  fcBtn.style.opacity = "0.7";
});

dropBtn.addEventListener("click", () => {
  if (!session) return;

  session.mark("drop");
  session.stop();
  if (tickHandle) clearInterval(tickHandle);

  pauseBtn.disabled = true;
  resumeBtn.disabled = true;
  dropBtn.disabled = true;
  yellowBtn.disabled = true;
  fcBtn.disabled = true;
  calBtn.disabled = true;

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
  // NEW: Use correction logic
  session.setCorrection(actual);

  // Force update immediately
  calIndicator.textContent = `CORR: Active`;
  calModal.close();
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

  const record = {
    id: crypto.randomUUID(),
    createdAtISO: new Date().toISOString(),
    profileName: session.profile.name,
    greenWeightG: Number.isFinite(greenG) ? greenG : null,
    roastedWeightG: Number.isFinite(roastedG) ? roastedG : null,
    markers: { ...session.markers },
    calibration: { ...session.cal },
    metrics: {
      devS: dev?.devS ?? null,
      devPct: dev?.devPct ?? null,
      weightLossPct: lossPct
    },
    feedback: feedbackText({ devPct: dev?.devPct ?? null, lossPct, hasDev: !!dev })
  };

  saveRoast(record);
  summaryModal.close();
  profileStatus.textContent = `Saved roast: ${session.profile.name}`;
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
  setTempEl.textContent = `${recTempC}°C`;

  // Update correction indicator dynamic
  const correctionVal = recTempC - plannedC;
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
  } else {
    nextEventEl.textContent = "No more events.";
  }

  const due = session.dueEvents();
  if (due.length) showEvent(due[0], recTempC);
}
