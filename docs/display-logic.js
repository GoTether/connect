
// Helper: Show modal
function showModal(message) {
  const modal = document.getElementById("modal");
  const modalText = document.getElementById("modal-text");
  modalText.textContent = message;
  modal.classList.remove("hidden");
}

function hideModal() {
  document.getElementById("modal").classList.add("hidden");
}

const db = firebase.database();
const auth = firebase.auth();
const appDiv = document.getElementById("app");
const urlParams = new URLSearchParams(window.location.search);
const tetherId = urlParams.get("id");

if (!tetherId) {
  // Landing page with info + ID entry
  appDiv.innerHTML = `
    <div class="text-center space-y-6">
      <h1 class="text-4xl font-bold text-indigo-400">Welcome to Tether</h1>
      <p class="text-gray-300 text-lg">Every object has a story. <span class="text-white italic">Tether to it.</span></p>
      <p class="text-sm text-gray-400">Scan a QR or tap an NFC tag to start. Or enter a code manually.</p>
      <div class="flex gap-2 max-w-md mx-auto">
        <input id="idInput" placeholder="Enter Tether ID" class="w-full px-4 py-2 rounded bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
        <button onclick="goWithId()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded">Go</button>
      </div>
    </div>`;
  document.getElementById("idInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") goWithId();
  });
} else {
  // Fetch tether record from database
  db.ref("tethers/" + tetherId).once("value").then(snapshot => {
    const tether = snapshot.val();
    const init = urlParams.get("init");
    if (!tether && !init) return showTemplateSelector();  // unassigned

    db.ref("global_templates/" + tether.template_id).once("value").then(templateSnap => {
      const template = templateSnap.val();
      if (!template) return appDiv.innerHTML = "<p class='text-red-400'>Template not found.</p>";

      if (template.log_scope === "Terra") renderTerraTether(tetherId, template, tether.static);
      else renderAuraPlaceholder();
    });
  });
}

function goWithId() {
  const id = document.getElementById("idInput").value.trim();
  if (id) window.location.href = `display.html?id=${id}`;
}

function showTemplateSelector() {
  db.ref("global_templates").once("value").then(snapshot => {
    const all = snapshot.val() || {};
    const terraTemplates = Object.entries(all).filter(([_, t]) => t.log_scope === "Terra");

    let options = terraTemplates.map(([key, t]) =>
      `<option value="${key}">${t.name}</option>`).join("");

    appDiv.innerHTML = `
      <div class="space-y-4">
        <h2 class="text-2xl font-semibold">Assign a Template to this Tether</h2>
        <select id="templatePicker" class="w-full bg-slate-700 p-2 rounded">${options}</select>
        <div id="staticFields"></div>
        <button onclick="saveNewTether()" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">Save Tether</button>
      </div>
    `;

    document.getElementById("templatePicker").addEventListener("change", renderStaticFields);
    renderStaticFields(); // run once on load
  });
}

function renderStaticFields() {
  const templateId = document.getElementById("templatePicker").value;
  db.ref("global_templates/" + templateId).once("value").then(snapshot => {
    const template = snapshot.val();
    const staticFields = template.static_fields || [];
    const html = staticFields.map(field => {
      return `
        <label class="block mt-4">${field.name}${field.required ? ' *' : ''}</label>
        <input type="text" class="w-full p-2 rounded bg-slate-600 text-white" data-name="${field.name}" required="${field.required}"/>
      `;
    }).join("");
    document.getElementById("staticFields").innerHTML = html;
  });
}

function saveNewTether() {
  const templateId = document.getElementById("templatePicker").value;
  const staticData = {};
  document.querySelectorAll("#staticFields input").forEach(input => {
    staticData[input.dataset.name] = input.value;
  });
  db.ref("tethers/" + tetherId).set({
    template_id: templateId,
    static: staticData
  }).then(() => {
    showModal("Tether assigned successfully.");
    setTimeout(() => {
      window.location.href = `display.html?id=${tetherId}&init=1`;
    }, 1000);
  });
}

function renderTerraTether(id, template, staticData) {
  const logRef = db.ref("shared_logs/" + id + "/entries");
  let staticHtml = Object.entries(staticData).map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`).join("");
  let formHtml = template.dynamic_fields.map(field => {
    if (field.type === "dropdown") {
      const opts = field.options.map(opt => `<option>${opt}</option>`).join("");
      return `<label class="block mt-4">${field.name}</label><select class="w-full p-2 rounded bg-slate-700" data-name="${field.name}">${opts}</select>`;
    } else if (field.type === "textarea") {
      return `<label class="block mt-4">${field.name}</label><textarea class="w-full p-2 rounded bg-slate-700" data-name="${field.name}"></textarea>`;
    } else {
      return `<label class="block mt-4">${field.name}</label><input type="${field.type}" class="w-full p-2 rounded bg-slate-700" data-name="${field.name}"/>`;
    }
  }).join("");

  appDiv.innerHTML = `
    <h2 class="text-2xl font-semibold mb-4">Tether: ${template.name}</h2>
    <div class="mb-4">${staticHtml}</div>
    <form id="entryForm" class="space-y-2">${formHtml}</form>
    <div class="flex gap-4 mt-6">
      <button onclick="submitEntry('${id}')" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded">Submit Entry</button>
      <button onclick="resetTether('${id}')" class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">Reset this Tether</button>
    </div>
  `;
}

function submitEntry(id) {
  const entry = { _timestamp: new Date().toISOString() };
  document.querySelectorAll("#entryForm [data-name]").forEach(field => {
    entry[field.dataset.name] = field.value;
  });
  navigator.geolocation?.getCurrentPosition(pos => {
    entry._lat = pos.coords.latitude;
    entry._lng = pos.coords.longitude;
    db.ref("shared_logs/" + id + "/entries").push(entry).then(() => {
      showModal("Entry saved successfully.");
    });
  }, () => {
    db.ref("shared_logs/" + id + "/entries").push(entry).then(() => {
      showModal("Entry saved (location permission denied).");
    });
  });
}

function resetTether(id) {
  if (!confirm("Are you sure you want to reset this Tether? This cannot be undone.")) return;
  db.ref("tethers/" + id).remove().then(() => {
    db.ref("shared_logs/" + id).remove().then(() => {
      window.location.href = "display.html?id=" + id;
    });
  });
}

function renderAuraPlaceholder() {
  appDiv.innerHTML = `<h2 class="text-2xl font-semibold text-yellow-400">Aura Tether support coming soon</h2>`;
}
