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
      paused: 0,
      pomodoros: 0
    };
  }

  // Compatibilidade com dados salvos por versões anteriores.
  dailyStats[today].focus = Number(dailyStats[today].focus) || 0;
  dailyStats[today].distraction = Number(dailyStats[today].distraction) || 0;
  dailyStats[today].paused = Number(dailyStats[today].paused) || 0;
  dailyStats[today].pomodoros = Number(dailyStats[today].pomodoros) || 0;

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
// HISTÓRICO PERSISTENTE
// ===============================
const HISTORY_STORAGE_KEY = "focusTimerHistory";
const MAX_HISTORY_ITEMS = 1000;

function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    return [];
  }
}

let historyEntries = loadHistory();

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyEntries));
  } catch (error) {
    console.error("Erro ao salvar histórico:", error);
  }
}

function formatHistoryTimestamp(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const time = `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;

  if (sameDay) {
    return time;
  }

  return `${String(date.getDate()).padStart(2, "0")}/${String(
    date.getMonth() + 1
  ).padStart(2, "0")} ${time}`;
}

function renderHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  historyEntries.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = `${formatHistoryTimestamp(entry.timestamp)} — ${entry.text}`;
    list.appendChild(li);
  });
}

function addHistory(text) {
  historyEntries.unshift({
    timestamp: new Date().toISOString(),
    text
  });

  if (historyEntries.length > MAX_HISTORY_ITEMS) {
    historyEntries = historyEntries.slice(0, MAX_HISTORY_ITEMS);
  }

  saveHistory();
  renderHistory();
}

function clearHistory() {
  historyEntries = [];
  saveHistory();
  renderHistory();
}

// ===============================
// ESTADO ATUAL DO CRONÔMETRO
// ===============================
const SESSION_STORAGE_KEY = "focusTimerSessionState";

function saveSessionState() {
  try {
    const sessionState = {
      studyTime,
      breakTime,
      distractionTime,
      pomodoros,
      state,
      paused,
      speed,
      autoStart,
      focusStartedLogged,
      breakStartedLogged,
      isLongBreak,
      sessionHasStarted
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionState));
  } catch (error) {
    console.error("Erro ao salvar estado do cronômetro:", error);
  }
}

function loadSessionState() {
  try {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);

    if (!saved) {
      return;
    }

    const parsed = JSON.parse(saved);

    studyTime = Number.isFinite(Number(parsed.studyTime))
      ? Math.max(0, Number(parsed.studyTime))
      : STUDY_TOTAL;
    breakTime = Number.isFinite(Number(parsed.breakTime))
      ? Math.max(0, Number(parsed.breakTime))
      : SHORT_BREAK;
    distractionTime = Number(parsed.distractionTime) || 0;
    pomodoros = Number(parsed.pomodoros) || 0;
    state = ["study", "break", "distracted"].includes(parsed.state)
      ? parsed.state
      : "study";
    paused = Boolean(parsed.paused);
    speed = Number(parsed.speed) || 1;
    autoStart = Boolean(parsed.autoStart);
    focusStartedLogged = Boolean(parsed.focusStartedLogged);
    breakStartedLogged = Boolean(parsed.breakStartedLogged);
    isLongBreak = Boolean(parsed.isLongBreak);
    sessionHasStarted = Boolean(parsed.sessionHasStarted);
  } catch (error) {
    console.error("Erro ao restaurar estado do cronômetro:", error);
  }
}

// ===============================
// PAINEL DE ESTATÍSTICAS
// ===============================
function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateToKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateKey, includeYear = false) {
  const date = parseDateKey(dateKey);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    ...(includeYear ? { year: "numeric" } : {})
  });
}

function getStatsForKey(dateKey) {
  const stats = dailyStats[dateKey] || {};
  return {
    focus: Number(stats.focus) || 0,
    distraction: Number(stats.distraction) || 0,
    paused: Number(stats.paused) || 0,
    pomodoros: Number(stats.pomodoros) || 0
  };
}

function sumStats(keys) {
  return keys.reduce(
    (total, key) => {
      const stats = getStatsForKey(key);
      total.focus += stats.focus;
      total.distraction += stats.distraction;
      total.paused += stats.paused;
      total.pomodoros += stats.pomodoros;
      return total;
    },
    { focus: 0, distraction: 0, paused: 0, pomodoros: 0 }
  );
}

function getSortedStatKeys() {
  return Object.keys(dailyStats)
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .sort((a, b) => b.localeCompare(a));
}

function getWeekKeys() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);

  return getSortedStatKeys().filter((key) => {
    const date = parseDateKey(key);
    return date >= monday && date <= today;
  });
}

function getMonthKeys() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  return getSortedStatKeys().filter((key) => {
    const date = parseDateKey(key);
    return date.getFullYear() === year && date.getMonth() === month;
  });
}

function focusRate(stats) {
  const productiveTime = stats.focus + stats.distraction;
  if (productiveTime <= 0) {
    return null;
  }
  return (stats.focus / productiveTime) * 100;
}

function formatPercent(value) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function renderDailyStatsTable() {
  const body = document.getElementById("dailyStatsBody");
  if (!body) return;

  const keys = getSortedStatKeys();
  body.innerHTML = "";

  const activeKeys = keys.filter((key) => {
    const stats = getStatsForKey(key);
    return stats.focus || stats.distraction || stats.paused || stats.pomodoros;
  });

  if (activeKeys.length === 0) {
    body.innerHTML =
      '<tr><td class="empty-stats" colspan="6">Ainda não há dados registrados.</td></tr>';
    return;
  }

  activeKeys.forEach((key) => {
    const stats = getStatsForKey(key);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatDateLabel(key, true)}</td>
      <td>${formatTotalTime(stats.focus)}</td>
      <td>${formatTotalTime(stats.distraction)}</td>
      <td>${formatTotalTime(stats.paused)}</td>
      <td>${stats.pomodoros}</td>
      <td>${formatPercent(focusRate(stats))}</td>
    `;
    body.appendChild(row);
  });
}

