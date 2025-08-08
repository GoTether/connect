import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, push, remove, child } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Firebase Config
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

// --- Modal Control ---
function showModal(message, cb, showCancel = false) {
  const modal = document.getElementById("modal");
  const text = document.getElementById("modal-text");
  const ok = document.getElementById("modal-save");
  const cancel = document.getElementById("modal-cancel");

  text.textContent = message;
  modal.classList.remove("hidden");

  ok.textContent = "OK";
  cancel.textContent = "Cancel";

  ok.onclick = () => {
    modal.classList.add("hidden");
    cb?.(true);
  };

  cancel.onclick = () => {
    modal.classList.add("hidden");
    cb?.(false);
  };

  cancel.classList.toggle("hidden", !showCancel);
}
window.hideModal = () => document.getElementById("modal").classList.add("hidden");

// --- Reverse Geolocation ---
async function getLocationName(lat, lon) {
  try {
    const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=62199178dce5478f9888f630820a45da`);
    const data = await res.json();
    const comp = data.results[0]?.components;
    return comp ? `${comp.city || comp.town || comp.village || ""}, ${comp.state || ""}` : `${lat}, ${lon}`;
  } catch {
    return `${lat}, ${lon}`;
  }
}

// --- Reset ---
window.resetTether = (id) => {
  showModal("Are you sure you want to delete this Tether and start over?", confirmed => {
    if (confirmed) {
      remove(ref(db, `tethers/${id}`)).then(() => window.location.href = "display.html");
    }
  }, true);
};

// --- Landing ---
function renderLanding() {
  appEl.innerHTML = `
    <div class="text-center mt-24 space-y-6">
      <h1 class="text-4xl font-bold">Welcome to Tether</h1>
      <p class="text-lg text-gray-300">Every object has a story. <span class="text-indigo-400">Tether to it.</span></p>
      <p class="text-sm text-gray-400">Scan a QR or NFC tag, or enter an ID manually:</p>
      <div class="flex items-center justify-center gap-2 mt-4">
        <input id="manualId" type="text" aria-label="Tether ID" placeholder="Enter Tether ID..." class="px-4 py-2 rounded bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring focus:ring-indigo-500"/>
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

// --- Unassigned ---
async function renderUnassigned(id) {
  const snap = await get(ref(db, `global_templates`));
  const allTemplates = snap.val() || {};
  const terraTemplates = Object.entries(allTemplates).filter(([, t]) => (t.log_scope || "").toLowerCase() === "terra");

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

  document.getElementById("templateSelect").addEventListener("change", async () => {
    const selectedId = document.getElementById("templateSelect").value;
    const template = (await get(ref(db, `global_templates/${selectedId}`))).val();
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
      showStaticFieldModal(template, selectedId, id);
    };
  });
}

function showStaticFieldModal(template, templateId, tetherId) {
  const formHtml = (template.static_fields || []).map(field => `
    <label class="block text-left text-sm mt-2">${field.name}</label>
    <input name="${field.name}" type="text" class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600"/>
  `).join("");

  appEl.innerHTML = `
    <div class="text-white p-6 bg-slate-800 rounded-lg space-y-4 max-w-md mx-auto mt-20">
      <h3 class="text-xl font-semibold">Enter Details</h3>
      <form id="staticForm" class="space-y-2">${formHtml}</form>
      <div class="flex justify-end gap-4 mt-4">
        <button id="cancelStatic" class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">Back</button>
        <button id="saveStatic" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded">Save</button>
      </div>
    </div>
  `;

  document.getElementById("cancelStatic").onclick = () => window.location.reload();
  document.getElementById("saveStatic").onclick = async () => {
    const formData = new FormData(document.getElementById("staticForm"));
    const staticData = {};
    for (const [key, val] of formData.entries()) {
      staticData[key] = val;
    }
    await set(ref(db, `tethers/${tetherId}`), {
      template: templateId,
      static: staticData,
      logs: []
    });
    showModal("Tether created!", () => window.location.href = `display.html?id=${tetherId}`);
  };
}

// --- Assigned Tether ---
async function renderAssigned(id) {
  const tSnap = await get(ref(db, `tethers/${id}`));
  const tether = tSnap.val();
  const template = (await get(ref(db, `global_templates/${tether.template}`))).val();
  const logsSnap = await get(child(ref(db), `tethers/${id}/logs`));
  const logs = logsSnap.exists() ? Object.values(logsSnap.val()) : [];

  appEl.innerHTML = `
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold">${template.name}</h1>
        <p class="text-sm text-gray-400">Template: ${tether.template}</p>
        <p class="text-sm text-gray-400">Tether ID: ${id}</p>
        <button onclick="resetTether('${id}')" class="text-red-400 text-sm underline hover:text-red-300 mt-1">Reset this Tether</button>
      </div>

      <div class="bg-slate-700 p-4 rounded space-y-2">
        ${(template.static_fields || []).map(f => `
          <div>
            <label class="block text-sm text-gray-300 mb-1">${f.name}</label>
            <input class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600" value="${tether.static?.[f.name] || ''}" disabled />
          </div>
        `).join("")}
      </div>

      <form id="logForm" class="space-y-4">
        <h2 class="text-xl font-semibold">New Entry</h2>
        ${(template.dynamic_fields || []).map(f => {
          if (f.type === "dropdown") {
            return `
              <div>
                <label class="block text-sm text-gray-300 mb-1">${f.name}</label>
                <select name="${f.name}" class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600">
                  ${(f.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join("")}
                </select>
              </div>
            `;
          } else {
            return `
              <div>
                <label class="block text-sm text-gray-300 mb-1">${f.name}</label>
                <input name="${f.name}" type="${f.type}" class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600" />
              </div>
            `;
          }
        }).join("")}
        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white">Submit Entry</button>
      </form>

      <div class="space-y-3" id="logList">
        ${logs.map(log => `
          <div class="bg-slate-700 rounded p-3 border border-slate-600">
            <p class="text-sm text-gray-300 mb-1">${new Date(log.timestamp).toLocaleString()}</p>
            ${Object.entries(log).filter(([k]) => k !== "timestamp").map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join("")}
          </div>
        `).join("")}
      </div>
    </div>
  `;

  document.getElementById("logForm").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const logEntry = { timestamp: new Date().toISOString() };
    for (const [key, val] of formData.entries()) {
      logEntry[key] = val;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const loc = await getLocationName(pos.coords.latitude, pos.coords.longitude);
        logEntry["Location"] = loc;
        await push(ref(db, `tethers/${id}/logs`), logEntry);
        showModal("Entry saved!", () => window.location.reload());
      });
    } else {
      await push(ref(db, `tethers/${id}/logs`), logEntry);
      showModal("Entry saved!", () => window.location.reload());
    }
  };
}

// --- Initialize ---
if (!tetherId) {
  renderLanding();
} else {
  get(ref(db, `tethers/${tetherId}`)).then(snap => {
    snap.exists() ? renderAssigned(tetherId) : renderUnassigned(tetherId);
  }).catch(err => {
    appEl.innerHTML = `<p class="text-red-500 mt-10 text-center">Error loading Tether: ${err.message}</p>`;
  });
}
