/**
 * Pixel-precise port of app/dashboard/organization/departments/page.tsx.
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  let departments = [];
  let editId = null;

  async function load() {
    const wrap = document.getElementById("dept-list-wrap");
    try {
      const r = await apiRequest("/departments?per_page=100");
      departments = unwrapData(r)?.data || [];
      render();
    } catch (err) {
      wrap.innerHTML = `<p class="text-sm text-rose-400">${esc(err.message || "Failed to load departments")}</p>`;
    }
  }

  function render() {
    const wrap = document.getElementById("dept-list-wrap");
    if (departments.length === 0) {
      wrap.innerHTML = `
        <div class="rounded-xl border border-white/6 bg-white/2 p-10 text-center">
          <p class="text-3xl mb-2">🏢</p>
          <p class="text-slate-400 text-sm">No departments yet.</p>
          <button id="dept-empty-new" class="mt-3 text-xs text-violet-400 hover:underline">Create first department →</button>
        </div>`;
      document.getElementById("dept-empty-new").addEventListener("click", openNew);
      return;
    }
    wrap.innerHTML = `
      <div class="rounded-2xl overflow-hidden border border-white/7">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Code</th><th>Status</th><th class="text-right">Actions</th></tr></thead>
          <tbody id="dept-tbody"></tbody>
        </table>
      </div>`;
    const tbody = document.getElementById("dept-tbody");
    departments.forEach((dept) => {
      const tr = document.createElement("tr");
      if (editId === dept.id) tr.className = "bg-violet-500/5";
      tr.innerHTML = `
        <td><p class="font-medium text-slate-200">${esc(dept.name)}</p>${dept.description ? `<p class="text-xs text-slate-500 mt-0.5">${esc(dept.description)}</p>` : ""}</td>
        <td class="text-slate-400">${dept.code ? esc(dept.code) : "—"}</td>
        <td><span class="badge ${dept.is_active ? "badge-green" : "badge-slate"}">${dept.is_active ? "Active" : "Inactive"}</span></td>
        <td class="text-right"><div class="flex justify-end gap-2">
          <button data-id="${dept.id}" class="dept-edit-btn rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-xs hover:bg-white/8 transition">Edit</button>
          <button data-id="${dept.id}" class="dept-delete-btn rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/15 transition">Delete</button>
        </div></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll(".dept-edit-btn").forEach((btn) =>
      btn.addEventListener("click", () => openEdit(departments.find((d) => d.id === Number(btn.dataset.id))))
    );
    tbody.querySelectorAll(".dept-delete-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this department?")) return;
        try {
          await apiRequest(`/departments/${btn.dataset.id}`, { method: "DELETE" });
          pushToast("Department deleted", "success");
          departments = departments.filter((d) => d.id !== Number(btn.dataset.id));
          if (editId === Number(btn.dataset.id)) closeForm();
          render();
        } catch (err) {
          pushToast(err.message || "Failed to delete department", "error");
        }
      })
    );
  }

  function openNew() {
    editId = null;
    const form = document.getElementById("dept-form");
    form.reset();
    form.querySelector('[name="is_active"]').checked = true;
    document.getElementById("dept-form-title").textContent = "New Department";
    document.getElementById("dept-save-label").textContent = "Create Department";
    document.getElementById("dept-name-error").classList.add("hidden");
    form.hidden = false;
  }

  function openEdit(dept) {
    editId = dept.id;
    const form = document.getElementById("dept-form");
    form.name.value = dept.name;
    form.code.value = dept.code || "";
    form.description.value = dept.description || "";
    form.is_active.checked = dept.is_active;
    document.getElementById("dept-form-title").textContent = "Edit Department";
    document.getElementById("dept-save-label").textContent = "Update Department";
    document.getElementById("dept-name-error").classList.add("hidden");
    form.hidden = false;
    render();
  }

  function closeForm() {
    document.getElementById("dept-form").hidden = true;
    editId = null;
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    document.getElementById("dept-new-btn").addEventListener("click", openNew);
    document.getElementById("dept-form-close").addEventListener("click", closeForm);

    document.getElementById("dept-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = (fd.get("name") || "").toString().trim();
      if (!name) {
        document.getElementById("dept-name-error").classList.remove("hidden");
        return;
      }
      document.getElementById("dept-name-error").classList.add("hidden");
      const payload = {
        name,
        code: fd.get("code") || null,
        description: fd.get("description") || null,
        is_active: fd.get("is_active") === "on",
      };
      const btn = document.getElementById("dept-save-btn");
      btn.disabled = true;
      try {
        if (editId) {
          await apiRequest(`/departments/${editId}`, { method: "PATCH", body: JSON.stringify(payload) });
          pushToast("Department updated", "success");
        } else {
          await apiRequest("/departments", { method: "POST", body: JSON.stringify(payload) });
          pushToast("Department created", "success");
        }
        closeForm();
        load();
      } catch (err) {
        pushToast(err.message || "Error saving department", "error");
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