function renderAnalytics() {
  const todayKey = getDateKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateToKey(yesterday);

  const todayStats = getStatsForKey(todayKey);
  const yesterdayStats = getStatsForKey(yesterdayKey);
  const weekStats = sumStats(getWeekKeys());
  const monthKeys = getMonthKeys();
  const monthStats = sumStats(monthKeys);
  const allKeys = getSortedStatKeys();
  const allStats = sumStats(allKeys);

  const activeMonthKeys = monthKeys.filter((key) => {
    const stats = getStatsForKey(key);
    return stats.focus > 0 || stats.distraction > 0 || stats.paused > 0;
  });
  const averageFocus =
    activeMonthKeys.length > 0
      ? Math.round(monthStats.focus / activeMonthKeys.length)
      : 0;

  let bestKey = null;
  let bestFocus = 0;
  allKeys.forEach((key) => {
    const focus = getStatsForKey(key).focus;
    if (focus > bestFocus) {
      bestFocus = focus;
      bestKey = key;
    }
  });

  document.getElementById("metricToday").textContent = formatTotalTime(
    todayStats.focus
  );
  document.getElementById("metricTodayDetail").textContent = `${todayStats.pomodoros} pomodoro${
    todayStats.pomodoros === 1 ? "" : "s"
  }`;

  document.getElementById("metricYesterday").textContent = formatTotalTime(
    yesterdayStats.focus
  );
  document.getElementById("metricYesterdayDetail").textContent = `${yesterdayStats.pomodoros} pomodoro${
    yesterdayStats.pomodoros === 1 ? "" : "s"
  }`;

  document.getElementById("metricWeek").textContent = formatTotalTime(
    weekStats.focus
  );
  document.getElementById("metricWeekDetail").textContent = `${weekStats.pomodoros} pomodoro${
    weekStats.pomodoros === 1 ? "" : "s"
  }`;

  document.getElementById("metricMonth").textContent = formatTotalTime(
    monthStats.focus
  );
  document.getElementById("metricMonthDetail").textContent = `${monthStats.pomodoros} pomodoro${
    monthStats.pomodoros === 1 ? "" : "s"
  }`;

  document.getElementById("metricAverage").textContent = formatTotalTime(
    averageFocus
  );
  document.getElementById("metricAverageDetail").textContent = `${activeMonthKeys.length} dia${
    activeMonthKeys.length === 1 ? "" : "s"
  } registrado${activeMonthKeys.length === 1 ? "" : "s"} no mês`;

  document.getElementById("metricBest").textContent = formatTotalTime(bestFocus);
  document.getElementById("metricBestDetail").textContent = bestKey
    ? formatDateLabel(bestKey, true)
    : "—";

  document.getElementById("metricPomodoros").textContent = allStats.pomodoros;
  document.getElementById("metricFocusRate").textContent = formatPercent(
    focusRate(allStats)
  );

  document.getElementById("monthFocusDetail").textContent = formatTotalTime(
    monthStats.focus
  );
  document.getElementById("monthDistractionDetail").textContent =
    formatTotalTime(monthStats.distraction);
  document.getElementById("monthPausedDetail").textContent = formatTotalTime(
    monthStats.paused
  );

  renderDailyStatsTable();
}

function exportStatsCsv() {
  const keys = getSortedStatKeys();
  const header = [
    "Data",
    "Foco (segundos)",
    "Distração (segundos)",
    "Pausado (segundos)",
    "Pomodoros",
    "Taxa de foco (%)"
  ];

  const rows = keys.map((key) => {
    const stats = getStatsForKey(key);
    const rate = focusRate(stats);
    return [
      key,
      stats.focus,
      stats.distraction,
      stats.paused,
      stats.pomodoros,
      rate === null ? "" : rate.toFixed(1)
    ];
  });

  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `focus-timer-estatisticas-${getDateKey()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ===============================
// CONFIGURAÇÕES VISÍVEIS
// ===============================
function fillSettingsInputs() {
  document.getElementById("speedSelect").value = String(speed);

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
  renderAnalytics();
  saveSessionState();
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

  if (!skipped) {
    const todayStats = ensureTodayStats();
    todayStats.pomodoros += 1;
    saveDailyStats();
  }

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

loadSessionState();
renderHistory();
fillSettingsInputs();
updateUI();
