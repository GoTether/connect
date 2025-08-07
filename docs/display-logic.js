import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, push, remove, child } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyAZoL7FPJ8wBqz_sX81Fo5eKXpsOVrLUZ0",
  authDomain: "tether-71e0c.firebaseapp.com",
  databaseURL: "https://tether-71e0c-default-rtdb.firebaseio.com",
  projectId: "tether-71e0c",
  storageBucket: "tether-71e0c.appspot.com",
  messagingSenderId: "277809008742",
  appId: "1:277809008742:web:2586a2b821d8da8f969da7",
  measurementId: "G-X7ZQ6DJYEN"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- DOM Hook ---
const appEl = document.getElementById("app");

// --- Helpers ---
function getTetherId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function showModal(message, callback) {
  document.getElementById("modal-text").textContent = message;
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("modal").onclick = () => {
    document.getElementById("modal").classList.add("hidden");
    if (callback) callback();
  };
}

function renderLoading() {
  appEl.innerHTML = `<div class="text-center mt-32 text-gray-400 animate-pulse">Loading Tether...</div>`;
}

// --- No ID ---
function renderNoId() {
  appEl.innerHTML = `
    <div class="text-center mt-32 space-y-6">
      <h1 class="text-4xl font-bold">Welcome to Tether</h1>
      <p class="text-lg text-gray-300">Every object has a story. <span class="text-indigo-400">Tether to it.</span></p>
      <p class="text-sm text-gray-400">Scan a QR or tap an NFC tag to begin. Or enter an ID manually:</p>
      <div class="flex items-center justify-center gap-2 mt-4">
        <input id="manualId" type="text" placeholder="Enter Tether ID..." class="px-4 py-2 rounded bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring focus:ring-indigo-500"/>
        <button onclick="goToTether()" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white">Go</button>
      </div>
    </div>
  `;
  document.getElementById("manualId").addEventListener("keydown", e => {
    if (e.key === "Enter") goToTether();
  });
}
window.goToTether = function () {
  const id = document.getElementById("manualId").value.trim();
  if (id) window.location.href = `display.html?id=${id}`;
};

// --- Reverse Geolocation ---
async function getLocationName() {
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
    const { latitude, longitude } = pos.coords;
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
    const data = await response.json();
    return data.display_name || `${latitude}, ${longitude}`;
  } catch {
    return "Location Unknown";
  }
}

// --- Template Preview UI ---
function renderFieldPreview(fields, title) {
  if (!fields?.length) return `<p class="text-gray-400">${title}: None</p>`;
  return `
    <h4 class="text-white font-semibold text-md mt-3">${title}</h4>
    ${fields.map(f => `
      <div>
        <label class="block text-sm text-gray-300">${f.name}</label>
        <input class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600" disabled value="${f.type}" />
      </div>
    `).join("")}
  `;
}

// --- Render Unassigned Tether ---
async function renderUnassigned(id) {
  const snapshot = await get(ref(db, `global_templates`));
  const templates = snapshot.val() || {};
  const terraTemplates = Object.entries(templates).filter(([, t]) => t.log_scope === "terra");

  appEl.innerHTML = `
    <div class="max-w-lg mx-auto text-center mt-24 space-y-6">
      <h2 class="text-3xl font-bold">Assign a Template to this Tether</h2>
      <p class="text-gray-400 text-sm">ID: ${id}</p>
      <select id="templateSelect" class="w-full px-4 py-2 bg-slate-700 rounded text-white border border-slate-600">
        <option disabled selected value="">Select a Template...</option>
        ${terraTemplates.map(([key, t]) => `<option value="${key}">${t.name}</option>`).join("")}
      </select>
      <div id="templatePreview" class="text-left mt-6 space-y-4"></div>
      <button id="assignBtn" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white mt-4 hidden">Assign Template</button>
    </div>
  `;

  const select = document.getElementById("templateSelect");
  const preview = document.getElementById("templatePreview");
  const assignBtn = document.getElementById("assignBtn");

  select.addEventListener("change", async () => {
    const selectedId = select.value;
    const tSnap = await get(ref(db, `global_templates/${selectedId}`));
    const template = tSnap.val();

    preview.innerHTML = `
      <h3 class="text-lg font-semibold text-indigo-300">Preview: ${template.name}</h3>
      <div class="bg-slate-700 p-4 rounded space-y-2">
        ${renderFieldPreview(template.static_fields, "Static Fields")}
        ${renderFieldPreview(template.dynamic_fields, "Dynamic Fields")}
      </div>
    `;

    assignBtn.classList.remove("hidden");
    assignBtn.onclick = async () => {
      const staticData = {};
      (template.static_fields || []).forEach(f => staticData[f.name] = "");
      await set(ref(db, `tethers/${id}`), {
        template: selectedId,
        static: staticData,
        logs: []
      });
      window.location.reload();
    };
  });
}

