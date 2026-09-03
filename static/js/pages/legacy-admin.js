(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  const fmt = (n) => (n != null ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");
  const PLAN_BADGE = {
    trial: "bg-cyan-500/20 text-cyan-300", silver: "bg-slate-700 text-slate-300", gold: "bg-amber-500/20 text-amber-300",
    platinum: "bg-violet-500/20 text-violet-300", custom: "bg-rose-500/20 text-rose-300",
  };
  const STATUS_BADGE = { active: "bg-emerald-500/20 text-emerald-300", inactive: "bg-slate-700 text-slate-400", trial: "bg-cyan-500/20 text-cyan-300" };

  function switchTab(tab) {
    document.querySelectorAll("#la-tab-bar .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }

  let orgs = [];
  let billing = [];

  async function load() {
    const [o, b, h] = await Promise.allSettled([apiRequest("/platform/organizations"), apiRequest("/platform/billing/records"), apiRequest("/platform/health/overview")]);
    if (o.status === "fulfilled") orgs = unwrapData(o.value)?.data || [];
    if (b.status === "fulfilled") billing = unwrapData(b.value)?.data || [];
    const health = h.status === "fulfilled" ? unwrapData(h.value) : null;

    renderStats();
    renderOrgs();
    renderBilling();
    renderHealth(health);
  }

  function renderStats() {
    const totalRevenue = billing.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const activeOrgs = orgs.filter((o) => o.status === "active").length;
    const totalEmployees = orgs.reduce((s, o) => s + (Number(o.employee_count) || 0), 0);
    document.getElementById("stat-orgs").textContent = orgs.length;
    document.getElementById("stat-active").textContent = activeOrgs;
    document.getElementById("stat-employees").textContent = totalEmployees;
    document.getElementById("stat-revenue").textContent = `$${fmt(totalRevenue)}`;
  }

  function renderOrgs() {
    const tbody = document.getElementById("orgs-tbody");
    if (orgs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-slate-500 py-10">No organizations registered yet.</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    orgs.forEach((o) => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-white/5 hover:bg-white/3";
      tr.innerHTML = `
        <td class="py-3 pr-4 font-medium">${esc(o.name)}</td>
        <td class="py-3 pr-4 text-slate-400">${esc(o.country_code || "—")}</td>
        <td class="py-3 pr-4"><span class="rounded-full px-2 py-0.5 text-xs capitalize ${PLAN_BADGE[o.plan_code] || "bg-slate-700 text-slate-300"}">${esc(o.plan_code || "trial")}</span></td>
        <td class="py-3 pr-4 text-right">${o.employee_count || 0}</td>
        <td class="py-3 pr-4"><span class="rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[o.status] || "bg-slate-700 text-slate-300"}">${esc(o.status)}</span></td>
        <td class="py-3 text-xs text-slate-400">${o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>`;
      tbody.appendChild(tr);
    });
  }

  function renderBilling() {
    const tbody = document.getElementById("billing-tbody");
    if (billing.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-slate-500 py-10">No billing records yet.</td></tr>';
      return;
    }
    const totalRevenue = billing.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    tbody.innerHTML = "";
    billing.forEach((b) => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-white/5 hover:bg-white/3";
      tr.innerHTML = `
        <td class="py-2.5 pr-4 font-mono text-xs">${esc(b.billing_period)}</td>
        <td class="py-2.5 pr-4">${b.organization_id}</td>
        <td class="py-2.5 pr-4"><span class="rounded-full px-2 py-0.5 text-xs capitalize ${PLAN_BADGE[b.plan_code] || "bg-slate-700 text-slate-300"}">${esc(b.plan_code)}</span></td>
        <td class="py-2.5 pr-4 text-right">${b.active_employee_count}</td>
        <td class="py-2.5 pr-4 text-right font-semibold text-amber-300">$${fmt(b.amount)}</td>
        <td class="py-2.5 pr-4"><span class="rounded-full px-2 py-0.5 text-xs ${b.status === "paid" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}">${esc(b.status)}</span></td>
        <td class="py-2.5 text-xs text-slate-400">${b.generated_at ? new Date(b.generated_at).toLocaleDateString() : "—"}</td>`;
      tbody.appendChild(tr);
    });
    const totalTr = document.createElement("tr");
    totalTr.className = "border-t border-white/10 font-semibold";
    totalTr.innerHTML = `<td colspan="4" class="py-2 text-slate-400">Total</td><td class="py-2 text-right text-amber-300">$${fmt(totalRevenue)}</td><td colspan="2"></td>`;
    tbody.appendChild(totalTr);
  }

  function renderHealth(health) {
    const cards = document.getElementById("health-cards");
    if (!health) {
      cards.innerHTML = "";
      document.getElementById("health-empty").hidden = false;
      return;
    }
    document.getElementById("health-empty").hidden = true;
    const metrics = [
      { label: "Total Organizations", value: health.total_organizations, color: "text-cyan-300" },
      { label: "Total Employees", value: health.total_employees, color: "text-violet-300" },
      { label: "Queue Depth", value: health.queue_depth ?? "—", color: "text-amber-300" },
      { label: "Error Rate", value: health.error_rate ?? "0%", color: "text-rose-300" },
      { label: "Uptime", value: health.uptime ?? "—", color: "text-emerald-300" },
    ];
    cards.innerHTML = metrics
      .map((m) => `<div class="rounded-xl border border-white/8 bg-white/3 p-5"><p class="form-label">${esc(m.label)}</p><p class="mt-2 text-2xl font-bold ${m.color}">${m.value == null ? "" : esc(m.value)}</p></div>`)
      .join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();

    document.getElementById("la-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn) switchTab(btn.dataset.tab);
    });

    document.getElementById("generate-billing-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const period = e.target.period.value;
      try {
        await apiRequest(`/platform/billing/generate/${period}`, { method: "POST" });
        pushToast(`Billing generated for ${period}`, "success");
        e.target.reset();
        load();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      }
    });
  });
})();
