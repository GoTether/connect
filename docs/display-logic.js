import { ref, get, set, push, update, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const db = firebase.database();
const app = document.getElementById("app");

// Utility: get ID from URL
function getTetherId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

// Utility: show confirmation modal
function showModal(message, callback) {
  document.getElementById("modal-text").textContent = message;
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("modal").onclick = () => {
    document.getElementById("modal").classList.add("hidden");
    if (callback) callback();
  };
}

// Render when no ID is present
function renderNoId() {
  app.innerHTML = `
    <div class="text-center space-y-6 mt-32">
      <h1 class="text-4xl font-bold">Welcome to Tether</h1>
      <p class="text-lg text-gray-300">Every object has a story. <strong class="text-indigo-400">Tether to it.</strong></p>
      <p class="text-sm text-gray-400">Use a QR code or NFC tag to explore or log a memory.</p>
      <div class="flex items-center justify-center gap-2 mt-8">
        <input id="manualId" type="text" placeholder="Enter Tether ID..." class="px-4 py-2 rounded bg-slate-700 text-white border border-slate-600 focus:outline-none focus:ring focus:ring-indigo-500"/>
        <button onclick="goToTether()" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white">Go</button>
      </div>
    </div>
  `;

  // Allow Enter key
  document.getElementById("manualId").addEventListener("keydown", (e) => {
    if (e.key === "Enter") goToTether();
  });
}

// Go to tether by ID
window.goToTether = function () {
  const id = document.getElementById("manualId").value.trim();
  if (id) window.location.href = `display.html?id=${id}`;
};

// Render loading screen
function renderLoading() {
  app.innerHTML = `
    <div class="text-center mt-32 animate-pulse">
      <h2 class="text-2xl font-semibold">Tether Log</h2>
      <p class="text-gray-400 mt-2">Loading...</p>
    </div>
  `;
}

// Main: Display tether
async function displayTether(id) {
  renderLoading();
  const tetherRef = ref(db, `tethers/${id}`);
  const snapshot = await get(tetherRef);

  if (!snapshot.exists()) {
    renderUnassigned(id);
    return;
  }

  const tether = snapshot.val();
  const templateId = tether.template;
  const templateSnap = await get(ref(db, `global_templates/${templateId}`));
  const template = templateSnap.val();

  const staticFields = template.static_fields || [];
  const dynamicFields = template.dynamic_fields || [];
  const logs = tether.logs || [];

  app.innerHTML = `
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold mb-1">${template.name}</h1>
        <p class="text-sm text-gray-400 mb-1">Template: <span class="text-white">${templateId}</span></p>
        <p class="text-sm text-gray-400 mb-1">Tether ID: <span class="text-white">${id}</span></p>
        <button onclick="resetTether('${id}')" class="text-red-400 text-sm underline hover:text-red-300 mt-1">Reset this Tether</button>
      </div>

      <div class="bg-slate-700 p-4 rounded space-y-2">
        ${staticFields.map(field => `
          <div>
            <label class="block text-sm text-gray-300 mb-1">${field.name}</label>
            <input class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600"
              value="${tether.static?.[field.name] || ''}" disabled />
          </div>
        `).join("")}
      </div>

      <form id="logForm" class="space-y-4">
        <h2 class="text-xl font-semibold">New Entry</h2>
        ${dynamicFields.map(field => renderField(field)).join("")}
        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white">Submit Entry</button>
      </form>

      <div id="logList" class="space-y-3">
        ${logs.map(log => renderLogTile(log)).join("")}
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

// Render log entry tile
function renderLogTile(log) {
  return `
    <div class="bg-slate-700 rounded p-3 border border-slate-600">
      <p class="text-sm text-gray-300 mb-1">${new Date(log.timestamp).toLocaleString()} — <span class="text-indigo-400">${log.location || "Unknown"}</span></p>
      ${Object.entries(log).filter(([k]) => !["timestamp", "location"].includes(k)).map(([k, v]) =>
        `<p><strong>${k}:</strong> ${v}</p>`).join("")}
    </div>
  `;
}

// Render field based on type
function renderField(field) {
  const { name, type, options = [] } = field;
  if (type === "dropdown") {
    return `
      <div>
        <label class="block text-sm text-gray-300 mb-1">${name}</label>
        <select name="${name}" class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600">
          ${options.map(opt => `<option value="${opt}">${opt}</option>`).join("")}
        </select>
      </div>
    `;
  } else if (type === "textarea") {
    return `
      <div>
        <label class="block text-sm text-gray-300 mb-1">${name}</label>
        <textarea name="${name}" rows="3" class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600"></textarea>
      </div>
    `;
  } else {
    return `
      <div>
        <label class="block text-sm text-gray-300 mb-1">${name}</label>
        <input name="${name}" type="text" class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600" />
      </div>
    `;
  }
}

// Render assign/setup UI
async function renderUnassigned(id) {
  const globalSnap = await get(ref(db, `global_templates`));
  const templates = globalSnap.val();
  const terraTemplates = Object.entries(templates).filter(([, t]) => t.log_scope === "terra");

  app.innerHTML = `
    <div class="max-w-lg mx-auto text-center mt-24 space-y-4">
      <h2 class="text-3xl font-bold">Register this Tether</h2>
      <p class="text-gray-400 text-sm">ID: ${id}</p>
      <select id="templateSelect" class="w-full px-4 py-2 bg-slate-700 rounded text-white border border-slate-600">
        ${terraTemplates.map(([key, t]) => `<option value="${key}">${t.name}</option>`).join("")}
      </select>
      <button onclick="assignTemplate('${id}')" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white mt-2">Assign Template</button>
    </div>
  `;
}

// Assign template and save tether
window.assignTemplate = async function (id) {
  const templateId = document.getElementById("templateSelect").value;
  const snapshot = await get(ref(db, `global_templates/${templateId}`));
  const template = snapshot.val();

  const staticObj = {};
  (template.static_fields || []).forEach(field => {
    staticObj[field.name] = "";
  });

  await set(ref(db, `tethers/${id}`), {
    template: templateId,
    static: staticObj,
    logs: []
  });

  window.location.reload();
};

// Reset tether
window.resetTether = function (id) {
  if (confirm("Are you sure you want to delete this Tether and start over?")) {
    remove(ref(db, `tethers/${id}`)).then(() => {
      window.location.href = "display.html";
    });
  }
};

// Get reverse geolocation name
async function getLocationName() {
  try {
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject)
    );
    const { latitude, longitude } = position.coords;
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
    const data = await res.json();
    return data.display_name || `${latitude}, ${longitude}`;
  } catch {
    return "Location Unknown";
  }
}

// Init
const id = getTetherId();
if (!id) renderNoId();
else displayTether(id);
