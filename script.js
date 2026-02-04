// ===== CONFIGURAÇÕES =====
let STUDY_TOTAL = 50 * 60;   // 50 minutos
let SHORT_BREAK = 5 * 60;   // pausa curta
let LONG_BREAK = 15 * 60;   // pausa longa

// ===== ESTADO =====
let studyTime = STUDY_TOTAL;
let distractionTime = 0;
let pomodoros = 0;

let state = "idle";   // idle | study | distracted | shortBreak | longBreak
let paused = true;   // controle geral de pause

// ===== FUNÇÕES AUX =====
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function updateUI() {
  document.getElementById("studyTimer").textContent = formatTime(studyTime);
  document.getElementById("distractionTimer").textContent = formatTime(distractionTime);
  document.getElementById("pomodoros").textContent = pomodoros;

  const labels = {
    idle: "Parado",
    study: "Estudando",
    distracted: "Distraído",
    shortBreak: "Pausa Curta",
    longBreak: "Pausa Longa"
  };

  document.getElementById("state").textContent = labels[state];

  document.getElementById("pauseBtn").textContent = paused ? "▶️ Play" : "⏸️ Pause";
}

// ===== CONTROLES =====
function togglePause() {
  paused = !paused;
  updateUI();
}

function startStudy() {
  state = "study";
  paused = false;
  updateUI();
}

function distract() {
  if (state === "study") {
    state = "distracted";
    paused = false;
    updateUI();
  }
}

function resetAll() {
  studyTime = STUDY_TOTAL;
  distractionTime = 0;
  pomodoros = 0;
  state = "idle";
  paused = true;
  updateUI();
}

// ===== LOOP PRINCIPAL =====
setInterval(() => {
  if (paused) return;

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

// ===== INIT =====
updateUI();
