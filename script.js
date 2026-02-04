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

  if (state === "distracted") {
    stateEl.style.background = "#ff4d4d";
    stateEl.style.color = "#300";
  } else {
    stateEl.style.background = "#20e070";
    stateEl.style.color = "#0a2";
  }
}
