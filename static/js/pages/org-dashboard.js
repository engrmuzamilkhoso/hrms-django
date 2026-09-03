(function () {
  function fmt(n) {
    return n == null ? "0" : n;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const r = await apiRequest("/reports/org-dashboard");
      const d = unwrapData(r);

      document.getElementById("stat-active").textContent = fmt(d.totalActive);
      document.getElementById("stat-present").textContent = fmt(d.presentToday);
      document.getElementById("stat-on-leave").textContent = fmt(d.onLeaveToday);
      document.getElementById("stat-pending-leaves").textContent = fmt(d.pendingLeaves);
      document.getElementById("stat-pending-expenses").textContent = fmt(d.pendingExpenses);
      document.getElementById("stat-new-joiners").textContent = fmt(d.newJoinersThisMonth);
      document.getElementById("stat-exits").textContent = fmt(d.exitsThisMonth);

      const deptList = document.getElementById("dept-breakdown");
      deptList.innerHTML = "";
      (d.byDepartment || []).forEach((row) => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between py-1.5 text-sm";
        li.innerHTML = `<span class="text-slate-300">${row.department}</span><span class="text-slate-500">${row.count}</span>`;
        deptList.appendChild(li);
      });

      const hiresList = document.getElementById("recent-hires");
      hiresList.innerHTML = "";
      (d.recentHires || []).forEach((h) => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between py-1.5 text-sm";
        li.innerHTML = `<span class="text-slate-300">${h.name}</span><span class="text-slate-500 text-xs">${h.hire_date}</span>`;
        hiresList.appendChild(li);
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
