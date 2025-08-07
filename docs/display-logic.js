async function renderUnassigned(id) {
  const globalSnap = await get(ref(db, `global_templates`));
  const templates = globalSnap.val();
  const terraTemplates = Object.entries(templates).filter(([, t]) => t.log_scope === "terra");

  app.innerHTML = `
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
    const selectedSnap = await get(ref(db, `global_templates/${selectedId}`));
    const selectedTemplate = selectedSnap.val();

    preview.innerHTML = `
      <h3 class="text-lg font-semibold text-indigo-300">Template Preview: ${selectedTemplate.name}</h3>
      <div class="bg-slate-700 p-4 rounded space-y-2">
        <h4 class="text-md font-semibold mb-1 text-white">Static Fields</h4>
        ${selectedTemplate.static_fields?.map(field => `
          <div>
            <label class="block text-sm text-gray-300">${field.name}</label>
            <input class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600" disabled value="${field.type}" />
          </div>
        `).join("") || "<p class='text-gray-400 text-sm'>None</p>"}

        <h4 class="text-md font-semibold mt-4 mb-1 text-white">Dynamic Fields</h4>
        ${selectedTemplate.dynamic_fields?.map(field => `
          <div>
            <label class="block text-sm text-gray-300">${field.name}</label>
            <input class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600" disabled value="${field.type}" />
          </div>
        `).join("") || "<p class='text-gray-400 text-sm'>None</p>"}
      </div>
    `;

    assignBtn.classList.remove("hidden");
    assignBtn.onclick = async () => {
      const staticObj = {};
      (selectedTemplate.static_fields || []).forEach(field => {
        staticObj[field.name] = "";
      });

      await set(ref(db, `tethers/${id}`), {
        template: selectedId,
        static: staticObj,
        logs: []
      });

      window.location.reload();
    };
  });
}
