(function () {
  const tbody = document.getElementById("designations-tbody");
  const loading = document.getElementById("loading-spinner");
  const empty = document.getElementById("empty-state");
  const table = document.getElementById("table-wrap");

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  async function load() {
    loading.hidden = false;
    table.hidden = true;
    empty.hidden = true;
    try {
      const r = await apiRequest("/designations");
      const list = unwrapData(r) || [];
      loading.hidden = true;
      if (list.length === 0) {
        empty.hidden = false;
        return;
      }
      table.hidden = false;
      tbody.innerHTML = "";
      list.forEach((d) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="font-medium text-white">${escapeHtml(d.title)}</td>
          <td class="text-slate-400">${d.grade ? escapeHtml(d.grade) : '<span class="text-slate-600">—</span>'}</td>
          <td class="text-slate-400">${d.currency} ${Number(d.base_salary).toLocaleString()}</td>
          <td class="text-slate-400">${d.employees_count}</td>
          <td><span class="badge ${d.is_active ? "badge-green" : "badge-slate"}">${d.is_active ? "Active" : "Inactive"}</span></td>
          <td><button data-id="${d.id}" data-title="${escapeHtml(d.title)}" data-grade="${d.grade || ""}" class="edit-btn rounded px-3 py-1 text-xs border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition">Edit</button></td>
        `;
        tbody.appendChild(tr);
      });
      document.querySelectorAll(".edit-btn").forEach((btn) =>
        btn.addEventListener("click", () => openEdit(btn.dataset.id, btn.dataset.title, btn.dataset.grade))
      );
    } catch (err) {
      loading.hidden = true;
      pushToast(err.message || "Failed to load designations", "error");
    }
  }

  function openEdit(id, title, grade) {
    document.getElementById("form-id").value = id || "";
    document.getElementById("form-title").value = title || "";
    document.getElementById("form-grade").value = grade || "";
    document.getElementById("form-modal").hidden = false;
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    document.getElementById("add-btn").addEventListener("click", () => openEdit("", "", ""));
    document.getElementById("modal-cancel").addEventListener("click", () => {
      document.getElementById("form-modal").hidden = true;
    });
    document.getElementById("designation-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("form-id").value;
      const payload = {
        title: document.getElementById("form-title").value,
        grade: document.getElementById("form-grade").value || null,
      };
      try {
        if (id) {
          await apiRequest(`/designations/${id}`, { method: "PUT", body: JSON.stringify(payload) });
        } else {
          await apiRequest("/designations", { method: "POST", body: JSON.stringify(payload) });
        }
        document.getElementById("form-modal").hidden = true;
        pushToast("Designation saved", "success");
        load();
      } catch (err) {
        pushToast(err.message || "Failed to save designation", "error");
      }
    });
  });
})();
