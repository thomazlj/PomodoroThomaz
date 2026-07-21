// ===============================
// CONFIG
// ===============================
const STUDY_TOTAL = 60 * 60;
const SHORT_BREAK = 10 * 60;
const LONG_BREAK = 30 * 60;
const POMODORO_MAX = 4;

// ===============================
// ESTADO
// ===============================
let studyTime = STUDY_TOTAL;
let breakTime = SHORT_BREAK;
let distractionTime = 0;

let totalFocusSeconds = 0;
let totalDistractionSeconds = 0;
let sessionHasStarted = false;

let pomodoros = 0;
let state = "study";
let paused = true;

let speed = 1;
let autoStart = false;

let focusStartedLogged = false;
let breakStartedLogged = false;
let isLongBreak = false;

// ===============================
// AUDIO
// ===============================
let audioCtx = null;

function beep(duration = 200, frequency = 880, volume = 0.2) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.start();
  osc.stop(audioCtx.currentTime + duration / 1000);
}

function focusEndSound() {
  beep(200, 880);
  setTimeout(() => beep(200, 880), 300);
}

function breakEndSound() {
  beep(500, 523);
}

// ===============================
// UTIL
// ===============================
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function formatTotalTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  return `${h}:${m}`;
}

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// ===============================
// MEMÓRIA E ESTATÍSTICAS DIÁRIAS
// ===============================
const STATS_STORAGE_KEY = "focusTimerDailyStats";

function getDateKey() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function loadDailyStats() {
  try {
    const savedStats = localStorage.getItem(STATS_STORAGE_KEY);

    if (!savedStats) {
      return {};
    }

    return JSON.parse(savedStats);
  } catch (error) {
    console.error("Erro ao carregar estatísticas:", error);
    return {};
  }
}

let dailyStats = loadDailyStats();

function ensureTodayStats() {
  const today = getDateKey();

  if (!dailyStats[today]) {
    dailyStats[today] = {
      focus: 0,
      distraction: 0,
      paused: 0
    };
  }

  return dailyStats[today];
}

function saveDailyStats() {
  try {
    localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify(dailyStats)
    );
  } catch (error) {
    console.error("Erro ao salvar estatísticas:", error);
  }
}

function addDailyTime(type, seconds = 1) {
  const todayStats = ensureTodayStats();

  todayStats[type] += seconds;

  saveDailyStats();
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

  document.getElementById("totalFocus").textContent =
    formatTotalTime(totalFocusSeconds);

  document.getElementById("totalDistraction").textContent =
    formatTotalTime(totalDistractionSeconds);

  document.getElementById("pomodoros").textContent = pomodoros;
  document.getElementById("pomodoroMax").textContent = POMODORO_MAX;

  const s = document.getElementById("state");

  if (paused) {
    s.textContent = "PAUSADO";
    s.style.background = "#555";
  } else if (state === "study") {
    s.textContent = "FOCANDO";
    s.style.background = "#20e070";
  } else if (state === "break") {
    s.textContent = isLongBreak ? "DESCANSO LONGO" : "DESCANSO";
    s.style.background = "#3498db";
  } else {
    s.textContent = "DISTRAÍDO";
    s.style.background = "#ff4d4d";
  }

  document.getElementById("distractBtn").style.display =
    !paused && state === "study" ? "inline-block" : "none";

  document.getElementById("focusBtn").style.display =
    !paused && state === "distracted" ? "inline-block" : "none";

  document.getElementById("skipBreakBtn").style.display =
    !paused && state === "break" ? "inline-block" : "none";

  document.getElementById("skipFocusBtn").style.display =
    !paused && state === "study" ? "inline-block" : "none";

  document.getElementById("autoStartBtn").textContent =
    autoStart ? "ON" : "OFF";

  drawPiP();
}

// ===============================
// CONTROLES
// ===============================
function togglePause() {
  if (paused) {
    paused = false;
    sessionHasStarted = true;

    if (state === "study" && studyTime === STUDY_TOTAL && !focusStartedLogged) {
      addHistory("Foco iniciado");
      focusStartedLogged = true;
    } else if (state === "break" && !breakStartedLogged) {
      addHistory(
        isLongBreak
          ? "Descanso iniciado — 30:00"
          : "Descanso iniciado — 10:00"
      );
      breakStartedLogged = true;
    } else {
      addHistory("▶️ Play");
    }

  } else {
    paused = true;
    addHistory("⏸ Pause");
  }

  updateUI();
}

function toggleAutoStart() {
  autoStart = !autoStart;
  updateUI();
}

