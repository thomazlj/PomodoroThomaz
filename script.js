// ===============================
// CONFIGURAÇÃO
// ===============================
const SETTINGS_STORAGE_KEY = "focusTimerSettings";

const DEFAULT_SETTINGS = {
  studyMinutes: 60,
  shortBreakMinutes: 10,
  longBreakMinutes: 30,
  pomodoroMax: 4
};

function loadTimerSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!saved) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(saved);

    return {
      studyMinutes: Number(parsed.studyMinutes) || DEFAULT_SETTINGS.studyMinutes,
      shortBreakMinutes: Number(parsed.shortBreakMinutes) || DEFAULT_SETTINGS.shortBreakMinutes,
      longBreakMinutes: Number(parsed.longBreakMinutes) || DEFAULT_SETTINGS.longBreakMinutes,
      pomodoroMax: Number(parsed.pomodoroMax) || DEFAULT_SETTINGS.pomodoroMax
    };
  } catch (error) {
    console.error("Erro ao carregar configurações:", error);
    return { ...DEFAULT_SETTINGS };
  }
}

let timerSettings = loadTimerSettings();

let STUDY_TOTAL = timerSettings.studyMinutes * 60;
let SHORT_BREAK = timerSettings.shortBreakMinutes * 60;
let LONG_BREAK = timerSettings.longBreakMinutes * 60;
let POMODORO_MAX = timerSettings.pomodoroMax;

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
// ÁUDIO
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
// UTILITÁRIOS
// ===============================
function formatTime(sec) {
  const safeSeconds = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const s = String(safeSeconds % 60).padStart(2, "0");

  return `${m}:${s}`;
}

function formatTotalTime(sec) {
  const safeSeconds = Math.max(0, Math.floor(sec));
  const h = String(Math.floor(safeSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0");

  return `${h}:${m}`;
}

function now() {
  const d = new Date();

  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function getCurrentTimerSeconds() {
  return state === "break" ? breakTime : studyTime;
}

function getCurrentTimerTotal() {
  if (state === "break") {
    return isLongBreak ? LONG_BREAK : SHORT_BREAK;
  }

  return STUDY_TOTAL;
}

function getStateLabel() {
  if (paused) {
    return "PAUSADO";
  }

  if (state === "study") {
    return "FOCANDO";
  }

  if (state === "break") {
    return isLongBreak ? "DESCANSO LONGO" : "DESCANSO";
  }

  return "DISTRAÍDO";
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
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(dailyStats));
  } catch (error) {
    console.error("Erro ao salvar estatísticas:", error);
  }
}

function addDailyTime(type, seconds = 1) {
  const todayStats = ensureTodayStats();

  todayStats[type] += seconds;
  saveDailyStats();
}

const todayStatsOnLoad = ensureTodayStats();

totalFocusSeconds = todayStatsOnLoad.focus || 0;
totalDistractionSeconds = todayStatsOnLoad.distraction || 0;

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
// CONFIGURAÇÕES VISÍVEIS
// ===============================
function fillSettingsInputs() {
  document.getElementById("studyMinutesInput").value =
    timerSettings.studyMinutes;
  document.getElementById("shortBreakInput").value =
    timerSettings.shortBreakMinutes;
  document.getElementById("longBreakInput").value =
    timerSettings.longBreakMinutes;
  document.getElementById("pomodoroMaxInput").value =
    timerSettings.pomodoroMax;
}

function showSettingsMessage(text, isError = false) {
  const message = document.getElementById("settingsMessage");

  message.textContent = text;
  message.style.color = isError ? "#ff6b6b" : "#20e070";
}

function applyTimerSettings() {
  if (!paused) {
    showSettingsMessage(
      "Pause o cronômetro antes de alterar os tempos.",
      true
    );
    return;
  }

  const studyMinutes = Number(
    document.getElementById("studyMinutesInput").value
  );
  const shortBreakMinutes = Number(
    document.getElementById("shortBreakInput").value
  );
  const longBreakMinutes = Number(
    document.getElementById("longBreakInput").value
  );
  const pomodoroMax = Number(
    document.getElementById("pomodoroMaxInput").value
  );

  const valuesAreValid =
    Number.isInteger(studyMinutes) &&
    Number.isInteger(shortBreakMinutes) &&
    Number.isInteger(longBreakMinutes) &&
    Number.isInteger(pomodoroMax) &&
    studyMinutes >= 1 &&
    shortBreakMinutes >= 1 &&
    longBreakMinutes >= 1 &&
    pomodoroMax >= 1;

  if (!valuesAreValid) {
    showSettingsMessage(
      "Use apenas números inteiros maiores que zero.",
      true
    );
    return;
  }

  timerSettings = {
    studyMinutes,
    shortBreakMinutes,
    longBreakMinutes,
    pomodoroMax
  };

  STUDY_TOTAL = studyMinutes * 60;
  SHORT_BREAK = shortBreakMinutes * 60;
  LONG_BREAK = longBreakMinutes * 60;
  POMODORO_MAX = pomodoroMax;

  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify(timerSettings)
  );

  studyTime = STUDY_TOTAL;
  breakTime = SHORT_BREAK;
  distractionTime = 0;
  pomodoros = 0;
  state = "study";
  isLongBreak = false;
  focusStartedLogged = false;
  breakStartedLogged = false;
  sessionHasStarted = false;

  addHistory(
    `Tempos alterados — Foco: ${formatTime(STUDY_TOTAL)} | Descanso curto: ${formatTime(
      SHORT_BREAK
    )} | Descanso longo: ${formatTime(LONG_BREAK)} | Ciclos: ${POMODORO_MAX}`
  );

  showSettingsMessage("Tempos aplicados.");
  updateUI();
}

