// ===============================
// CONFIG
// ===============================
const STUDY_TOTAL = 50 * 60;
const SHORT_BREAK = 10 * 60;
const LONG_BREAK = 30 * 60;
const POMODORO_MAX = 4;

// ===============================
// ESTADO
// ===============================
let studyTime = STUDY_TOTAL;
let breakTime = SHORT_BREAK;
let distractionTime = 0;

let pomodoros = 0;
let state = "study"; // study | distracted | break
let paused = true;

let speed = 1;
let autoAdvance = true;

// ===============================
// SOM
// ===============================
const beep = new Audio(
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
);

function playSound() {
  beep.currentTime = 0;
  beep.play();
}

// ===============================
// UTIL
// ===============================
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ===============================
// HISTÓRICO
// ===============================
function addHistory(text) {
  const li = document.createElement("li");
  li.textContent = `${now()} — ${text}`;
  document.getElementById("historyList").prepend(li);
}

function clearHistory() {
  document.getElementById("historyList").innerHTML = "";
}

// ===============================
// UI
// ===============================
function updateUI() {
  document.getElementById("studyTimer").textContent =
    state === "break" ? formatTime(breakTime) : formatTime(studyTime);

  document.getElementById("distractionTimer").textContent =
    formatTime(distractionTime);

  document.getElementById("pomodoros").textContent = pomodoros;
  document.getElementById("pomodoroMax").textContent = POMODORO_MAX;

  const stateEl = document.getElementById("state");
  const autoBtn = document.getElementById("autoBtn");

  autoBtn.textContent = autoAdvance ? "Automática" : "Manual";

  if (paused) {
    stateEl.textContent = "PAUSADO";
    stateEl.style.background = "#555";
  } else if (state === "study") {
    stateEl.textContent = "FOCANDO";
    stateEl.style.background = "#20e070";
  } else if (state === "break") {
    stateEl.textContent =
      breakTime === LONG_BREAK ? "DESCANSO LONGO" : "DESCANSO";
    stateEl.style.background = "#3498db";
  } else {
    stateEl.textContent = "DISTRAÍDO";
    stateEl.style.background = "#ff4d4d";
  }

  document.getElementById("distractBtn").style.display =
    !paused && state === "study" ? "inline-block" : "none";

  document.getElementById("focusBtn").style.display =
    !paused && state === "distracted" ? "inline-block" : "none";

  document.getElementById("skipBreakBtn").style.display =
    !paused && state === "break" ? "inline-block" : "none";

  document.getElementById("skipFocusBtn").style.display =
    !paused && state === "study" ? "inline-block" : "none";
}

// ===============================
// CONTROLES
// ===============================
function togglePause() {
  paused = !paused;
  updateUI();
}

function toggleAuto() {
  autoAdvance = !autoAdvance;
  updateUI();
}

function setSpeed(val) {
  speed = Number(val);
}

function distract() {
  if (!paused && state === "study") {
    state = "distracted";
    addHistory("Entrou em distração");
    updateUI();
  }
}

function returnToFocus() {
  if (!paused && state === "distracted") {
    state = "study";
    addHistory("Voltou a focar");
    updateUI();
  }
}

function skipFocus() {
  if (state === "study") {
    addHistory(`Foco pulado — ${formatTime(STUDY_TOTAL - studyTime)}`);
    startBreak();
  }
}

function skipBreak() {
  if (state === "break") {
    addHistory("Descanso pulado");
    startNextStudy();
  }
}

function resetAll() {
  addHistory("Sessão resetada");
  studyTime = STUDY_TOTAL;
  breakTime = SHORT_BREAK;
  distractionTime = 0;
  pomodoros = 0;
  state = "study";
  paused = true;
  updateUI();
}

// ===============================
// TRANSIÇÕES
// ===============================
function startBreak() {
  playSound();
  addHistory("Foco concluído");
  pomodoros++;
  breakTime = pomodoros % POMODORO_MAX === 0 ? LONG_BREAK : SHORT_BREAK;
  distractionTime = 0;
  state = "break";

  if (!autoAdvance) paused = true;
}

function startNextStudy() {
  playSound();
  addHistory(
    breakTime === LONG_BREAK
      ? "Descanso longo concluído"
      : "Descanso concluído"
  );

  studyTime = STUDY_TOTAL;
  breakTime = SHORT_BREAK;
  state = "study";

  if (!autoAdvance) paused = true;
}

// ===============================
// LOOP
// ===============================
setInterval(() => {
  if (paused) return;

  for (let i = 0; i < speed; i++) {
    if (state === "study") {
      studyTime--;
      if (studyTime <= 0) {
        startBreak();
        break;
      }
    } else if (state === "break") {
      breakTime--;
      if (breakTime <= 0) {
        startNextStudy();
        break;
      }
    } else if (state === "distracted") {
      distractionTime++;
    }
  }

  updateUI();
}, 1000);

// INIT
updateUI();
