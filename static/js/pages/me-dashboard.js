(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const r = await apiRequest("/reports/employee-dashboard");
      const d = unwrapData(r);

      if (d.error) {
        document.getElementById("loading").hidden = true;
        const errBox = document.getElementById("error-box");
        errBox.hidden = false;
        errBox.textContent = d.error;
        return;
      }

      document.getElementById("emp-name").textContent = d.employee.name;
      document.getElementById("emp-code").textContent = d.employee.employee_code;
      document.getElementById("emp-designation").textContent = d.employee.designation || "—";

      const summary = d.month_summary || {};
      document.getElementById("stat-present-days").textContent = summary.present_days || 0;
      document.getElementById("stat-total-days").textContent = summary.total_days || 0;
      document.getElementById("stat-today-status").textContent = d.today_attendance ? "Clocked in" : "Not clocked in";

      const balancesTbody = document.getElementById("leave-balances");
      balancesTbody.innerHTML = "";
      (d.leave_balances || []).forEach((b) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${b.name}</td><td>${b.opening_balance}</td><td>${b.used_days}</td><td>${b.remaining_days}</td>`;
        balancesTbody.appendChild(tr);
      });

      const upcomingList = document.getElementById("upcoming-leaves");
      upcomingList.innerHTML = "";
      (d.upcoming_leaves || []).forEach((lr) => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between py-1.5 text-sm";
        li.innerHTML = `<span class="text-slate-300">${lr.leave_type}</span><span class="text-slate-500 text-xs">${lr.start_date} → ${lr.end_date}</span>`;
        upcomingList.appendChild(li);
      });

      document.getElementById("loading").hidden = true;
      document.getElementById("content").hidden = false;
    } catch (err) {
      document.getElementById("loading").hidden = true;
      const errBox = document.getElementById("error-box");
      errBox.hidden = false;
      errBox.textContent = err.message || "Failed to load dashboard";
    }
  });
})();
