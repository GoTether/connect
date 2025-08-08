import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, push, remove, child } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZoL7FPJ8wBqz_sX81Fo5eKXpsOVrLUZ0",
  authDomain: "tether-71e0c.firebaseapp.com",
  databaseURL: "https://tether-71e0c-default-rtdb.firebaseio.com",
  projectId: "tether-71e0c",
  storageBucket: "tether-71e0c.appspot.com",
  messagingSenderId: "277809008742",
  appId: "1:277809008742:web:2586a2b821d8da8f969da7"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const appEl = document.getElementById("app");
const tetherId = new URLSearchParams(window.location.search).get("id");

let timerStart = null;
let timerInterval = null;

// -------------------- Modal Logic --------------------
function showModal(message, callback = null, showCancel = false) {
  const modal = document.getElementById("modal");
  const text = document.getElementById("modal-text");
  const saveBtn = document.getElementById("modal-save");
  const cancelBtn = document.getElementById("modal-cancel");

  text.textContent = message;
  modal.classList.remove("hidden");

  saveBtn.textContent = showCancel ? "OK" : "Save";
  cancelBtn.textContent = showCancel ? "Cancel" : "Back";
  cancelBtn.classList.toggle("hidden", !showCancel);

  saveBtn.onclick = () => {
    modal.classList.add("hidden");
    callback?.(true);
  };
  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
    callback?.(false);
  };
}
window.hideModal = () => document.getElementById("modal").classList.add("hidden");

// -------------------- Geo Lookup --------------------
async function getLocationName(lat, lon) {
  try {
    const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=62199178dce5478f9888f630820a45da`);
    const data = await res.json();
    const c = data.results[0]?.components;
    return c ? `${c.city || c.town || c.village || ""}, ${c.state || ""}` : `${lat}, ${lon}`;
  } catch {
    return `${lat}, ${lon}`;
  }
}

// -------------------- Stopwatch Logic --------------------
function showStopwatchUI() {
  const controls = document.getElementById("stopwatch-controls");
  if (controls) controls.classList.remove("hidden");
}

function updateStopwatchDisplay() {
  const display = document.getElementById("stopwatch-display");
  if (!display || !timerStart) return;
  const elapsed = Math.floor((Date.now() - timerStart) / 1000);
  const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const secs = (elapsed % 60).toString().padStart(2, '0');
  display.textContent = `${mins}:${secs}`;
}

function setupStopwatch(tether, template) {
  showStopwatchUI();
  const startBtn = document.getElementById("start-button");
  const stopBtn = document.getElementById("stop-button");

  startBtn.onclick = () => {
    timerStart = Date.now();
    updateStopwatchDisplay();
    timerInterval = setInterval(updateStopwatchDisplay, 1000);
    startBtn.classList.add("hidden");
    stopBtn.classList.remove("hidden");
  };

  stopBtn.onclick = async () => {
    clearInterval(timerInterval);
    const end = Date.now();
    const durationMin = Math.round((end - timerStart) / 60000);

    const log = {
      timestamp: new Date().toISOString(),
      "Start Time": new Date(timerStart).toISOString(),
      "End Time": new Date(end).toISOString(),
      "Duration (minutes)": durationMin
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        log["Location"] = await getLocationName(pos.coords.latitude, pos.coords.longitude);
        await push(ref(db, `tethers/${tetherId}/logs`), log);
        showModal("Entry saved!", () => window.location.reload());
      });
    } else {
      await push(ref(db, `tethers/${tetherId}/logs`), log);
      showModal("Entry saved!", () => window.location.reload());
    }
  };
}

// -------------------- TODO --------------------
// You still need to insert the call to setupStopwatch()
// inside your renderAssigned(id) function like this:

// After retrieving the template:
// if (template.fields?.some(f => f.type === \"timestamp\")) {
//   setupStopwatch(tether, template);
//   return; // skip the form-based UI
// }

