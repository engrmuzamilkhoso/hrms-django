/**
 * Pixel-precise port of app/super-admin/health/page.tsx.
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  const ICONS = {
    orgs: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    employees: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    uptime: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    error: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    queue: "M4 6h16M4 10h16M4 14h16M4 18h16",
  };

  function metricCards(health) {
    return [
      { label: "Total Organizations", value: health.total_organizations, color: "text-amber-400", bg: "from-amber-500/15 to-orange-500/10", border: "border-amber-500/20", icon: ICONS.orgs },
      { label: "Total Employees", value: health.total_employees, color: "text-violet-400", bg: "from-violet-500/15 to-indigo-500/10", border: "border-violet-500/20", icon: ICONS.employees },
      { label: "Uptime", value: health.uptime ?? "99.9%", color: "text-emerald-400", bg: "from-emerald-500/15 to-teal-500/10", border: "border-emerald-500/20", icon: ICONS.uptime },
      { label: "Error Rate", value: health.error_rate ?? "0%", color: "text-rose-400", bg: "from-rose-500/15 to-red-500/10", border: "border-rose-500/20", icon: ICONS.error },
      { label: "Queue Depth", value: health.queue_depth ?? "—", color: (health.queue_depth || 0) > 100 ? "text-amber-400" : "text-slate-200", bg: "from-cyan-500/15 to-blue-500/10", border: "border-cyan-500/20", icon: ICONS.queue },
    ];
  }

  async function load() {
    const btn = document.getElementById("refresh-btn");
    const icon = document.getElementById("refresh-icon");
    btn.disabled = true;
    icon.classList.add("animate-spin");
    const grid = document.getElementById("metrics-grid");
    grid.innerHTML = Array.from({ length: 5 })
      .map(() => '<div class="stat-card border-white/8 animate-pulse"><div class="h-3 w-32 rounded bg-white/5 mb-4"></div><div class="h-10 w-20 rounded bg-white/5"></div></div>')
      .join("");
    document.getElementById("status-banner").hidden = true;
    document.getElementById("raw-response").hidden = true;

    try {
      const r = await apiRequest("/platform/health/overview");
      const health = unwrapData(r) || {};

      const isHealthy = (health.queue_depth || 0) <= 100 && parseFloat(health.error_rate || "0") < 1;
      const banner = document.getElementById("status-banner");
      banner.hidden = false;
      banner.className = `mb-8 rounded-xl border px-5 py-4 flex items-center justify-between ${isHealthy ? "border-emerald-500/15 bg-emerald-500/5" : "border-amber-500/15 bg-amber-500/5"}`;
      document.getElementById("status-dot").className = `h-3 w-3 rounded-full animate-pulse ${isHealthy ? "bg-emerald-400" : "bg-amber-400"}`;
      const label = document.getElementById("status-label");
      label.textContent = isHealthy ? "All Systems Operational" : "Attention Required";
      label.className = `text-sm font-semibold ${isHealthy ? "text-emerald-300" : "text-amber-300"}`;
      document.getElementById("status-desc").textContent = isHealthy
        ? "Platform is running normally with no detected issues."
        : "One or more metrics are outside normal thresholds.";
      document.getElementById("last-refreshed").textContent = `Last refreshed ${new Date().toLocaleTimeString()}`;

      grid.innerHTML = "";
      metricCards(health).forEach((m) => {
        const card = document.createElement("div");
        card.className = `stat-card bg-gradient-to-br ${m.bg} ${m.border}`;
        card.innerHTML = `
          <div class="flex items-start justify-between">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">${esc(m.label)}</p>
            <svg class="h-4 w-4 ${m.color} opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="${m.icon}" /></svg>
          </div>
          <p class="mt-3 text-4xl font-bold ${m.color}">${m.value == null ? "" : esc(m.value)}</p>`;
        grid.appendChild(card);
      });

      document.getElementById("raw-response").hidden = false;
      document.getElementById("raw-json").textContent = JSON.stringify(health, null, 2);
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full rounded-xl border border-white/8 px-6 py-12 text-center text-slate-500">${esc(err.message || "Health data unavailable.")}</div>`;
    } finally {
      btn.disabled = false;
      icon.classList.remove("animate-spin");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    document.getElementById("refresh-btn").addEventListener("click", load);
  });
})();
