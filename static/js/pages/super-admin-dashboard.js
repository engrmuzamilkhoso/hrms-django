/**
 * Pixel-precise port of app/super-admin/page.tsx.
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  const planBadge = (plan) =>
    ({
      platinum: "border-violet-500/30 bg-violet-500/20 text-violet-300",
      gold: "border-amber-500/30 bg-amber-500/20 text-amber-300",
      silver: "border-slate-500/30 bg-slate-500/20 text-slate-300",
      trial: "border-cyan-500/30 bg-cyan-500/20 text-cyan-300",
      custom: "border-rose-500/30 bg-rose-500/20 text-rose-300",
    }[(plan || "").toLowerCase()] || "border-slate-600/30 bg-slate-700/50 text-slate-400");

  const statusDot = (s) => (s === "active" || s === "trial" ? "bg-emerald-400" : s === "suspended" ? "bg-amber-400" : "bg-rose-400");

  document.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll("#stat-cards p.text-4xl").forEach((el) => el.classList.add("animate-pulse"));

    const [healthRes, orgsRes] = await Promise.allSettled([
      apiRequest("/platform/health/overview"),
      apiRequest("/platform/organizations"),
    ]);

    let health = null;
    if (healthRes.status === "fulfilled") health = unwrapData(healthRes.value);

    let orgs = [];
    if (orgsRes.status === "fulfilled") orgs = unwrapData(orgsRes.value)?.data || [];

    const now = new Date();
    const newThisMonth = orgs.filter((o) => {
      const d = new Date(o.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const activeOrgs = orgs.filter((o) => o.status === "active").length;
    const totalEmp = health?.total_employees ?? orgs.reduce((s, o) => s + (o.employee_count || 0), 0);

    document.querySelectorAll("#stat-cards p.text-4xl").forEach((el) => el.classList.remove("animate-pulse"));
    document.getElementById("stat-total").textContent = health?.total_organizations ?? orgs.length;
    document.getElementById("stat-active").textContent = activeOrgs;
    document.getElementById("stat-employees").textContent = totalEmp;
    document.getElementById("stat-new").textContent = newThisMonth;

    if (health) {
      document.getElementById("health-strip").hidden = false;
      document.getElementById("health-uptime").textContent = health.uptime || "99.9%";
      document.getElementById("health-error-rate").textContent = health.error_rate || "0.01%";
      if (health.queue_depth !== undefined) {
        document.getElementById("health-queue-wrap").hidden = false;
        const q = document.getElementById("health-queue");
        q.textContent = health.queue_depth;
        q.className = `text-lg font-bold ${health.queue_depth > 100 ? "text-amber-400" : "text-slate-200"}`;
      }
    }

    const tbody = document.getElementById("orgs-tbody");
    if (orgs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-slate-500 py-10">No organizations found.</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    orgs.slice(0, 15).forEach((org) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="font-medium text-slate-200">${esc(org.name)}</td>
        <td><span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${planBadge(org.plan_code)}">${esc(org.plan_code || "—")}</span></td>
        <td class="text-slate-300">${org.employee_count || 0}</td>
        <td class="text-slate-400 text-sm">${esc(org.country_code || "—")}</td>
        <td><span class="flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-full ${statusDot(org.status)}"></span><span class="text-xs text-slate-400 capitalize">${esc(org.status)}</span></span></td>
        <td class="text-slate-500 text-xs">${org.created_at ? new Date(org.created_at).toLocaleDateString() : "—"}</td>
        <td><a href="/super-admin/organizations/" class="text-xs text-violet-400 hover:text-violet-300 transition">View →</a></td>`;
      tbody.appendChild(tr);
    });
  });
})();
