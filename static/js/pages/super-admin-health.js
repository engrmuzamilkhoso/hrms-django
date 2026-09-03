(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function metricCards(health) {
    return [
      { label: "Total Organizations", value: health.total_organizations, color: "text-amber-400", bg: "from-amber-500/15 to-orange-500/10", border: "border-amber-500/20" },
      { label: "Total Employees", value: health.total_employees, color: "text-violet-400", bg: "from-violet-500/15 to-indigo-500/10", border: "border-violet-500/20" },
      { label: "Uptime", value: health.uptime ?? "99.9%", color: "text-emerald-400", bg: "from-emerald-500/15 to-teal-500/10", border: "border-emerald-500/20" },
      { label: "Error Rate", value: health.error_rate ?? "0%", color: "text-rose-400", bg: "from-rose-500/15 to-red-500/10", border: "border-rose-500/20" },
      { label: "Queue Depth", value: health.queue_depth ?? "—", color: (health.queue_depth || 0) > 100 ? "text-amber-400" : "text-slate-200", bg: "from-cyan-500/15 to-blue-500/10", border: "border-cyan-500/20" },
    ];
  }

  async function load() {
    const btn = document.getElementById("refresh-btn");
    btn.disabled = true;
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
        card.innerHTML = `<p class="text-xs font-medium uppercase tracking-wide text-slate-500">${esc(m.label)}</p><p class="mt-3 text-4xl font-bold ${m.color}">${m.value == null ? "" : esc(m.value)}</p>`;
        grid.appendChild(card);
      });

      document.getElementById("raw-response").hidden = false;
      document.getElementById("raw-json").textContent = JSON.stringify(health, null, 2);
    } catch (err) {
      grid.innerHTML = `<div class="col-span-full rounded-xl border border-white/8 px-6 py-12 text-center text-slate-500">${esc(err.message || "Health data unavailable.")}</div>`;
    } finally {
      btn.disabled = false;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    document.getElementById("refresh-btn").addEventListener("click", load);
  });
})();
