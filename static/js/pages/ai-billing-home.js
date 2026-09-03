/**
 * Pixel-precise port of app/platform/ai-billing/page.tsx.
 * The source page's balance came from a nonexistent /api/v1/ai/credits/balance
 * endpoint (404 in the original app) - this reads the real ai_credit_balance
 * field off /organizations/me instead (see apps/ai_billing/api.py, which
 * already reads/writes that same field for top-ups).
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  const BUNDLES = [
    { label: "Starter", credits: 500, price: 5, highlight: false },
    { label: "Pro", credits: 2000, price: 18, highlight: true },
    { label: "Business", credits: 10000, price: 80, highlight: false },
    { label: "Enterprise", credits: 50000, price: 350, highlight: false },
  ];

  const ACTION_ICONS = { cv_parsing: "📄", cv_scoring: "⭐", payroll_anomaly: "🔍", ai_chat: "💬" };

  let ledger = [];

  function renderBundles() {
    const el = document.getElementById("ai-bundles");
    el.innerHTML = BUNDLES.map(
      (b) => `
      <div class="relative rounded-xl border p-5 flex flex-col gap-3 ${b.highlight ? "border-violet-500 bg-violet-950/30" : "border-slate-800 bg-slate-900/60"}">
        ${b.highlight ? '<span class="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-2.5 py-0.5 text-[10px] font-bold text-white">POPULAR</span>' : ""}
        <div><p class="font-semibold">${b.label}</p><p class="mt-1 text-3xl font-bold text-violet-300">${b.credits.toLocaleString()}</p><p class="text-xs text-slate-500">credits</p></div>
        <p class="text-2xl font-bold text-white">$${b.price}</p>
        <button data-credits="${b.credits}" class="topup-btn w-full rounded py-2 text-sm font-semibold transition ${b.highlight ? "bg-violet-500 text-white hover:bg-violet-400" : "border border-slate-700 text-slate-300 hover:border-violet-500 hover:text-violet-300"}">Buy ${b.credits.toLocaleString()} Credits</button>
      </div>`
    ).join("");
    el.querySelectorAll(".topup-btn").forEach((btn) => btn.addEventListener("click", () => topUp(Number(btn.dataset.credits))));
  }

  async function topUp(credits) {
    try {
      await apiRequest("/ai-credits/top-up", { method: "POST", body: JSON.stringify({ credits }) });
      pushToast(`+${credits.toLocaleString()} credits added`, "success");
      load();
    } catch (err) {
      pushToast(err.message || "Error", "error");
    }
  }

  function renderLedger() {
    const wrap = document.getElementById("ai-ledger-wrap");
    if (ledger.length === 0) {
      wrap.innerHTML = '<p class="text-sm text-slate-500">No AI credit usage recorded yet.</p>';
      return;
    }
    const usedTotal = ledger.reduce((s, l) => s + (Number(l.credits_used) || 0), 0);
    wrap.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-slate-800 text-left text-xs text-slate-400"><th class="pb-2 pr-6">Action</th><th class="pb-2 pr-6">Description</th><th class="pb-2 pr-6 text-right">Credits Used</th><th class="pb-2">Timestamp</th></tr></thead>
          <tbody>
            ${ledger
              .map(
                (row) => `
              <tr class="border-b border-slate-800/50 hover:bg-slate-900/30">
                <td class="py-2.5 pr-6"><span class="mr-2">${ACTION_ICONS[row.action_type] || "🤖"}</span><span class="text-xs font-mono text-slate-300">${esc(row.action_type)}</span></td>
                <td class="py-2.5 pr-6 text-xs text-slate-400">${row.description ? esc(row.description) : "—"}</td>
                <td class="py-2.5 pr-6 text-right font-semibold text-rose-300">-${Number(row.credits_used).toLocaleString()}</td>
                <td class="py-2.5 text-xs text-slate-500">${row.created_at ? new Date(row.created_at).toLocaleString() : "—"}</td>
              </tr>`
              )
              .join("")}
            <tr class="border-t border-slate-700 font-semibold"><td colspan="2" class="py-2 text-slate-400">Total Used</td><td class="py-2 text-right text-rose-300">-${usedTotal.toLocaleString()}</td><td></td></tr>
          </tbody>
        </table>
      </div>`;
  }

  async function load() {
    try {
      const [orgRes, ledgerRes] = await Promise.allSettled([apiRequest("/organizations/me"), apiRequest("/ai-credits/ledger?per_page=100")]);
      let balance = 0;
      if (orgRes.status === "fulfilled") balance = Number(unwrapData(orgRes.value)?.ai_credit_balance) || 0;
      if (ledgerRes.status === "fulfilled") ledger = unwrapData(ledgerRes.value)?.data || [];

      document.getElementById("ai-balance").textContent = balance.toLocaleString();
      const usedTotal = ledger.reduce((s, l) => s + (Number(l.credits_used) || 0), 0);
      document.getElementById("ai-used").textContent = usedTotal.toLocaleString();
      document.getElementById("ai-tx-count").textContent = ledger.length;
      renderLedger();
    } catch (err) {
      /* silent, matches source page's Promise.allSettled swallow-and-show-dashes behavior */
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderBundles();
    load();

    document.getElementById("ai-custom-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const c = Number(new FormData(e.target).get("credits"));
      if (!c || c < 100) {
        pushToast("Minimum 100 credits", "error");
        return;
      }
      await topUp(c);
      e.target.reset();
    });
  });
})();
