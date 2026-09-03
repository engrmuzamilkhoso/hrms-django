/**
 * Pixel-precise port of app/dashboard/organization/teams/page.tsx,
 * rebuilt against the real /teams endpoint (see templates/organization/teams.html).
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  let teams = [];
  let departments = [];

  function deptName(id) {
    const d = departments.find((x) => x.id === id);
    return d ? d.name : "—";
  }

  async function load() {
    const wrap = document.getElementById("team-grid-wrap");
    try {
      const [tRes, dRes] = await Promise.all([apiRequest("/teams?per_page=100"), apiRequest("/departments?per_page=100")]);
      teams = unwrapData(tRes)?.data || [];
      departments = unwrapData(dRes)?.data || [];
      render();
    } catch (err) {
      wrap.innerHTML = `<p class="text-sm text-rose-400">${esc(err.message || "Failed to load teams")}</p>`;
    }
  }

  function render() {
    const wrap = document.getElementById("team-grid-wrap");
    if (teams.length === 0) {
      wrap.innerHTML = `
        <div class="text-center py-16 stat-card rounded-2xl">
          <p class="text-slate-400 mb-3">No teams created yet</p>
          <button id="team-empty-new" class="text-sm text-violet-400 hover:text-violet-300 transition">Create your first team →</button>
        </div>`;
      document.getElementById("team-empty-new").addEventListener("click", openNew);
      return;
    }
    wrap.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"></div>';
    const grid = wrap.firstElementChild;
    teams.forEach((t) => {
      const card = document.createElement("div");
      card.className = "stat-card rounded-2xl";
      card.innerHTML = `
        <div class="flex items-start justify-between mb-3">
          <div><h3 class="font-semibold text-slate-100">${esc(t.name)}</h3><p class="text-xs text-slate-500">${esc(deptName(t.department_id))}</p></div>
          <span class="badge badge-slate">${t.lead_employee_id ? "Has Lead" : "No Lead"}</span>
        </div>
        <div class="flex gap-2">
          <button data-id="${t.id}" class="team-edit-btn btn-secondary flex-1 rounded-xl py-2 text-xs text-center">Edit</button>
          <button data-id="${t.id}" class="team-delete-btn flex-1 rounded-xl py-2 text-xs border border-red-500/20 bg-red-500/8 text-red-400 hover:bg-red-500/18 transition">Delete</button>
        </div>`;
      grid.appendChild(card);
    });
    grid.querySelectorAll(".team-edit-btn").forEach((btn) =>
      btn.addEventListener("click", () => openForm(teams.find((t) => t.id === Number(btn.dataset.id))))
    );
    grid.querySelectorAll(".team-delete-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this team?")) return;
        try {
          await apiRequest(`/teams/${btn.dataset.id}`, { method: "DELETE" });
          pushToast("Team deleted", "success");
          teams = teams.filter((t) => t.id !== Number(btn.dataset.id));
          render();
        } catch (err) {
          pushToast(err.message || "Failed to delete team", "error");
        }
      })
    );
  }

  function openNew() {
    openForm(null);
  }

  function openForm(team) {
    const backdrop = document.getElementById("team-form-backdrop");
    const isEdit = !!team;
    const deptOptions = departments.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join("");
    backdrop.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" id="team-form-close"></div>
        <div class="relative w-full max-w-lg glass rounded-2xl p-8 shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto">
          <div class="page-header"><h1>${isEdit ? "Edit Team" : "Create Team"}</h1><p>${isEdit ? "Update this team" : "Add a new team to your organization"}</p></div>
          <form id="team-form" class="form-section space-y-5 mt-4">
            <div><label class="form-label">Team Name *</label><input type="text" name="name" required class="form-input" placeholder="e.g., Backend Team"></div>
            <div><label class="form-label">Department *</label><select name="department_id" required class="form-select"><option value="">— Select department —</option>${deptOptions}</select></div>
            <div class="flex gap-3 pt-2">
              <button type="submit" class="btn-primary flex-1 rounded-xl py-3 text-sm disabled:opacity-50" id="team-save-btn"><span id="team-save-label">${isEdit ? "Update Team" : "Create Team"}</span></button>
              <button type="button" id="team-cancel-btn" class="btn-secondary flex-none rounded-xl px-6 py-3 text-sm text-center">Cancel</button>
            </div>
          </form>
        </div>
      </div>`;

    const form = document.getElementById("team-form");
    if (isEdit) {
      form.name.value = team.name;
      form.department_id.value = team.department_id;
    }

    const close = () => (backdrop.innerHTML = "");
    document.getElementById("team-form-close").addEventListener("click", close);
    document.getElementById("team-cancel-btn").addEventListener("click", close);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = { name: fd.get("name"), department_id: Number(fd.get("department_id")) };
      const btn = document.getElementById("team-save-btn");
      const label = document.getElementById("team-save-label");
      btn.disabled = true;
      label.textContent = isEdit ? "Updating…" : "Creating…";
      try {
        if (isEdit) {
          await apiRequest(`/teams/${team.id}`, { method: "PATCH", body: JSON.stringify(payload) });
          pushToast("Team updated", "success");
        } else {
          await apiRequest("/teams", { method: "POST", body: JSON.stringify(payload) });
          pushToast("Team created", "success");
        }
        close();
        load();
      } catch (err) {
        pushToast(err.message || "Failed to save team", "error");
        btn.disabled = false;
        label.textContent = isEdit ? "Update Team" : "Create Team";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    document.getElementById("team-new-btn").addEventListener("click", openNew);
  });
})();
