(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const r = await apiRequest("/reports/manager-dashboard");
      const d = unwrapData(r);

      document.getElementById("stat-team-size").textContent = d.team_size;
      document.getElementById("stat-present").textContent = d.present_today;
      document.getElementById("stat-on-leave").textContent = d.on_leave_today;
      document.getElementById("stat-absent").textContent = d.absent_today;
      document.getElementById("stat-pending").textContent = d.pending_leave_requests;

      const teamList = document.getElementById("team-members");
      teamList.innerHTML = "";
      (d.team_members || []).forEach((m) => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between py-1.5 text-sm";
        li.innerHTML = `<span class="text-slate-300">${m.name}</span><span class="text-slate-500 text-xs">${m.designation || ""}</span>`;
        teamList.appendChild(li);
      });

      const pendingList = document.getElementById("pending-leaves");
      pendingList.innerHTML = "";
      (d.pending_leaves || []).forEach((lr) => {
        const li = document.createElement("li");
        li.className = "flex items-center justify-between py-1.5 text-sm";
        li.innerHTML = `<span class="text-slate-300">${lr.employee_name}</span><span class="text-slate-500 text-xs">${lr.from_date} → ${lr.to_date}</span>`;
        pendingList.appendChild(li);
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
