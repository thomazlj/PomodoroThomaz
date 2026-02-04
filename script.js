// ===============================
// CONFIGURAÇÕES
// ===============================
const STUDY_TOTAL = 50 * 60;   // 50 min
const SHORT_BREAK = 5 * 60;    // pausa curta
const LONG_BREAK = 15 * 60;    // pausa longa

// ===============================
// ESTADO GLOBAL
// ===============================
let studyTime = STUDY_TOTAL;
let distractionTime = 0;
let pomodoros = 0;

let state = "idle"; // idle | study | distracted | shortBreak | longBreak
let paused = true;

// ===============================
// FUNÇÕES AUXILIARES
// ===============================
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ===============================
// ATUALIZA UI
// ===============================
function updateUI() {
  document.getElementById("studyTimer").textContent = formatTime(studyTime);
  document.getElementById("distractionTimer").textContent = formatTime(distractionTime);
  document.getElementById("pomodoros").textContent = pomodoros;

  const labels = {
    idle: "PARADO",
    study: "FOCANDO",
    distracted: "DISTRAÍDO",
    shortBreak: "PAUSA CURTA",
    longBreak: "PAUSA LONGA"
  };

  const stateEl = document.getElementById("state");
  stateEl.textContent = labels[state];

  // Cor do estado
  if (state === "distracted") {
    stateEl.style.background = "#ff4d4d";
    stateEl.style.color = "#300";
  } else if (state === "study") {
    stateEl.style.background = "#20e070";
    stateEl.style.color = "#0a2";
  } else {
    stateEl.style.background = "#444";
    stateEl.style.color = "#eee";
  }
}

// ===============================
// CONTROLES
// ===============================
function togglePause() {
  paused = !paused;
}

function startStudy() {
  state = "study";
  paused = false;
}

function distract() {
  if (state === "study") {
    state = "distracted";
    paused = false;
  }
}

function resetAll() {
  studyTime = STUDY_TOTAL;
  distractionTime = 0;
  pomodoros = 0;
  state = "idle";
  paused = true;
}

// ===============================
// LOOP PRINCIPAL
// ===============================
setInterval(() => {
  if (paused) {
    updateUI();
    return;
  }

  if (state === "study") {
    studyTime--;

    if (studyTime <= 0) {
      pomodoros++;

      if (pomodoros === 4) {
        state = "longBreak";
        studyTime = LONG_BREAK;
      } else {
        state = "shortBreak";
        studyTime = SHORT_BREAK;
      }
    }
  }

  else if (state === "distracted") {
    distractionTime++;
  }

  else if (state === "shortBreak" || state === "longBreak") {
    studyTime--;

    if (studyTime <= 0) {
      studyTime = STUDY_TOTAL;
      state = "idle";
      paused = true;
    }
  }

  updateUI();
}, 1000);

// ===============================
// INIT
// ===============================
updateUI();
