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
  let employeeOptions = [];

  async function loadEmployeeOptions() {
    try {
      const r = await apiRequest("/employees?per_page=500");
      const list = unwrapData(r)?.data || [];
      employeeOptions = list.map((e) => ({ id: e.id, label: `${e.full_name} (${e.employee_code})` }));
    } catch (err) {
      /* silent */
    }
  }

  async function load() {
    const tbody = document.getElementById("assets-tbody");
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-slate-500 py-10">Loading…</td></tr>';
    try {
      const params = currentFilter === "unassigned" ? "?unassigned=1" : "";
      const r = await apiRequest(`/assets${params}`);
      let data = unwrapData(r)?.data || [];
      if (currentFilter === "assigned") data = data.filter((a) => !!a.assigned_to_employee_id);
      assets = data;
      render();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red-400 py-10">${esc(err.message || "Failed to load")}</td></tr>`;
    }
  }

  function render() {
    const tbody = document.getElementById("assets-tbody");
    if (assets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-slate-500 py-10">No assets found.</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    assets.forEach((a) => {
      const tr = document.createElement("tr");
      let actionsCell;
      if (!a.assigned_to_employee_id) {
        if (assignTargetId === a.id) {
          actionsCell = `
            <div class="flex items-center gap-1 flex-wrap min-w-[220px]">
              <select class="assign-emp-select form-select text-xs py-1 flex-1">
                <option value="">Select employee…</option>
                ${employeeOptions.map((e) => `<option value="${e.id}">${esc(e.label)}</option>`).join("")}
              </select>
              <button data-id="${a.id}" class="confirm-assign-btn text-xs text-emerald-500 hover:underline shrink-0">Assign</button>
              <button data-id="${a.id}" class="cancel-assign-btn text-xs text-slate-400 hover:underline shrink-0">✕</button>
            </div>`;
        } else {
          actionsCell = `<button data-id="${a.id}" class="start-assign-btn text-xs text-cyan-400 hover:underline">Assign</button>`;
        }
      } else {
        actionsCell = `<button data-id="${a.id}" class="return-asset-btn text-xs text-amber-400 hover:underline">Return</button>`;
      }
      tr.innerHTML = `
        <td class="font-mono text-xs">${esc(a.asset_code)}</td>
        <td>${esc(a.category)}</td>
        <td class="font-medium">${esc(a.name)}</td>
        <td class="text-xs text-slate-400">${a.serial_number ? esc(a.serial_number) : "—"}</td>
        <td class="text-xs font-medium capitalize ${CONDITION_COLOR[a.condition_status] || "text-slate-400"}">${esc(a.condition_status)}</td>
        <td class="text-xs">${a.assigned_to_employee_id ? `<span class="text-cyan-300">Emp #${a.assigned_to_employee_id}</span>` : '<span class="text-slate-500">Unassigned</span>'}</td>
        <td><div class="flex items-center gap-2 flex-wrap">${actionsCell}<button data-id="${a.id}" class="edit-asset-btn text-xs text-slate-400 hover:underline">Edit</button><button data-id="${a.id}" class="delete-asset-btn text-xs text-rose-400 hover:underline">Delete</button></div></td>`;
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
        const row = btn.closest("tr");
        const empId = row.querySelector(".assign-emp-select").value;
        if (!empId) {
          pushToast("Select an employee", "error");
          return;
        }
        try {
          await apiRequest(`/assets/${btn.dataset.id}/assign`, { method: "POST", body: JSON.stringify({ employee_id: Number(empId) }) });
          pushToast("Asset assigned", "success");
          assignTargetId = null;
          load();
        } catch (err) {
          pushToast(err.message || "Error", "error");
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
        b.classList.toggle("bg-blue-600", active);
        b.classList.toggle("text-white", active);
        b.classList.toggle("font-medium", active);
        b.classList.toggle("border", !active);
        b.classList.toggle("border-white/15", !active);
        b.classList.toggle("text-slate-400", !active);
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
      btn.disabled = true;
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
      }
    });
  });
})();