function setSpeed(v) {
  speed = Number(v);
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
    addHistory(
      `Foco pulado — Foco: ${formatTime(STUDY_TOTAL - studyTime)} | Distração: ${formatTime(distractionTime)}`
    );
    startBreak(false, true);
  }
}

function skipBreak() {
  if (state === "break") {
    addHistory("Descanso pulado");
    startNextStudy(false, true);
  }
}

function resetAll() {
  addHistory(
    `Sessão resetada — Foco: ${formatTime(STUDY_TOTAL - studyTime)} | Distração: ${formatTime(distractionTime)}`
  );
  studyTime = STUDY_TOTAL;
  breakTime = SHORT_BREAK;
  distractionTime = 0;
  pomodoros = 0;
  focusStartedLogged = false;
  breakStartedLogged = false;
  isLongBreak = false;
  state = "study";
  paused = true;
  updateUI();
}

// ===============================
// TRANSIÇÕES
// ===============================
function startBreak(playSound = true, skipped = false) {
  if (playSound) focusEndSound();

  if (!skipped) {
    addHistory(
      `Foco concluído — Foco: ${formatTime(STUDY_TOTAL)} | Distração: ${formatTime(distractionTime)}`
    );
  }

  pomodoros++;
  isLongBreak = pomodoros % POMODORO_MAX === 0;
  breakTime = isLongBreak ? LONG_BREAK : SHORT_BREAK;

  distractionTime = 0;
  state = "break";
  breakStartedLogged = false;
  focusStartedLogged = false;

  paused = !autoStart;

  if (autoStart) {
    addHistory(
      isLongBreak
        ? "Descanso iniciado — 30:00"
        : "Descanso iniciado — 10:00"
    );
    breakStartedLogged = true;
  }
}

function startNextStudy(playSound = true, skipped = false) {
  if (playSound) breakEndSound();

  if (!skipped) {
    addHistory(
      isLongBreak
        ? "Descanso longo concluído — 30:00"
        : "Descanso concluído — 10:00"
    );
  }

  studyTime = STUDY_TOTAL;
  breakTime = SHORT_BREAK;
  isLongBreak = false;
  focusStartedLogged = false;
  state = "study";
  paused = !autoStart;
}

// ===============================
// LOOP
// ===============================
setInterval(() => {
  if (paused) {
    if (sessionHasStarted) {
      addDailyTime("paused", 1);
    }

    return;
  }

  for (let i = 0; i < speed; i++) {

    if (state === "study") {
      studyTime--;
      totalFocusSeconds++;

      addDailyTime("focus", 1);

      if (totalFocusSeconds % 3600 === 0) {
        addHistory(
          `⏱️ Foco total acumulado: ${formatTotalTime(totalFocusSeconds)}`
        );
      }

      if (studyTime <= 0) {
        startBreak(true, false);
        break;
      }

    } else if (state === "break") {

      breakTime--;

      if (breakTime <= 0) {
        startNextStudy(true, false);
        break;
      }

    } else if (state === "distracted") {

      distractionTime++;
      totalDistractionSeconds++;

      addDailyTime("distraction", 1);

      if (totalDistractionSeconds % 3600 === 0) {
        addHistory(
          `🚨 Distração total acumulada: ${formatTotalTime(totalDistractionSeconds)}`
        );
      }
    }
  }

  updateUI();
}, 1000);

// ===============================
// PICTURE-IN-PICTURE
// ===============================
const pipCanvas = document.createElement("canvas");
pipCanvas.width = 400;
pipCanvas.height = 200;
const pipCtx = pipCanvas.getContext("2d");

const pipVideo = document.getElementById("pipVideo");
pipVideo.srcObject = pipCanvas.captureStream();
pipVideo.play();

function drawPiP() {
  pipCtx.clearRect(0, 0, 400, 200);

  pipCtx.fillStyle = "#000";
  pipCtx.fillRect(0, 0, 400, 200);

  pipCtx.fillStyle = "#20e070";
  pipCtx.font = "bold 48px Arial";
  pipCtx.textAlign = "center";
  pipCtx.fillText(
    state === "break" ? formatTime(breakTime) : formatTime(studyTime),
    200,
    110
  );

  pipCtx.font = "bold 20px Arial";
  pipCtx.fillText(
    paused
      ? "PAUSADO"
      : state === "study"
      ? "FOCANDO"
      : state === "break"
      ? (isLongBreak ? "DESCANSO LONGO" : "DESCANSO")
      : "DISTRAÍDO",
    200,
    40
  );
}

async function togglePiP() {
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture();
  } else {
    await pipVideo.requestPictureInPicture();
  }
}

updateUI();
