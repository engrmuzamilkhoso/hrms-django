/**
 * Pixel-precise port of app/platform/assets/page.tsx.
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  const CONDITION_COLOR = { new: "text-emerald-400", good: "text-cyan-400", fair: "text-amber-400", poor: "text-orange-400", damaged: "text-rose-400" };

  let assets = [];
  let currentFilter = "all";
  let editAsset = null;
  let assignTargetId = null;
  let assigning = false;
  let employeeOptions = [];

  async function loadEmployeeOptions() {
    try {
      const r = await apiRequest("/employees?per_page=500");
      const list = unwrapData(r)?.data || [];
      employeeOptions = list.map((e) => ({ value: String(e.id), label: e.full_name, sub: e.employee_code }));
    } catch (err) {
      /* silent */
    }
  }

  async function load() {
    const tbody = document.getElementById("assets-tbody");
    tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500">Loading…</td></tr>';
    try {
      const params = currentFilter === "unassigned" ? "?unassigned=1" : "";
      const r = await apiRequest(`/assets${params}`);
      let data = unwrapData(r)?.data || [];
      if (currentFilter === "assigned") data = data.filter((a) => !!a.assigned_to_employee_id);
      assets = data;
      render();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-rose-400">${esc(err.message || "Failed to load")}</td></tr>`;
    }
  }

  function searchSelectMarkup() {
    return `
      <script type="application/json" class="js-ss-options">[]</script>
      <input type="hidden" class="js-ss-input" value="">
      <button type="button" class="form-input flex w-full items-center justify-between gap-2 px-2 py-1 text-xs transition focus:outline-none js-ss-trigger">
        <span class="flex flex-col items-start js-ss-trigger-label"><span>Select employee…</span></span>
        <svg class="h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200 js-ss-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      <div class="dropdown-panel absolute z-50 mt-1.5 w-full min-w-[200px] rounded-xl overflow-hidden js-ss-panel" style="box-shadow:0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)" hidden>
        <div class="p-2 border-b border-b-black/5 dark:border-b-white/8">
          <div class="relative">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" class="js-ss-search w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500/40 dark-search-input" style="padding-left:28px" placeholder="Search…">
          </div>
        </div>
        <ul class="js-ss-list max-h-52 overflow-y-auto py-1"></ul>
      </div>`;
  }

  function render() {
    const tbody = document.getElementById("assets-tbody");
    if (assets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500">No assets found.</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    assets.forEach((a) => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-800/50 hover:bg-slate-900/30";
      let assignOrReturnCell;
      if (!a.assigned_to_employee_id) {
        if (assignTargetId === a.id) {
          assignOrReturnCell = `
            <div class="flex items-center gap-1 min-w-[220px]">
              <div class="flex-1 relative js-search-select" id="asset-assign-ss-${a.id}">${searchSelectMarkup()}</div>
              <button data-id="${a.id}" ${assigning ? "disabled" : ""} class="confirm-assign-btn text-xs text-emerald-500 hover:underline shrink-0 inline-flex items-center gap-1 disabled:opacity-60">${assigning ? '<span class="btn-spinner"></span>' : ""}Assign</button>
              <button data-id="${a.id}" class="cancel-assign-btn text-xs text-slate-400 hover:underline shrink-0">✕</button>
            </div>`;
        } else {
          assignOrReturnCell = `<button data-id="${a.id}" class="start-assign-btn text-xs text-cyan-400 hover:underline">Assign</button>`;
        }
      } else {
        assignOrReturnCell = `<button data-id="${a.id}" class="return-asset-btn text-xs text-amber-400 hover:underline">Return</button>`;
      }
      tr.innerHTML = `
        <td class="py-3 pr-4 font-mono text-xs">${esc(a.asset_code)}</td>
        <td class="py-3 pr-4">${esc(a.category)}</td>
        <td class="py-3 pr-4 font-medium">${esc(a.name)}</td>
        <td class="py-3 pr-4 text-xs text-slate-400">${a.serial_number ? esc(a.serial_number) : "—"}</td>
        <td class="py-3 pr-4 text-xs font-medium capitalize ${CONDITION_COLOR[a.condition_status] || "text-slate-400"}">${esc(a.condition_status)}</td>
        <td class="py-3 pr-4 text-xs">${a.assigned_to_employee_id ? `<span class="text-cyan-300">Emp #${a.assigned_to_employee_id}</span>` : '<span class="text-slate-500">Unassigned</span>'}</td>
        <td class="py-3"><div class="flex items-center gap-2 flex-wrap">${assignOrReturnCell}<button data-id="${a.id}" class="edit-asset-btn text-xs text-slate-400 hover:underline">Edit</button><button data-id="${a.id}" class="delete-asset-btn text-xs text-rose-400 hover:underline">Delete</button></div></td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".start-assign-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        assignTargetId = Number(btn.dataset.id);
        render();
      })
    );
    tbody.querySelectorAll(".cancel-assign-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        assignTargetId = null;
        render();
      })
    );
    tbody.querySelectorAll(".confirm-assign-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const ssEl = document.getElementById(`asset-assign-ss-${btn.dataset.id}`);
        const ss = ssEl && ssEl._searchSelect;
        const empId = ss ? ss.getValue() : "";
        if (!empId) {
          pushToast("Select an employee", "error");
          return;
        }
        assigning = true;
        render();
        try {
          await apiRequest(`/assets/${btn.dataset.id}/assign`, { method: "POST", body: JSON.stringify({ employee_id: Number(empId) }) });
          pushToast("Asset assigned", "success");
          assignTargetId = null;
          assigning = false;
          load();
        } catch (err) {
          pushToast(err.message || "Error", "error");
          assigning = false;
          render();
        }
      })
    );
    tbody.querySelectorAll(".return-asset-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const condition = prompt("Condition at return (good/fair/damaged):", "good");
        if (condition === null) return;
        try {
          await apiRequest(`/assets/${btn.dataset.id}/return`, { method: "POST", body: JSON.stringify({ condition_status: condition }) });
          pushToast("Asset returned", "success");
          load();
        } catch (err) {
          pushToast(err.message || "Error", "error");
        }
      })
    );
    tbody.querySelectorAll(".edit-asset-btn").forEach((btn) =>
      btn.addEventListener("click", () => openForm(assets.find((a) => a.id === Number(btn.dataset.id))))
    );
    tbody.querySelectorAll(".delete-asset-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this asset?")) return;
        try {
          await apiRequest(`/assets/${btn.dataset.id}`, { method: "DELETE" });
          pushToast("Asset deleted", "success");
          load();
        } catch (err) {
          pushToast(err.message || "Error", "error");
        }
      })
    );

    // Initialize any freshly-inserted SearchSelect widgets and seed their options.
    if (assignTargetId != null) {
      window.reinitSearchSelects(tbody);
      const ssEl = document.getElementById(`asset-assign-ss-${assignTargetId}`);
      if (ssEl && ssEl._searchSelect) ssEl._searchSelect.setOptions(employeeOptions);
    }
  }

  function openForm(asset) {
    editAsset = asset || null;
    const form = document.getElementById("asset-form");
    form.hidden = false;
    document.getElementById("asset-form-title").textContent = editAsset ? "Edit Asset" : "New Asset";
    document.getElementById("asset-id").value = editAsset ? editAsset.id : "";
    form.asset_code.value = editAsset ? editAsset.asset_code : "";
    form.category.value = editAsset ? editAsset.category : "";
    form.name.value = editAsset ? editAsset.name : "";
    form.serial_number.value = (editAsset && editAsset.serial_number) || "";
    form.purchase_date.value = (editAsset && editAsset.purchase_date) || "";
    form.cost.value = editAsset && editAsset.cost != null ? editAsset.cost : "";
    form.condition_status.value = editAsset ? editAsset.condition_status : "good";
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadEmployeeOptions();
    load();

    document.getElementById("filter-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      currentFilter = btn.dataset.filter;
      document.querySelectorAll(".filter-btn").forEach((b) => {
        const active = b.dataset.filter === currentFilter;
        b.className = `filter-btn rounded-full px-3 py-1 text-sm capitalize transition ${active ? "bg-[#0156fc] text-white font-medium" : "border border-slate-700 text-slate-400 hover:border-slate-500"}`;
      });
      load();
    });

    document.getElementById("add-asset-btn").addEventListener("click", () => openForm(null));
    document.getElementById("asset-cancel-btn").addEventListener("click", () => {
      document.getElementById("asset-form").hidden = true;
      editAsset = null;
    });

    document.getElementById("asset-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        asset_code: fd.get("asset_code"),
        category: fd.get("category"),
        name: fd.get("name"),
        serial_number: fd.get("serial_number") || undefined,
        purchase_date: fd.get("purchase_date") || undefined,
        cost: fd.get("cost") ? Number(fd.get("cost")) : undefined,
        condition_status: fd.get("condition_status"),
      };
      const btn = document.getElementById("asset-save-btn");
      const spinner = document.getElementById("asset-save-spinner");
      const label = document.getElementById("asset-save-label");
      btn.disabled = true;
      spinner.hidden = false;
      label.textContent = "Saving…";
      try {
        if (editAsset) {
          await apiRequest(`/assets/${editAsset.id}`, { method: "PATCH", body: JSON.stringify(payload) });
          pushToast("Asset updated", "success");
        } else {
          await apiRequest("/assets", { method: "POST", body: JSON.stringify(payload) });
          pushToast("Asset created", "success");
        }
        document.getElementById("asset-form").hidden = true;
        editAsset = null;
        load();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
        spinner.hidden = true;
        label.textContent = "Save";
      }
    });
  });
})();
