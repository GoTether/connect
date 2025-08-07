
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  onValue,
  remove
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

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
const database = getDatabase(app);

const params = new URLSearchParams(window.location.search);
const tetherId = params.get("id");

const title = document.getElementById("title");
const content = document.getElementById("content");

if (!tetherId) {
  title.textContent = "No Tether ID";
  content.innerHTML = `<p class='text-center mt-6 text-white'>No ID provided in the URL.</p>`;
} else {
  title.textContent = "Tether Log";
  loadTether();
}

async function loadTether() {
  const tetherRef = ref(database, "tethers/" + tetherId);
  const snapshot = await get(tetherRef);

  if (!snapshot.exists()) {
    renderUnassigned();
  } else {
    const tetherData = snapshot.val();
    if (tetherData.template_id) {
      const templateRef = ref(database, "global_templates/" + tetherData.template_id);
      const templateSnap = await get(templateRef);
      if (templateSnap.exists()) {
        const template = templateSnap.val();
        renderAssigned(template, tetherData.template_id);
      } else {
        content.innerHTML = "<p class='text-white'>Template not found.</p>";
      }
    }
  }
}

function renderUnassigned() {
  content.innerHTML = `
    <div class='text-white'>
      <p>This Tether ID is not yet assigned. Choose a template to begin:</p>
      <select id="templateSelect" class="mt-2 p-2 bg-gray-800 text-white rounded"></select>
      <button id="assignBtn" class="ml-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded">Assign</button>
    </div>
  `;

  const select = document.getElementById("templateSelect");
  const assignBtn = document.getElementById("assignBtn");

  get(ref(database, "global_templates")).then((snap) => {
    const all = snap.val();
    Object.entries(all).forEach(([key, tpl]) => {
      if (tpl.log_scope === "terra") {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = tpl.name;
        select.appendChild(option);
      }
    });
  });

  assignBtn.addEventListener("click", () => {
    const selected = select.value;
    if (!selected) return;
    set(ref(database, "tethers/" + tetherId), {
      template_id: selected
    }).then(() => location.reload());
  });
}

async function renderAssigned(template, templateId) {
  const logRef = ref(database, "shared_logs/" + tetherId + "/entries");
  const staticHTML = template.static_fields.map(f => `
    <div class="mb-2">
      <label class="block text-white">${f.name}</label>
      <input id="static-${f.name}" class="w-full p-2 rounded bg-gray-800 text-white" />
    </div>
  `).join("");

  const dynamicHTML = template.dynamic_fields.map(f => {
    if (f.type === "dropdown") {
      return `
        <label class="block text-white mt-2">${f.name}</label>
        <select id="field-${f.name}" class="w-full p-2 rounded bg-gray-800 text-white">
          ${f.options.map(o => `<option>${o}</option>`).join("")}
        </select>
      `;
    } else {
      return `
        <label class="block text-white mt-2">${f.name}</label>
        <input id="field-${f.name}" class="w-full p-2 rounded bg-gray-800 text-white" />
      `;
    }
  }).join("");

  content.innerHTML = `
    <div class="text-white">
      <h2 class="text-xl mb-4">${template.name}</h2>
      <p class="mb-2 text-sm text-gray-400">Tether ID: <code>${tetherId}</code></p>
      <div class="mb-6 bg-gray-900 p-4 rounded">${staticHTML}</div>
      <form id="logForm" class="bg-gray-900 p-4 rounded">${dynamicHTML}
        <button type="submit" class="mt-4 w-full py-2 bg-green-600 hover:bg-green-700 rounded">Submit</button>
      </form>
      <div id="logEntries" class="mt-6"></div>
    </div>
  `;

  document.getElementById("logForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const entry = {};
    for (let f of template.dynamic_fields) {
      const field = document.getElementById("field-" + f.name);
      entry[f.name] = field.value;
      field.value = ""; // reset
    }

    const coords = await getCoords();
    if (coords) {
      entry.latitude = coords.lat;
      entry.longitude = coords.lng;
      entry.location_name = await reverseGeocode(coords.lat, coords.lng);
    }

    entry.timestamp = new Date().toISOString();
    await push(logRef, entry);
    alert("Entry saved!");
    loadTether();
  });

  // render existing entries
  onValue(logRef, (snap) => {
    const logs = snap.val();
    const out = document.getElementById("logEntries");
    out.innerHTML = "";
    if (!logs) return;

    Object.values(logs).forEach(log => {
      const div = document.createElement("div");
      div.className = "p-4 mb-2 bg-gray-800 rounded shadow";
      div.innerHTML = `
        ${Object.entries(log).map(([k, v]) => `
          <p><span class="font-bold">${k}:</span> ${v}</p>
        `).join("")}
      `;
      out.appendChild(div);
    });
  });
}

function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(pos => {
      resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }, () => resolve(null));
  });
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const json = await res.json();
    return json.display_name || `${lat}, ${lng}`;
  } catch {
    return `${lat}, ${lng}`;
  }
}