// --- Initialize Existing Tether ---
async function renderTether(id) {
  renderLoading();
  const tSnap = await get(ref(db, `tethers/${id}`));
  if (!tSnap.exists()) return renderUnassigned(id);

  const tether = tSnap.val();
  const templateSnap = await get(ref(db, `global_templates/${tether.template}`));
  const template = templateSnap.val();

  const logsSnap = await get(child(ref(db), `tethers/${id}/logs`));
  const logs = logsSnap.exists() ? Object.values(logsSnap.val()) : [];

  appEl.innerHTML = `
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold mb-1">${template.name}</h1>
        <p class="text-sm text-gray-400 mb-1">Template: ${tether.template}</p>
        <p class="text-sm text-gray-400 mb-1">Tether ID: ${id}</p>
        <button onclick="resetTether('${id}')" class="text-red-400 text-sm underline hover:text-red-300 mt-1">Reset this Tether</button>
      </div>

      <div class="bg-slate-700 p-4 rounded space-y-2">
        ${(template.static_fields || []).map(field => `
          <div>
            <label class="block text-sm text-gray-300 mb-1">${field.name}</label>
            <input class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600" value="${tether.static?.[field.name] || ''}" disabled />
          </div>
        `).join("")}
      </div>

      <form id="logForm" class="space-y-4">
        <h2 class="text-xl font-semibold">New Entry</h2>
        ${(template.dynamic_fields || []).map(f => `
          <div>
            <label class="block text-sm text-gray-300 mb-1">${f.name}</label>
            ${f.type === 'dropdown'
              ? `<select name="${f.name}" class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600">${f.options.map(opt => `<option>${opt}</option>`).join('')}</select>`
              : f.type === 'textarea'
              ? `<textarea name="${f.name}" class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600" rows="3"></textarea>`
              : `<input name="${f.name}" class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600" />`}
          </div>
        `).join("")}
        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white">Submit Entry</button>
      </form>

      <div class="space-y-3" id="logList">
        ${logs.map(log => `
          <div class="bg-slate-700 rounded p-3 border border-slate-600">
            <p class="text-sm text-gray-300 mb-1">${new Date(log.timestamp).toLocaleString()} — <span class="text-indigo-400">${log.location || "Unknown"}</span></p>
            ${Object.entries(log).filter(([k]) => !["timestamp", "location"].includes(k)).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join("")}
          </div>
        `).join("")}
      </div>
    </div>
  `;

  document.getElementById("logForm").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const logEntry = {
      timestamp: new Date().toISOString(),
      location: await getLocationName()
    };
    for (const [key, val] of formData.entries()) {
      logEntry[key] = val;
    }
    await push(ref(db, `tethers/${id}/logs`), logEntry);
    showModal("Entry saved!", () => window.location.reload());
  };
}

// --- Reset Logic ---
window.resetTether = function (id) {
  if (confirm("Are you sure you want to delete this Tether and start over?")) {
    remove(ref(db, `tethers/${id}`)).then(() => {
      window.location.href = "display.html";
    });
  }
};

// --- Kickoff ---
const id = getTetherId();
id ? renderTether(id) : renderNoId();