// ===============================
// INTERFACE
// ===============================
function updateProgressBar() {
  const total = getCurrentTimerTotal();
  const remaining = getCurrentTimerSeconds();
  const elapsed = Math.max(0, total - remaining);
  const percent = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;

  const progressBar = document.getElementById("progressBar");

  progressBar.style.width = `${percent}%`;

  if (state === "break") {
    progressBar.style.backgroundColor = "#3498db";
  } else if (state === "distracted") {
    progressBar.style.backgroundColor = "#ff4d4d";
  } else {
    progressBar.style.backgroundColor = "#20e070";
  }
}

function updateDocumentTitle() {
  const time = formatTime(getCurrentTimerSeconds());
  const label = getStateLabel();

  document.title = `${time} — ${label}`;
}

function updateUI() {
  document.getElementById("studyTimer").textContent = formatTime(
    getCurrentTimerSeconds()
  );

  document.getElementById("distractionTimer").textContent =
    formatTime(distractionTime);

  document.getElementById("totalFocus").textContent =
    formatTotalTime(totalFocusSeconds);

  document.getElementById("totalDistraction").textContent =
    formatTotalTime(totalDistractionSeconds);

  document.getElementById("pomodoros").textContent = pomodoros;
  document.getElementById("pomodoroMax").textContent = POMODORO_MAX;

  const s = document.getElementById("state");

  s.textContent = getStateLabel();

  if (paused) {
    s.style.background = "#555";
  } else if (state === "study") {
    s.style.background = "#20e070";
  } else if (state === "break") {
    s.style.background = "#3498db";
  } else {
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

  updateProgressBar();
  updateDocumentTitle();
  drawPiP();
}

// ===============================
// CONTROLES
// ===============================
function togglePause() {
  if (paused) {
    paused = false;
    sessionHasStarted = true;

    if (
      state === "study" &&
      studyTime === STUDY_TOTAL &&
      !focusStartedLogged
    ) {
      addHistory("Foco iniciado");
      focusStartedLogged = true;
    } else if (state === "break" && !breakStartedLogged) {
      addHistory(
        isLongBreak
          ? `Descanso iniciado — ${formatTime(LONG_BREAK)}`
          : `Descanso iniciado — ${formatTime(SHORT_BREAK)}`
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
      `Foco pulado — Foco: ${formatTime(
        STUDY_TOTAL - studyTime
      )} | Distração: ${formatTime(distractionTime)}`
    );

    startBreak(false, true);
    updateUI();
  }
}

function skipBreak() {
  if (state === "break") {
    addHistory("Descanso pulado");
    startNextStudy(false, true);
    updateUI();
  }
}

function resetAll() {
  addHistory(
    `Sessão resetada — Foco: ${formatTime(
      STUDY_TOTAL - studyTime
    )} | Distração: ${formatTime(distractionTime)}`
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
  sessionHasStarted = false;

  updateUI();
}

// ===============================
// TRANSIÇÕES
// ===============================
function startBreak(playSound = true, skipped = false) {
  if (playSound) {
    focusEndSound();
  }

  if (!skipped) {
    addHistory(
      `Foco concluído — Foco: ${formatTime(
        STUDY_TOTAL
      )} | Distração: ${formatTime(distractionTime)}`
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
        ? `Descanso iniciado — ${formatTime(LONG_BREAK)}`
        : `Descanso iniciado — ${formatTime(SHORT_BREAK)}`
    );

    breakStartedLogged = true;
  }
}

function startNextStudy(playSound = true, skipped = false) {
  if (playSound) {
    breakEndSound();
  }

  if (!skipped) {
    addHistory(
      isLongBreak
        ? `Descanso longo concluído — ${formatTime(LONG_BREAK)}`
        : `Descanso concluído — ${formatTime(SHORT_BREAK)}`
    );
  }

  studyTime = STUDY_TOTAL;
  breakTime = SHORT_BREAK;
  isLongBreak = false;
  focusStartedLogged = false;
  state = "study";
  paused = !autoStart;

  if (autoStart) {
    addHistory("Foco iniciado");
    focusStartedLogged = true;
  }
}

// ===============================
// LOOP
// ===============================
setInterval(() => {
  if (paused) {
    if (sessionHasStarted) {
      addDailyTime("paused", 1);
    }

    updateDocumentTitle();
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
          `🚨 Distração total acumulada: ${formatTotalTime(
            totalDistractionSeconds
          )}`
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
pipVideo.play().catch(() => {
  // Alguns navegadores só permitem reprodução após interação do usuário.
});

function drawPiP() {
  pipCtx.clearRect(0, 0, 400, 200);

  pipCtx.fillStyle = "#000";
  pipCtx.fillRect(0, 0, 400, 200);

  pipCtx.fillStyle =
    state === "break"
      ? "#3498db"
      : state === "distracted"
      ? "#ff4d4d"
      : "#20e070";

  pipCtx.font = "bold 48px Arial";
  pipCtx.textAlign = "center";
  pipCtx.fillText(formatTime(getCurrentTimerSeconds()), 200, 110);

  pipCtx.font = "bold 20px Arial";
  pipCtx.fillText(getStateLabel(), 200, 40);
}

async function togglePiP() {
  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await pipVideo.play();
      await pipVideo.requestPictureInPicture();
    }
  } catch (error) {
    console.error("Erro ao abrir Picture-in-Picture:", error);
  }
}

fillSettingsInputs();
updateUI();
