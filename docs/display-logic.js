function showStaticForm(template, templateId, id) {
  const modal = document.getElementById("modal");
  const modalText = document.getElementById("modal-text");
  const box = modal.querySelector("div");

  const formHtml = `
    <h3 class="text-lg font-bold mb-4">Enter Static Information</h3>
    <form id="staticForm" class="space-y-3">
      ${(template.static_fields || []).map(f => {
        return `
          <div class="text-left">
            <label class="block text-sm mb-1">${f.name}</label>
            <input name="${f.name}" class="w-full px-3 py-2 rounded bg-slate-800 text-white border border-slate-600" required />
          </div>
        `;
      }).join("")}
      <div class="flex justify-between pt-4">
        <button type="button" id="cancelStatic" class="bg-slate-600 hover:bg-slate-700 px-4 py-2 rounded text-white">Back</button>
        <button type="submit" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-white">Save</button>
      </div>
    </form>
  `;

  modalText.innerHTML = formHtml;
  modal.classList.remove("hidden");

  box.onclick = e => e.stopPropagation();

  document.getElementById("cancelStatic").onclick = () => {
    modal.classList.add("hidden");
  };

  document.getElementById("staticForm").onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const staticObj = {};
    for (const [k, v] of formData.entries()) staticObj[k] = v;

    await set(ref(db, `tethers/${id}`), {
      template: templateId,
      static: staticObj,
      logs: []
    });

    modal.classList.add("hidden");
    window.location.reload();
  };
}
