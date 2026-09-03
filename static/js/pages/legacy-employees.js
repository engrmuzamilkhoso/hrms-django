(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const tbody = document.getElementById("legacy-emp-tbody");
    const errorEl = document.getElementById("legacy-emp-error");
    try {
      const response = await apiRequest("/employees");
      const maybePaginated = response.data;
      const rows = Array.isArray(maybePaginated) ? maybePaginated : maybePaginated?.data || [];
      if (rows.length === 0) return;
      tbody.innerHTML = "";
      rows.forEach((employee) => {
        const tr = document.createElement("tr");
        tr.className = "border-t border-slate-800";
        tr.innerHTML = `
          <td class="px-4 py-3">${esc(employee.employee_code)}</td>
          <td class="px-4 py-3">${esc(employee.full_name)}</td>
          <td class="px-4 py-3">${esc(employee.email)}</td>
          <td class="px-4 py-3">${employee.designation ? esc(employee.designation) : "-"}</td>
          <td class="px-4 py-3">${esc(employee.employment_status)}</td>`;
        tbody.appendChild(tr);
      });
    } catch (e) {
      errorEl.hidden = false;
      errorEl.textContent = e.message || "Failed to load employees";
    }
  });
})();
