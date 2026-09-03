/**
 * Pixel-precise port of app/dashboard/organization/page.tsx.
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  async function load() {
    const wrap = document.getElementById("org-overview-wrap");
    try {
      const r = await apiRequest("/organizations/me");
      const org = unwrapData(r);
      render(org);
    } catch (err) {
      wrap.innerHTML = `<div class="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400">${esc(err.message || "Failed to load organization")}</div>`;
    }
  }

  function render(org) {
    const wrap = document.getElementById("org-overview-wrap");
    const statusClass = org.status === "active" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400";
    wrap.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div class="lg:col-span-4 bg-slate-900 rounded-lg border border-slate-800 p-6">
          <h2 class="text-xl font-semibold text-white mb-4">Organization</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label class="text-sm text-slate-400 mb-1 block">Organization Name</label><p class="text-white font-medium">${esc(org.name)}</p></div>
            <div><label class="text-sm text-slate-400 mb-1 block">Status</label><span class="inline-block px-3 py-1 rounded-full text-sm font-medium ${statusClass}">${esc(org.status)}</span></div>
            <div><label class="text-sm text-slate-400 mb-1 block">Country</label><p class="text-white font-medium">${esc(org.country_code)}</p></div>
            <div><label class="text-sm text-slate-400 mb-1 block">Industry</label><p class="text-white font-medium">${esc(org.industry || "—")}</p></div>
            <div><label class="text-sm text-slate-400 mb-1 block">Currency</label><p class="text-white font-medium">${esc(org.default_currency)}</p></div>
            <div><label class="text-sm text-slate-400 mb-1 block">Timezone</label><p class="text-white font-medium">${esc(org.timezone)}</p></div>
          </div>
        </div>

        <div class="lg:col-span-4 bg-slate-900 rounded-lg border border-slate-800 p-6">
          <h2 class="text-xl font-semibold text-white mb-4">Organization Structure</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a href="/dashboard/organization/offices/" class="p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-cyan-500 transition cursor-pointer group">
              <div class="text-cyan-400 font-semibold group-hover:text-cyan-300 mb-2">🏢 Offices</div>
              <p class="text-sm text-slate-400">Manage office locations and settings</p>
            </a>
            <a href="/dashboard/organization/departments/" class="p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-cyan-500 transition cursor-pointer group">
              <div class="text-cyan-400 font-semibold group-hover:text-cyan-300 mb-2">📊 Departments</div>
              <p class="text-sm text-slate-400">Organize departments and hierarchies</p>
            </a>
            <a href="/dashboard/organization/teams/" class="p-4 bg-slate-800 rounded-lg border border-slate-700 hover:border-cyan-500 transition cursor-pointer group">
              <div class="text-cyan-400 font-semibold group-hover:text-cyan-300 mb-2">👥 Teams</div>
              <p class="text-sm text-slate-400">Create and manage teams</p>
            </a>
          </div>
        </div>

        <div class="lg:col-span-4 bg-slate-900 rounded-lg border border-slate-800 p-6">
          <h2 class="text-xl font-semibold text-white mb-4">Settings</h2>
          <div class="space-y-4">
            <div class="flex items-center justify-between p-3 bg-slate-800 rounded-lg"><span class="text-slate-300">Language &amp; Locale</span><span class="text-white font-medium">${esc(org.default_language)}</span></div>
            <div class="flex items-center justify-between p-3 bg-slate-800 rounded-lg"><span class="text-slate-300">Fiscal Year Start</span><span class="text-white font-medium">${org.fiscal_year_start ? esc(org.fiscal_year_start) : "—"}</span></div>
            <div class="flex items-center justify-between p-3 bg-slate-800 rounded-lg"><span class="text-slate-300">Date Format</span><span class="text-white font-medium">${esc(org.date_format)}</span></div>
          </div>
        </div>
      </div>`;
  }

  document.addEventListener("DOMContentLoaded", load);
})();
