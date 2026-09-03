(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  const fmt = (n) => (n != null ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "—");

  function statCard(label, value, color) {
    return `<div class="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><p class="text-xs text-slate-400 uppercase tracking-wide">${esc(label)}</p><p class="mt-2 text-3xl font-bold ${color}">${value == null ? "—" : esc(value)}</p></div>`;
  }

  function switchTab(tab) {
    document.querySelectorAll("#rep-tab-bar .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    if (tab === "payroll" && !loaded.payroll) {
      loaded.payroll = true;
      loadPayrollRegister();
    }
    if (tab === "leave" && !loaded.leave) {
      loaded.leave = true;
      loadLeaveReport();
    }
    if (tab === "recruitment" && !loaded.recruitment) {
      loaded.recruitment = true;
      loadRecruitmentReport();
    }
  }
  const loaded = {};

  async function loadHeadcount() {
    try {
      const r = await apiRequest("/reports/headcount");
      const h = unwrapData(r) || {};
      document.getElementById("headcount-cards").innerHTML =
        statCard("Total Employees", h.total_employees, "text-cyan-300") +
        statCard("Active", h.active_employees, "text-emerald-300") +
        statCard("New This Month", h.new_joiners_this_month, "text-blue-300") +
        statCard("Exits This Month", h.exits_this_month, "text-rose-300") +
        statCard("Pending Leaves", h.pending_leaves, "text-amber-300") +
        statCard("Open Positions", h.open_positions, "text-violet-300") +
        statCard("Expiring Documents", h.documents_expiring_soon, "text-orange-300");
      if (h.by_department) {
        document.getElementById("headcount-dept-section").hidden = false;
        const tbody = document.getElementById("headcount-dept-tbody");
        tbody.innerHTML = "";
        h.by_department.forEach((d) => {
          const tr = document.createElement("tr");
          tr.className = "border-b border-slate-800/50";
          tr.innerHTML = `<td class="py-2 pr-6">${esc(d.department)}</td><td class="py-2 pr-6">${d.count}</td><td class="py-2">${d.percentage ? `${d.percentage}%` : "—"}</td>`;
          tbody.appendChild(tr);
        });
      } else {
        document.getElementById("headcount-empty").hidden = false;
      }
    } catch (err) {
      document.getElementById("headcount-empty").hidden = false;
    }
  }

  async function loadAttrition() {
    try {
      const r = await apiRequest("/reports/attrition");
      const a = unwrapData(r) || {};
      document.getElementById("attrition-cards").innerHTML =
        statCard("Total Exits (YTD)", a.total_exits, "text-rose-300") +
        statCard("Attrition Rate", a.attrition_rate != null ? `${a.attrition_rate}%` : null, "text-orange-300") +
        statCard("Voluntary Exits", a.voluntary_exits, "text-amber-300");
      if (a.by_department) {
        document.getElementById("attrition-dept-section").hidden = false;
        const tbody = document.getElementById("attrition-dept-tbody");
        tbody.innerHTML = "";
        a.by_department.forEach((d) => {
          const tr = document.createElement("tr");
          tr.className = "border-b border-slate-800/50";
          tr.innerHTML = `<td class="py-2 pr-6">${esc(d.department)}</td><td class="py-2 pr-6">${d.exits}</td><td class="py-2">${d.rate ? `${d.rate}%` : "—"}</td>`;
          tbody.appendChild(tr);
        });
      } else {
        document.getElementById("attrition-empty").hidden = false;
      }
    } catch (err) {
      document.getElementById("attrition-empty").hidden = false;
    }
  }

  async function loadPayrollRegister() {
    const container = document.getElementById("payroll-register-content");
    container.innerHTML = '<p class="text-sm text-slate-400">Loading...</p>';
    try {
      const month = document.getElementById("payroll-month-input").value;
      const r = await apiRequest(`/reports/payroll-register?month=${month}`);
      const data = unwrapData(r);
      const payrollData = Array.isArray(data) ? data : data?.data || [];
      if (payrollData.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-500">No payroll data for this period.</p>';
        return;
      }
      const totalGross = payrollData.reduce((s, r) => s + (Number(r.gross) || 0), 0);
      const totalDed = payrollData.reduce((s, r) => s + (Number(r.deductions) || 0), 0);
      const totalNet = payrollData.reduce((s, r) => s + (Number(r.net) || 0), 0);
      const rows = payrollData
        .map(
          (row) => `
        <tr class="border-b border-slate-800/50 hover:bg-slate-900/30">
          <td class="py-2.5 pr-4">${row.employee_name ? esc(row.employee_name) : `Emp #${row.employee_id ?? ""}`}</td>
          <td class="py-2.5 pr-4 text-slate-400">${row.department ? esc(row.department) : "—"}</td>
          <td class="py-2.5 pr-4 text-right">${fmt(row.gross)}</td>
          <td class="py-2.5 pr-4 text-right text-rose-300">${fmt(row.deductions)}</td>
          <td class="py-2.5 text-right font-semibold text-emerald-300">${fmt(row.net)}</td>
        </tr>`
        )
        .join("");
      container.innerHTML = `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead><tr class="border-b border-slate-800 text-left text-xs text-slate-400"><th class="pb-2 pr-4">Employee</th><th class="pb-2 pr-4">Department</th><th class="pb-2 pr-4 text-right">Gross</th><th class="pb-2 pr-4 text-right">Deductions</th><th class="pb-2 text-right">Net</th></tr></thead>
            <tbody>
              ${rows}
              <tr class="border-t border-slate-700 font-semibold">
                <td class="py-2.5 pr-4 text-slate-300">Total</td><td></td>
                <td class="py-2.5 pr-4 text-right">${fmt(totalGross)}</td>
                <td class="py-2.5 pr-4 text-right text-rose-300">${fmt(totalDed)}</td>
                <td class="py-2.5 text-right text-emerald-300">${fmt(totalNet)}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    } catch (err) {
      pushToast(err.message || "Error", "error");
      container.innerHTML = '<p class="text-sm text-slate-500">No payroll data for this period.</p>';
    }
  }

  async function loadLeaveReport() {
    const container = document.getElementById("leave-summary-content");
    container.innerHTML = '<p class="text-sm text-slate-400 animate-pulse">Loading…</p>';
    try {
      const r = await apiRequest("/leave-types");
      const types = unwrapData(r)?.data || [];
      const b = await apiRequest("/leave-types/balances");
      const balances = unwrapData(b) || [];
      const leaveData = Array.isArray(balances) ? balances : types;
      if (leaveData.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-500">No leave data available.</p>';
        return;
      }
      const rows = leaveData
        .map(
          (row) => `
        <tr>
          <td class="font-medium text-white">${esc(row.name || row.leave_type_name)}</td>
          <td>${row.annual_quota ?? row.quota ?? "—"}</td>
          <td>${row.carry_forward_enabled ? '<span class="badge badge-green">Yes</span>' : '<span class="badge badge-slate">No</span>'}</td>
          <td>${row.is_encashable ? '<span class="badge badge-blue">Yes</span>' : "—"}</td>
          <td>${row.allow_negative ? '<span class="badge badge-amber">Allowed</span>' : "—"}</td>
        </tr>`
        )
        .join("");
      container.innerHTML = `
        <div class="overflow-x-auto rounded-xl border border-white/8">
          <table class="data-table w-full">
            <thead><tr><th>Leave Type</th><th>Annual Quota</th><th>Carry Forward</th><th>Encashable</th><th>Negative Balance</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } catch (err) {
      container.innerHTML = '<p class="text-sm text-slate-500">No leave data available.</p>';
    }
  }

  async function loadRecruitmentReport() {
    const container = document.getElementById("recruitment-report-content");
    container.innerHTML = '<p class="text-sm text-slate-400 animate-pulse">Loading…</p>';
    try {
      const [jobsRes, candRes] = await Promise.allSettled([apiRequest("/job-postings"), apiRequest("/candidates")]);
      const jobs = jobsRes.status === "fulfilled" ? unwrapData(jobsRes.value)?.data || [] : [];
      const candidates = candRes.status === "fulfilled" ? unwrapData(candRes.value)?.data || [] : [];
      const hired = candidates.filter((c) => c.stage === "hired" || c.status === "hired").length;

      let funnelHtml = "";
      if (candidates.length > 0) {
        const stages = ["applied", "cv_screening", "phone_screen", "technical_test", "interview", "offer", "hired", "rejected"];
        const counts = {};
        candidates.forEach((c) => {
          const s = c.stage || "applied";
          counts[s] = (counts[s] || 0) + 1;
        });
        const bars = stages
          .filter((s) => counts[s])
          .map((s) => {
            const pct = Math.round(((counts[s] || 0) / candidates.length) * 100);
            return `
            <div class="flex items-center gap-4">
              <span class="w-32 shrink-0 text-xs text-slate-400 capitalize">${esc(s.replace(/_/g, " "))}</span>
              <div class="flex-1 bg-white/5 rounded-full h-2 overflow-hidden"><div class="bg-violet-500 h-full rounded-full transition-all" style="width:${pct}%"></div></div>
              <span class="w-12 text-right text-xs text-slate-400">${counts[s] || 0}</span>
            </div>`;
          })
          .join("");
        funnelHtml = `<div><h3 class="font-semibold mb-3 text-sm text-slate-400 uppercase tracking-wide">Pipeline Funnel</h3><div class="space-y-2">${bars}</div></div>`;
      }

      let jobsTableHtml = "";
      if (jobs.length > 0) {
        const rows = jobs
          .map((job) => {
            const count = candidates.filter((c) => c.job_posting_id === job.id).length;
            return `<tr><td class="font-medium text-white">${esc(job.title)}</td><td><span class="badge ${job.status === "published" ? "badge-green" : "badge-slate"}">${esc(job.status)}</span></td><td>${job.openings}</td><td>${count}</td></tr>`;
          })
          .join("");
        jobsTableHtml = `
          <div>
            <h3 class="font-semibold mb-3 text-sm text-slate-400 uppercase tracking-wide">Open Positions</h3>
            <div class="overflow-x-auto rounded-xl border border-white/8">
              <table class="data-table w-full"><thead><tr><th>Title</th><th>Status</th><th>Openings</th><th>Candidates</th></tr></thead><tbody>${rows}</tbody></table>
            </div>
          </div>`;
      }

      container.innerHTML = `
        <div class="space-y-6">
          <div class="grid gap-4 sm:grid-cols-3">
            <div class="stat-card"><p class="text-xs text-slate-500 uppercase tracking-wide">Total Job Postings</p><p class="text-3xl font-bold text-violet-300 mt-2">${jobs.length}</p></div>
            <div class="stat-card"><p class="text-xs text-slate-500 uppercase tracking-wide">Total Candidates</p><p class="text-3xl font-bold text-cyan-300 mt-2">${candidates.length}</p></div>
            <div class="stat-card"><p class="text-xs text-slate-500 uppercase tracking-wide">Hired</p><p class="text-3xl font-bold text-emerald-300 mt-2">${hired}</p></div>
          </div>
          ${funnelHtml}
          ${jobsTableHtml}
        </div>`;
    } catch (err) {
      container.innerHTML = "";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("payroll-month-input").value = new Date().toISOString().slice(0, 7);
    loadHeadcount();
    loadAttrition();

    document.getElementById("rep-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn) switchTab(btn.dataset.tab);
    });
    document.getElementById("load-register-btn").addEventListener("click", loadPayrollRegister);
  });
})();
