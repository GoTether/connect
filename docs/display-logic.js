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

// -------------------- Reset Logic --------------------
window.resetTether = (id) => {
  showModal("Are you sure you want to delete this Tether and start over?", confirmed => {
    if (confirmed) {
      remove(ref(db, `tethers/${id}`)).then(() => window.location.href = "display.html");
    }
  }, true);
};

// -------------------- Landing --------------------
function renderLanding() {
  appEl.innerHTML = `
    <div class="text-center mt-24 space-y-6">
      <h1 class="text-4xl font-bold">Welcome to Tether</h1>
      <p class="text-lg text-gray-300">Every object has a story. <span class="text-indigo-400">Tether to it.</span></p>
      <p class="text-sm text-gray-400">Scan a QR or NFC tag, or enter an ID manually:</p>
      <div class="flex items-center justify-center gap-2 mt-4">
        <input id="manualId" type="text" aria-label="Tether ID" placeholder="Enter Tether ID..." class="px-4 py-2 rounded bg-slate-700 text-white border border-slate-600 focus:outline-none"/>
        <button onclick="goToTether()" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white">Go</button>
      </div>
    </div>
  `;
  document.getElementById("manualId").addEventListener("keydown", e => {
    if (e.key === "Enter") goToTether();
  });
}
window.goToTether = () => {
  const id = document.getElementById("manualId").value.trim();
  if (id) window.location.href = `display.html?id=${id}`;
};

// -------------------- Unassigned --------------------
async function renderUnassigned(id) {
  const snap = await get(ref(db, "global_templates"));
  const templates = snap.val() || {};
  const terra = Object.entries(templates).filter(([, t]) => (t.log_scope || "").toLowerCase() === "terra");

  appEl.innerHTML = `
    <div class="max-w-lg mx-auto text-center mt-24 space-y-6">
      <h2 class="text-3xl font-bold">Assign a Template to this Tether</h2>
      <p class="text-gray-400 text-sm">ID: ${id}</p>
      <select id="templateSelect" class="w-full px-4 py-2 bg-slate-700 rounded text-white border border-slate-600">
        <option disabled selected value="">Select a Template...</option>
        ${terra.map(([key, t]) => `<option value="${key}">${t.name}</option>`).join("")}
      </select>
      <div id="templatePreview" class="text-left mt-6 space-y-4"></div>
      <button id="assignBtn" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white mt-4 hidden">Assign Template</button>
    </div>
  `;

  document.getElementById("templateSelect").addEventListener("change", async () => {
    const templateId = document.getElementById("templateSelect").value;
    const template = (await get(ref(db, `global_templates/${templateId}`))).val();
    const preview = document.getElementById("templatePreview");
    preview.innerHTML = `
      <h3 class="text-indigo-300 text-lg font-semibold">Preview: ${template.name}</h3>
      <div class="bg-slate-700 p-4 rounded space-y-2">
        <p class="text-sm text-gray-400">Static Fields:</p>
        ${(template.static_fields || []).map(f => `<p><strong>${f.name}</strong> (${f.type})</p>`).join("")}
        <p class="text-sm text-gray-400 mt-2">Dynamic Fields:</p>
        ${(template.dynamic_fields || []).map(f => `<p><strong>${f.name}</strong> (${f.type})</p>`).join("")}
      </div>
    `;
    document.getElementById("assignBtn").classList.remove("hidden");

    document.getElementById("assignBtn").onclick = () => {
      showStaticFieldModal(template, templateId, id);
    };
  });
}

// -------------------- Static Field Entry --------------------
function showStaticFieldModal(template, templateId, tetherId) {
  appEl.innerHTML = `
    <div class="text-white p-6 bg-slate-800 rounded-lg space-y-4 max-w-md mx-auto">
      <h3 class="text-xl font-semibold">Enter Static Information</h3>
      <form id="staticForm" class="space-y-2">
        ${(template.static_fields || []).map(f => `
          <div>
            <label class="block text-sm text-gray-300 mb-1">${f.name}</label>
            <input name="${f.name}" type="text" class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600"/>
          </div>
        `).join("")}
      </form>
      <div class="flex justify-end gap-4">
        <button id="cancelStatic" class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">Back</button>
        <button id="saveStatic" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded">Save</button>
      </div>
    </div>
  `;

  document.getElementById("cancelStatic").onclick = () => window.location.reload();
  document.getElementById("saveStatic").onclick = async () => {
    const formData = new FormData(document.getElementById("staticForm"));
    const staticData = {};
    for (const [k, v] of formData.entries()) staticData[k] = v;
    await set(ref(db, `tethers/${tetherId}`), {
      template: templateId,
      static: staticData,
      logs: []
    });
    showModal("Tether created!", () => window.location.href = `display.html?id=${tetherId}`);
  };
}

// -------------------- Assigned --------------------
async function renderAssigned(id) {
  const snap = await get(ref(db, `tethers/${id}`));
  const tether = snap.val();
  const template = (await get(ref(db, `global_templates/${tether.template}`))).val();
  const logsSnap = await get(child(ref(db), `tethers/${id}/logs`));
  const logs = logsSnap.exists() ? Object.values(logsSnap.val()) : [];

  const dynamicFields = template.fields || template.dynamic_fields || [];
  const hasTimestampField = dynamicFields.some(f => f.type === "timestamp");

  if (hasTimestampField) {
    setupStopwatch(tether, template);
    return;
  }

  // Render regular form
  // (you already have this, included earlier)
}

// -------------------- Init --------------------
if (!tetherId) renderLanding();
else get(ref(db, `tethers/${tetherId}`)).then(snap =>
  snap.exists() ? renderAssigned(tetherId) : renderUnassigned(tetherId)
).catch(err => {
  appEl.innerHTML = `<p class="text-red-500 mt-10 text-center">Error loading Tether: ${err.message}</p>`;
});
