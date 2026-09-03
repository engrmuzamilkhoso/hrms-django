/**
 * Pixel-precise port of saas-hrms-frontend/app/platform/leave/page.tsx.
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  const ADMIN = window.LEAVE_IS_ADMIN;
  const MANAGER = window.LEAVE_IS_MANAGER;
  const PRIVILEGED = ADMIN || MANAGER;

  const CAT_ICON = { annual: "🌴", sick: "🏥", casual: "🎯" };
  const CAT_COLOR = { annual: "text-violet-400", sick: "text-rose-400", casual: "text-cyan-400" };
  const CAT_CARD_SEL = {
    annual: "border-violet-500/60 bg-violet-500/12 shadow-[0_0_0_1px_rgba(28,98,253,0.3)]",
    sick: "border-rose-500/60 bg-rose-500/12 shadow-[0_0_0_1px_rgba(244,63,94,0.3)]",
    casual: "border-cyan-500/60 bg-cyan-500/12 shadow-[0_0_0_1px_rgba(6,182,212,0.3)]",
  };
  const CAT_CARD_IDLE = {
    annual: "border-violet-500/15 bg-violet-500/4",
    sick: "border-rose-500/15 bg-rose-500/4",
    casual: "border-cyan-500/15 bg-cyan-500/4",
  };
  const CAT_IDLE_BG = { annual: "bg-violet-500/6", sick: "bg-rose-500/6", casual: "bg-cyan-500/6" };
  const STATUS_META = {
    all: { icon: "◉", sel: "border-white/30 bg-white/8 text-slate-100", idle: "border-white/8 text-slate-400 hover:border-white/15 hover:text-slate-300" },
    pending: { icon: "⏳", sel: "border-amber-500/50 bg-amber-500/12 text-amber-400", idle: "border-amber-500/15 text-slate-400 hover:border-amber-500/30 hover:text-amber-400" },
    approved: { icon: "✓", sel: "border-emerald-500/50 bg-emerald-500/12 text-emerald-400", idle: "border-emerald-500/15 text-slate-400 hover:border-emerald-500/30 hover:text-emerald-400" },
    rejected: { icon: "✕", sel: "border-rose-500/50 bg-rose-500/12 text-rose-400", idle: "border-rose-500/15 text-slate-400 hover:border-rose-500/30 hover:text-rose-400" },
  };
  const STATUS_BADGE = {
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    rejected: "bg-rose-500/15 text-rose-400 border-rose-500/25",
  };
  const STATUS_COLORS = {
    active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    expiring_soon: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    expired: "bg-rose-500/15 text-rose-400 border-rose-500/25",
  };
  const REASONS = ["Medical / Health Issue", "Family Emergency", "Personal Matter", "Travel / Trip", "Rest & Recovery", "Festival / Event", "Other"];

  function statusBadgeHtml(status) {
    return `<span class="rounded-full border px-2.5 py-0.5 text-xs capitalize ${STATUS_BADGE[status] || "bg-slate-700 text-slate-300 border-white/10"}">${esc(status)}</span>`;
  }
  function fmtDate(d) {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  function fmtDateOrDash(d) {
    return d ? fmtDate(d) : "—";
  }

  // ── Page-level state ──────────────────────────────────────────────────
  let types = [];
  let policies = [];
  let employees = [];
  const loadedTabs = {};

  async function loadTypes() {
    try {
      const r = await apiRequest("/leave-types");
      const d = unwrapData(r);
      types = (d && d.data) || d || [];
    } catch (e) {}
  }
  async function loadPolicies() {
    try {
      const r = await apiRequest("/leave-policies");
      policies = unwrapData(r) || [];
    } catch (e) {}
  }
  async function loadEmployees() {
    try {
      const r = await apiRequest("/employees?per_page=200");
      employees = unwrapData(r)?.data || [];
    } catch (e) {}
  }

  function switchTab(tab) {
    document.querySelectorAll("#leave-tab-bar .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    const url = new URL(window.location);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url);
    renderTab(tab);
  }

  function renderTab(tab) {
    if (tab === "requests") renderRequestsTab();
    else if (tab === "apply") renderApplyTab();
    else if (tab === "approvals") renderApprovalsTab();
    else if (tab === "policies") renderPoliciesTab();
    else if (tab === "balances" && !loadedTabs.balances) {
      loadedTabs.balances = true;
      renderBalancesTab();
    } else if (tab === "report" && !loadedTabs.report) {
      loadedTabs.report = true;
      renderReportTab();
    }
  }

  // ── Shared filter-chip-row builder ──────────────────────────────────────
  function typeChipsHtml(fType, counts) {
    const defs = [
      ["all", "All", "◉", counts.all, "border-white/20 bg-white/6 text-slate-100", "border-white/8 text-slate-400 hover:border-white/15 hover:text-slate-300"],
      ["annual", "Annual", "🌴", counts.annual, "border-violet-500/60 bg-violet-500/12 text-violet-400", "border-violet-500/15 text-slate-400 hover:border-violet-500/30 hover:text-violet-400"],
      ["sick", "Sick", "🏥", counts.sick, "border-rose-500/60 bg-rose-500/12 text-rose-400", "border-rose-500/15 text-slate-400 hover:border-rose-500/30 hover:text-rose-400"],
      ["casual", "Casual", "🎯", counts.casual, "border-cyan-500/60 bg-cyan-500/12 text-cyan-400", "border-cyan-500/15 text-slate-400 hover:border-cyan-500/30 hover:text-cyan-400"],
    ];
    return defs
      .map(
        ([val, label, icon, count, selCls, idleCls]) => `
      <button data-ftype="${val}" class="ftype-btn inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none ${fType === val ? selCls : idleCls}">
        <span class="text-[13px] leading-none">${icon}</span><span>${label}</span>
        <span class="rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${fType === val ? "bg-white/15" : "bg-white/6"}">${count}</span>
      </button>`
      )
      .join("");
  }
  function statusChipsHtml(fStatus, counts) {
    return ["all", "pending", "approved", "rejected"]
      .map((s) => {
        const m = STATUS_META[s];
        return `
      <button data-fstatus="${s}" class="fstatus-btn inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none ${fStatus === s ? m.sel : m.idle}">
        <span class="text-[10px]">${m.icon}</span><span class="capitalize">${s}</span>
        <span class="rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${fStatus === s ? "bg-white/15" : "bg-white/6"}">${counts[s]}</span>
      </button>`;
      })
      .join("");
  }
  function durationSegHtml(fDuration) {
    return [
      ["all", "All"],
      ["full_day", "Full Day"],
      ["half_day", "Half Day"],
    ]
      .map(
        ([v, l]) => `
      <button data-fduration="${v}" class="fduration-btn px-4 py-1.5 text-xs font-semibold transition border-r border-white/8 last:border-r-0 ${
          fDuration === v ? "bg-violet-500/20 text-violet-300" : "text-slate-400 hover:text-slate-200 hover:bg-white/4"
        }">${l}</button>`
      )
      .join("");
  }
  const CALENDAR_SVG = '<svg class="h-3.5 w-3.5 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';

  /* ══════════════════════════════════════════════════════════════
     MY REQUESTS TAB
  ══════════════════════════════════════════════════════════════ */
  const reqState = { requests: [], loading: true, deletingId: null, fType: "all", fStatus: "all", fDuration: "all", fFrom: "", fTo: "" };

  async function renderRequestsTab() {
    reqState.loading = true;
    paintRequestsTab();
    try {
      const r = await apiRequest("/leave-requests/my");
      reqState.requests = unwrapData(r) || [];
    } catch (e) {
      reqState.requests = [];
    }
    reqState.loading = false;
    paintRequestsTab();
  }

  function computeCounts(list, catKey, statusKey) {
    const cat = { all: list.length, annual: 0, sick: 0, casual: 0 };
    const st = { all: list.length, pending: 0, approved: 0, rejected: 0 };
    list.forEach((r) => {
      const c = (r.leave_type && r.leave_type.category) || "";
      if (cat[c] !== undefined) cat[c]++;
      if (st[r.status] !== undefined) st[r.status]++;
    });
    return { cat, st };
  }

  function paintRequestsTab() {
    const root = document.getElementById("requests-tab-root");
    const s = reqState;
    const counts = computeCounts(s.requests);
    const filtered = s.requests.filter((r) => {
      if (s.fType !== "all" && ((r.leave_type && r.leave_type.category) || "") !== s.fType) return false;
      if (s.fStatus !== "all" && r.status !== s.fStatus) return false;
      if (s.fDuration !== "all" && r.duration_type !== s.fDuration) return false;
      if (s.fFrom && r.from_date < s.fFrom) return false;
      if (s.fTo && r.to_date > s.fTo) return false;
      return true;
    });
    const hasActiveFilter = s.fType !== "all" || s.fStatus !== "all" || s.fDuration !== "all" || s.fFrom || s.fTo;

    let resultsHtml;
    if (s.loading) {
      resultsHtml = '<div class="space-y-3">' + [1, 2, 3].map(() => '<div class="h-[76px] rounded-xl border border-white/6 bg-white/2 animate-pulse"></div>').join("") + "</div>";
    } else if (filtered.length === 0) {
      resultsHtml = `
        <div class="rounded-2xl border border-white/6 bg-white/2 py-16 text-center">
          <p class="text-4xl mb-3">📋</p>
          <p class="text-base font-semibold text-slate-300">${s.requests.length === 0 ? "No leave requests yet" : "No requests match your filters"}</p>
          <p class="text-sm text-slate-500 mt-1">${s.requests.length === 0 ? "Go to Apply Leave to submit your first request." : "Try adjusting or resetting the filters above."}</p>
        </div>`;
    } else {
      resultsHtml =
        '<div class="space-y-2">' +
        filtered
          .map((r) => {
            const cat = (r.leave_type && r.leave_type.category) || "";
            const isDeleting = s.deletingId === r.id;
            return `
        <div class="rounded-xl border border-white/6 bg-white/2 px-4 py-2.5 flex items-center gap-4 hover:bg-white/4 hover:border-white/10 transition">
          <span class="text-xs font-medium w-20 shrink-0 ${CAT_COLOR[cat] || "text-slate-300"}">${esc((r.leave_type && r.leave_type.name) || "Leave")}</span>
          <div class="text-xs text-slate-400 w-44 shrink-0">
            ${fmtDate(r.from_date)}${r.from_date !== r.to_date ? ` → ${fmtDate(r.to_date)}` : ""}
            <span class="ml-2 font-semibold text-slate-300">${r.requested_days}d</span>
          </div>
          <p class="flex-1 min-w-0 text-xs text-slate-500 italic truncate">${r.reason ? `"${esc(r.reason)}"` : "—"}</p>
          <div class="shrink-0">${statusBadgeHtml(r.status)}</div>
          ${
            r.status === "pending"
              ? `<button data-del="${r.id}" ${isDeleting ? "disabled" : ""} class="del-req-btn shrink-0 rounded-lg border border-rose-500/30 bg-white px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40 transition">
                  ${isDeleting ? '<span class="inline-block h-3 w-3 rounded-full border-2 border-rose-500 border-t-transparent animate-spin"></span>' : '<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>'}
                </button>`
              : ""
          }
        </div>`;
          })
          .join("") +
        "</div>";
    }

    root.innerHTML = `
      <div class="mt-6 space-y-5">
        <div class="rounded-2xl border border-white/8 bg-slate-900/50 overflow-hidden">
          <div class="px-5 pt-5 pb-4 border-b border-white/5 flex flex-wrap items-start gap-x-8 gap-y-4">
            <div><p class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Leave Type</p><div class="flex flex-wrap gap-2" id="req-type-chips">${typeChipsHtml(s.fType, counts.cat)}</div></div>
            <div class="h-auto w-px self-stretch bg-white/6 hidden sm:block"></div>
            <div><p class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Status</p><div class="flex flex-wrap gap-2" id="req-status-chips">${statusChipsHtml(s.fStatus, counts.st)}</div></div>
          </div>
          <div class="px-5 py-4 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Date Range</p>
              <div class="flex items-center gap-2">
                <div class="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 focus-within:border-violet-500/40">
                  ${CALENDAR_SVG}<input type="date" id="req-from" value="${s.fFrom}" class="flex-1 min-w-0 bg-transparent border-none outline-none text-xs text-slate-200 [color-scheme:dark]">
                </div>
                <span class="text-slate-600 text-sm shrink-0">—</span>
                <div class="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 focus-within:border-violet-500/40">
                  ${CALENDAR_SVG}<input type="date" id="req-to" value="${s.fTo}" class="flex-1 min-w-0 bg-transparent border-none outline-none text-xs text-slate-200 [color-scheme:dark]">
                </div>
                ${s.fFrom || s.fTo ? '<button id="req-clear-dates" class="shrink-0 text-xs text-slate-500 hover:text-rose-400 transition px-2 py-1.5 rounded-lg border border-white/6 hover:border-rose-500/20">Clear</button>' : ""}
              </div>
            </div>
            <div class="h-auto w-px self-stretch bg-white/6 hidden sm:block"></div>
            <div><p class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Duration</p><div class="inline-flex rounded-xl border border-white/10 overflow-hidden" id="req-duration-seg">${durationSegHtml(s.fDuration)}</div></div>
            ${hasActiveFilter ? '<button id="req-reset-filters" class="ml-auto self-end text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5 rounded-lg border border-white/6 hover:border-white/15 px-3 py-1.5"><svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>Reset all filters</button>' : ""}
          </div>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-sm text-slate-500">Showing <span class="font-semibold text-slate-200">${filtered.length}</span> of <span class="font-semibold text-slate-200">${s.requests.length}</span> requests</p>
          ${
            hasActiveFilter
              ? `<div class="flex flex-wrap gap-1.5">
              ${s.fType !== "all" ? `<span class="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[11px] text-violet-400">${CAT_ICON[s.fType]} ${s.fType}</span>` : ""}
              ${s.fStatus !== "all" ? `<span class="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-slate-300 capitalize">${s.fStatus}</span>` : ""}
              ${s.fDuration !== "all" ? `<span class="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-slate-300">${s.fDuration.replace("_", " ")}</span>` : ""}
              ${s.fFrom || s.fTo ? `<span class="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-slate-300">${s.fFrom || "…"} → ${s.fTo || "…"}</span>` : ""}
            </div>`
              : ""
          }
        </div>

        ${resultsHtml}
      </div>`;

    root.querySelectorAll(".ftype-btn").forEach((b) => b.addEventListener("click", () => { reqState.fType = b.dataset.ftype; paintRequestsTab(); }));
    root.querySelectorAll(".fstatus-btn").forEach((b) => b.addEventListener("click", () => { reqState.fStatus = b.dataset.fstatus; paintRequestsTab(); }));
    root.querySelectorAll(".fduration-btn").forEach((b) => b.addEventListener("click", () => { reqState.fDuration = b.dataset.fduration; paintRequestsTab(); }));
    const fromInput = document.getElementById("req-from");
    const toInput = document.getElementById("req-to");
    if (fromInput) fromInput.addEventListener("change", (e) => { reqState.fFrom = e.target.value; paintRequestsTab(); });
    if (toInput) toInput.addEventListener("change", (e) => { reqState.fTo = e.target.value; paintRequestsTab(); });
    const clearBtn = document.getElementById("req-clear-dates");
    if (clearBtn) clearBtn.addEventListener("click", () => { reqState.fFrom = ""; reqState.fTo = ""; paintRequestsTab(); });
    const resetBtn = document.getElementById("req-reset-filters");
    if (resetBtn) resetBtn.addEventListener("click", () => { Object.assign(reqState, { fType: "all", fStatus: "all", fDuration: "all", fFrom: "", fTo: "" }); paintRequestsTab(); });
    root.querySelectorAll(".del-req-btn").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this leave request?")) return;
        const id = Number(b.dataset.del);
        reqState.deletingId = id;
        paintRequestsTab();
        try {
          await apiRequest(`/leave-requests/${id}`, { method: "DELETE" });
          pushToast("Leave request deleted", "success");
          reqState.requests = reqState.requests.filter((r) => r.id !== id);
        } catch (e) {
          pushToast(e.message || "Error deleting", "error");
        }
        reqState.deletingId = null;
        paintRequestsTab();
      })
    );
  }

  /* ══════════════════════════════════════════════════════════════
     APPLY LEAVE TAB
  ══════════════════════════════════════════════════════════════ */
  const applyState = {
    typeId: "", fromDate: "", toDate: "", duration: "full_day", reason: "", otherReason: "",
    approvalChain: null, balances: {}, errors: {}, submitting: false,
  };

  async function renderApplyTab() {
    Object.assign(applyState, { typeId: "", fromDate: "", toDate: "", duration: "full_day", reason: "", otherReason: "", approvalChain: null, balances: {}, errors: {}, submitting: false });
    paintApplyTab();
    try {
      const r = await apiRequest("/leave-requests/approval-chain");
      applyState.approvalChain = unwrapData(r);
    } catch (e) {}
    try {
      const r = await apiRequest("/reports/employee-dashboard");
      const d = unwrapData(r);
      const bals = (d && d.leave_balances) || [];
      const map = {};
      bals.forEach((b) => {
        const id = Number(b.leave_type_id);
        if (id) map[id] = { allocated: Number(b.allocated_days || 0), carry_forward: Number(b.carry_forward_days || 0), opening: Number(b.opening_balance || b.allocated_days || 0), used: Number(b.used_days || 0), remaining: Number(b.remaining_days || 0) };
      });
      applyState.balances = map;
    } catch (e) {}
    paintApplyTab();
  }

  function computeDaysBetween(fromDate, toDate, duration) {
    if (!fromDate || !toDate || toDate < fromDate) return 0;
    const ms = new Date(toDate).getTime() - new Date(fromDate).getTime();
    const days = Math.round(ms / 86400000) + 1;
    return duration === "half_day" ? 0.5 : days;
  }

  function paintApplyTab() {
    const root = document.getElementById("apply-tab-root");
    const s = applyState;
    const isMultiDay = !!(s.fromDate && s.toDate && s.fromDate !== s.toDate);
    if (isMultiDay && s.duration === "half_day") s.duration = "full_day";
    const selectedType = types.find((t) => String(t.id) === s.typeId);
    const daysBetween = computeDaysBetween(s.fromDate, s.toDate, s.duration);

    let typeGridHtml;
    if (types.length === 0) {
      typeGridHtml = '<div class="rounded-xl border border-amber-500/20 bg-amber-500/6 px-4 py-3 text-sm text-amber-300">No leave types configured — contact HR.</div>';
    } else {
      const cols = Math.min(types.length, 3);
      typeGridHtml = `<div class="grid gap-3" style="grid-template-columns:repeat(${cols},1fr)">`;
      typeGridHtml += types
        .map((t) => {
          const cat = t.category || "";
          const sel = s.typeId === String(t.id);
          const bal = s.balances[t.id];
          const remaining = bal ? bal.remaining : null;
          const remVal = remaining != null ? remaining : t.annual_quota;
          return `
        <button type="button" data-type-id="${t.id}" class="type-card-btn relative overflow-hidden rounded-xl border p-3 text-left transition focus:outline-none group ${
            sel ? CAT_CARD_SEL[cat] || "border-violet-500/60 bg-violet-500/12" : `${CAT_CARD_IDLE[cat] || "border-white/8"} ${CAT_IDLE_BG[cat] || "bg-white/3"} hover:border-white/20`
          }">
          <div class="flex items-start justify-between mb-2">
            <span class="text-xl">${CAT_ICON[cat] || "📋"}</span>
            <div class="flex h-5 w-5 items-center justify-center rounded-full transition ${sel ? "text-violet-400 shadow-[0_0_0_1px_rgba(28,98,253,0.3)]" : "border border-white/15"}">${sel ? '<span class="text-[9px] font-bold">✓</span>' : ""}</div>
          </div>
          <p class="text-sm font-semibold ${sel ? CAT_COLOR[cat] || "text-violet-400" : "text-slate-200"}">${esc(t.name)}</p>
          <div class="mt-2 text-[11px] space-y-0.5">
            <p class="text-slate-500">${bal ? `${bal.allocated} allocated` : `${t.annual_quota} / year`}${bal && bal.carry_forward > 0 ? `<span class="text-violet-400"> + ${bal.carry_forward} CF</span>` : ""}</p>
            <p><span class="font-medium ${remVal <= 0 ? "text-rose-400" : remVal <= 2 ? "text-amber-400" : "text-emerald-400"}">${remVal} remaining</span>${bal && bal.used > 0 ? `<span class="text-slate-600"> · ${bal.used} used</span>` : ""}</p>
          </div>
        </button>`;
        })
        .join("");
      typeGridHtml += "</div>";
    }

    const durationCardsHtml = [
      ["full_day", "☀️", "Full Day", "Work an entire day off"],
      ["half_day", "🌤", "Half Day", "Morning or afternoon off"],
    ]
      .map(([v, icon, label, sub]) => {
        const disabled = v === "half_day" && isMultiDay;
        const selected = s.duration === v;
        return `
      <button type="button" data-duration="${v}" ${disabled ? "disabled" : ""} class="duration-card-btn relative rounded-2xl border p-4 text-left transition focus:outline-none ${
          disabled ? "border-white/5 bg-white/1 opacity-40 cursor-not-allowed" : selected ? "border-violet-500/50 shadow-[0_0_0_1px_rgba(28,98,253,0.3)]" : "border-white/8 bg-white/2 hover:bg-white/4 hover:border-white/15"
        }">
        ${selected && !disabled ? '<div class="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full text-violet-400 shadow-[0_0_0_1px_rgba(28,98,253,0.3)] text-[10px]">✓</div>' : ""}
        <span class="text-2xl">${icon}</span>
        <p class="text-sm font-semibold mt-2 ${selected && !disabled ? "text-violet-400" : "text-slate-200"}">${label}</p>
        <p class="text-xs text-slate-500 mt-0.5">${disabled ? "Not available for multi-day" : sub}</p>
      </button>`;
      })
      .join("");

    const previewHtml = !selectedType
      ? '<div class="text-center py-6"><p class="text-3xl mb-2">📋</p><p class="text-xs text-slate-500">Select a leave type to preview</p></div>'
      : `
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <span class="text-3xl">${CAT_ICON[selectedType.category || ""] || "📋"}</span>
          <div><p class="font-bold ${CAT_COLOR[selectedType.category || ""] || "text-slate-200"}">${esc(selectedType.name)}</p><p class="text-xs text-slate-500">${selectedType.annual_quota} days/year quota</p></div>
        </div>
        <div class="border-t border-white/6 pt-3 space-y-2">
          <div class="flex justify-between text-xs"><span class="text-slate-500">Duration</span><span class="text-slate-200 font-medium capitalize">${s.duration.replace("_", " ")}</span></div>
          ${s.fromDate ? `<div class="flex justify-between text-xs"><span class="text-slate-500">From</span><span class="text-slate-200 font-medium">${fmtDate(s.fromDate)}</span></div>` : ""}
          ${s.toDate ? `<div class="flex justify-between text-xs"><span class="text-slate-500">To</span><span class="text-slate-200 font-medium">${fmtDate(s.toDate)}</span></div>` : ""}
          ${daysBetween > 0 ? `<div class="flex justify-between text-xs border-t border-white/6 pt-2 mt-2"><span class="text-slate-500">Days requested</span><span class="font-bold text-base ${CAT_COLOR[selectedType.category || ""] || "text-white"}">${daysBetween}</span></div>` : ""}
          ${s.reason ? `<div class="flex justify-between text-xs"><span class="text-slate-500">Reason</span><span class="text-slate-200 font-medium">${esc(s.reason === "Other" ? s.otherReason || "—" : s.reason)}</span></div>` : ""}
        </div>
      </div>`;

    let approvalChainHtml = "";
    if (s.approvalChain && s.approvalChain.line_manager) {
      approvalChainHtml = `
      <div class="rounded-2xl border border-amber-500/20 bg-amber-500/6 p-5">
        <p class="text-xs font-bold uppercase tracking-widest text-amber-500/70 mb-3">Approval Chain</p>
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-300">${esc(s.approvalChain.line_manager.full_name.charAt(0))}</div>
            <div><p class="text-xs font-semibold text-white">${esc(s.approvalChain.line_manager.full_name)}</p><p class="text-[11px] text-slate-500">Line Manager</p></div>
            <span class="ml-auto rounded-full bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">1st</span>
          </div>
          ${
            s.approvalChain.hr_manager
              ? `<div class="flex items-center gap-3">
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-300">${esc(s.approvalChain.hr_manager.full_name.charAt(0))}</div>
              <div><p class="text-xs font-semibold text-white">${esc(s.approvalChain.hr_manager.full_name)}</p><p class="text-[11px] text-slate-500">HR Manager</p></div>
              <span class="ml-auto rounded-full bg-violet-500/15 border border-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">2nd</span>
            </div>`
              : ""
          }
        </div>
      </div>`;
    }

    root.innerHTML = `
      <div class="mt-6">
        <form id="apply-form">
          <div class="grid gap-6 xl:grid-cols-[1fr_340px]">
            <div class="space-y-6">
              <div class="rounded-2xl border border-white/8 bg-slate-900/40 p-6">
                <p class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Step 1 — Select Leave Type</p>
                ${typeGridHtml}
                ${s.errors.typeId ? `<p class="mt-3 text-xs text-rose-400">${esc(s.errors.typeId)}</p>` : ""}
              </div>
              <div class="rounded-2xl border border-white/8 bg-slate-900/40 p-6">
                <p class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Step 2 — Duration</p>
                <div class="grid grid-cols-2 gap-3">${durationCardsHtml}</div>
              </div>
              <div class="rounded-2xl border border-white/8 bg-slate-900/40 p-6">
                <p class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Step 3 — Date Range</p>
                <div class="grid grid-cols-2 gap-4">
                  <div><label class="form-label">Start Date *</label><input type="date" id="apply-from" value="${s.fromDate}" class="form-input mt-1 ${s.errors.fromDate ? "!border-rose-500/60" : ""}">${s.errors.fromDate ? `<p class="mt-1 text-xs text-rose-400">${esc(s.errors.fromDate)}</p>` : ""}</div>
                  <div><label class="form-label">End Date *</label><input type="date" id="apply-to" value="${s.toDate}" ${s.fromDate ? `min="${s.fromDate}"` : ""} class="form-input mt-1 ${s.errors.toDate ? "!border-rose-500/60" : ""}">${s.errors.toDate ? `<p class="mt-1 text-xs text-rose-400">${esc(s.errors.toDate)}</p>` : ""}</div>
                </div>
                ${
                  s.fromDate && s.toDate && daysBetween > 0
                    ? `<div class="mt-4 flex items-center gap-2 rounded-xl bg-white/4 border border-white/8 px-4 py-2.5">
                    <svg class="h-4 w-4 text-violet-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p class="text-xs text-slate-400"><span class="font-bold text-white text-sm">${daysBetween}</span> ${daysBetween === 1 || daysBetween === 0.5 ? "day" : "days"} requested${s.fromDate !== s.toDate ? `<span class="ml-2 text-slate-500">(${fmtDate(s.fromDate)} — ${fmtDate(s.toDate)})</span>` : ""}</p>
                  </div>`
                    : ""
                }
              </div>
              <div class="rounded-2xl border border-white/8 bg-slate-900/40 p-6">
                <p class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Step 4 — Reason <span class="normal-case font-normal text-slate-600">(optional)</span></p>
                <select id="apply-reason" class="form-select">
                  <option value="">— Select a reason —</option>
                  ${REASONS.map((r) => `<option value="${esc(r)}" ${s.reason === r ? "selected" : ""}>${esc(r)}</option>`).join("")}
                </select>
                ${
                  s.reason === "Other"
                    ? `<div class="mt-3"><textarea id="apply-other-reason" rows="3" placeholder="Please describe your reason…" class="form-input resize-none ${s.errors.otherReason ? "!border-rose-500/60" : ""}">${esc(s.otherReason)}</textarea>${s.errors.otherReason ? `<p class="mt-1 text-xs text-rose-400">${esc(s.errors.otherReason)}</p>` : ""}</div>`
                    : ""
                }
              </div>
            </div>

            <div class="space-y-4">
              <div class="rounded-2xl border p-5 transition ${selectedType ? CAT_CARD_IDLE[selectedType.category || ""] || "border-white/8 bg-white/2" : "border-white/6 bg-white/2"}">
                <p class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-4">Request Preview</p>
                ${previewHtml}
              </div>
              ${approvalChainHtml}
              <button type="submit" ${s.submitting ? "disabled" : ""} class="btn-primary w-full py-4 text-sm font-bold disabled:opacity-40">
                <span class="inline-flex items-center justify-center gap-2">${s.submitting ? '<span class="btn-spinner"></span>' : ""}${s.submitting ? "Submitting…" : "Submit Leave Request"}</span>
              </button>
              <p class="text-[11px] text-slate-600 text-center">Your request will be sent to your line manager for review.</p>
            </div>
          </div>
        </form>
      </div>`;

    root.querySelectorAll(".type-card-btn").forEach((b) =>
      b.addEventListener("click", () => {
        s.typeId = b.dataset.typeId;
        if (s.errors.typeId) s.errors.typeId = "";
        paintApplyTab();
      })
    );
    root.querySelectorAll(".duration-card-btn").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.disabled) return;
        s.duration = b.dataset.duration;
        paintApplyTab();
      })
    );
    const fromEl = document.getElementById("apply-from");
    const toEl = document.getElementById("apply-to");
    if (fromEl)
      fromEl.addEventListener("change", (e) => {
        s.fromDate = e.target.value;
        if (!s.toDate || e.target.value > s.toDate) s.toDate = e.target.value;
        if (s.errors.fromDate) s.errors.fromDate = "";
        paintApplyTab();
      });
    if (toEl)
      toEl.addEventListener("change", (e) => {
        s.toDate = e.target.value;
        if (s.errors.toDate) s.errors.toDate = "";
        paintApplyTab();
      });
    const reasonEl = document.getElementById("apply-reason");
    if (reasonEl)
      reasonEl.addEventListener("change", (e) => {
        s.reason = e.target.value;
        s.otherReason = "";
        paintApplyTab();
      });
    const otherEl = document.getElementById("apply-other-reason");
    if (otherEl)
      otherEl.addEventListener("input", (e) => {
        s.otherReason = e.target.value;
        if (s.errors.otherReason) s.errors.otherReason = "";
      });

    document.getElementById("apply-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errs = {};
      if (!s.typeId) errs.typeId = "Please select a leave type";
      if (!s.fromDate) errs.fromDate = "Start date is required";
      if (!s.toDate) errs.toDate = "End date is required";
      else if (s.fromDate && s.toDate < s.fromDate) errs.toDate = "End date must be on or after start date";
      if (s.reason === "Other" && !s.otherReason.trim()) errs.otherReason = "Please describe the reason";
      if (s.typeId && daysBetween > 0) {
        const bal = s.balances[Number(s.typeId)];
        const selType = types.find((t) => String(t.id) === s.typeId);
        if (bal && selType && selType.affects_balance && !selType.negative_balance_allowed && daysBetween > bal.remaining) {
          errs.typeId = `Insufficient balance — you have ${bal.remaining} day${bal.remaining !== 1 ? "s" : ""} remaining but requesting ${daysBetween}`;
        }
      }
      if (Object.keys(errs).length) {
        s.errors = errs;
        paintApplyTab();
        return;
      }
      s.errors = {};
      s.submitting = true;
      paintApplyTab();
      const finalReason = s.reason === "Other" ? s.otherReason.trim() : s.reason;
      try {
        await apiRequest("/leave-requests", {
          method: "POST",
          body: JSON.stringify({ leave_type_id: Number(s.typeId), from_date: s.fromDate, to_date: s.toDate, duration_type: s.duration, reason: finalReason }),
        });
        pushToast("Leave request submitted — pending approval", "success");
        switchTab("requests");
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        s.submitting = false;
        paintApplyTab();
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     APPROVALS TAB
  ══════════════════════════════════════════════════════════════ */
  const apprState = { requests: [], myTeam: [], loading: true, actingId: null, actingType: null, fType: "all", fStatus: "pending", fDuration: "all", fEmployee: "all", fFrom: "", fTo: "" };

  async function renderApprovalsTab() {
    apprState.loading = true;
    paintApprovalsTab();
    try {
      const r = await apiRequest("/leave-requests/pending-approval");
      apprState.requests = unwrapData(r) || [];
    } catch (e) {
      apprState.requests = [];
    }
    apprState.loading = false;
    try {
      const r = await apiRequest("/employees?per_page=200");
      const d = unwrapData(r);
      apprState.myTeam = (d && d.data) || d || [];
    } catch (e) {}
    paintApprovalsTab();
  }

  function paintApprovalsTab() {
    const root = document.getElementById("approvals-tab-root");
    const s = apprState;
    const counts = computeCounts(s.requests);
    const teamList = s.myTeam.map((e) => ({ id: e.id, name: e.full_name })).sort((a, b) => a.name.localeCompare(b.name));

    const filtered = s.requests.filter((r) => {
      if (s.fType !== "all" && ((r.leave_type && r.leave_type.category) || "") !== s.fType) return false;
      if (s.fStatus !== "all" && r.status !== s.fStatus) return false;
      if (s.fDuration !== "all" && r.duration_type !== s.fDuration) return false;
      if (s.fEmployee !== "all" && r.employee_id !== Number(s.fEmployee)) return false;
      if (s.fFrom && r.from_date < s.fFrom) return false;
      if (s.fTo && r.to_date > s.fTo) return false;
      return true;
    });
    const hasActiveFilter = s.fType !== "all" || s.fStatus !== "pending" || s.fDuration !== "all" || s.fEmployee !== "all" || s.fFrom || s.fTo;

    let listHtml;
    if (s.loading) {
      listHtml = '<div class="space-y-3">' + [1, 2, 3].map(() => '<div class="h-[76px] rounded-xl border border-white/6 bg-white/2 animate-pulse"></div>').join("") + "</div>";
    } else if (filtered.length === 0) {
      listHtml = `<div class="rounded-xl border border-white/6 bg-white/2 p-10 text-center"><p class="text-3xl mb-2">✅</p><p class="text-slate-400 text-sm">${s.requests.length === 0 ? "No pending approvals — all caught up!" : "No requests match your filters."}</p></div>`;
    } else {
      listHtml =
        '<div class="space-y-2">' +
        filtered
          .map((r) => {
            const cat = (r.leave_type && r.leave_type.category) || "";
            const isActing = s.actingId === r.id;
            const steps = r.approval_steps || [];
            const canAct = r.can_act != null ? r.can_act : r.status === "pending";
            const stepsHtml =
              steps.length > 0
                ? `<div class="flex items-center gap-2 shrink-0 text-[10px]">${steps
                    .map((st, i) => {
                      const role = st.role || (st.level === 1 ? "Line Manager" : "HR");
                      const effStatus = st.status === "pending" && r.status === "approved" ? "approved" : st.status;
                      const isApproved = effStatus === "approved";
                      const isRejected = effStatus === "rejected";
                      const body = isApproved
                        ? `<span class="text-emerald-400">✓ ${esc(role)}: ${esc(st.approver || "—")}</span>`
                        : isRejected
                        ? `<span class="text-rose-400">✕ ${esc(role)}: ${esc(st.approver || "—")}</span>`
                        : `<span class="text-amber-400">⏳ ${esc(role)}: Pending</span>`;
                      return `<span class="inline-flex items-center gap-1">${body}${i < steps.length - 1 ? '<span class="text-slate-700">→</span>' : ""}</span>`;
                    })
                    .join("")}</div>`
                : "";
            return `
        <div class="rounded-xl border border-white/6 bg-white/2 px-4 py-2.5 flex items-center gap-4">
          <div class="flex items-center gap-2 min-w-0 w-40 shrink-0">
            <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-400 text-[10px] font-bold">${esc(((r.employee && r.employee.full_name) || "?").charAt(0).toUpperCase())}</div>
            <div class="min-w-0"><p class="text-sm font-medium text-slate-200 truncate">${esc((r.employee && r.employee.full_name) || `#${r.employee_id}`)}</p><p class="text-[10px] font-mono text-slate-600">${esc((r.employee && r.employee.employee_code) || "")}</p></div>
          </div>
          <span class="text-xs font-medium w-20 shrink-0 ${CAT_COLOR[cat] || "text-slate-300"}">${esc((r.leave_type && r.leave_type.name) || "Leave")}</span>
          <div class="text-xs text-slate-400 w-44 shrink-0">${fmtDate(r.from_date)}${r.from_date !== r.to_date ? ` → ${fmtDate(r.to_date)}` : ""}<span class="ml-2 font-semibold text-slate-300">${r.requested_days}d</span></div>
          <p class="min-w-0 text-xs text-slate-500 italic truncate">${r.reason ? `"${esc(r.reason)}"` : "—"}</p>
          ${stepsHtml}
          <div class="shrink-0">${statusBadgeHtml(r.status)}</div>
          ${
            canAct
              ? `<div class="flex items-center gap-2 shrink-0">
              <button data-approve="${r.id}" ${isActing ? "disabled" : ""} class="approve-btn inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-white px-2.5 py-1 text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition">${isActing && s.actingType === "approve" ? '<span class="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin"></span>' : "✓"} Approve</button>
              <button data-reject="${r.id}" ${isActing ? "disabled" : ""} class="reject-btn inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-white px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition">${isActing && s.actingType === "reject" ? '<span class="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin"></span>' : "✕"} Reject</button>
            </div>`
              : ""
          }
        </div>`;
          })
          .join("") +
        "</div>";
    }

    root.innerHTML = `
      <div class="mt-6 space-y-5">
        <div class="rounded-2xl border border-white/8 bg-slate-900/50 overflow-hidden">
          <div class="px-5 pt-5 pb-4 border-b border-white/5 flex flex-wrap items-start gap-x-8 gap-y-4">
            <div><p class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Leave Type</p><div class="flex flex-wrap gap-2" id="appr-type-chips">${typeChipsHtml(s.fType, counts.cat)}</div></div>
            <div class="h-auto w-px self-stretch bg-white/6 hidden sm:block"></div>
            <div><p class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Status</p><div class="flex flex-wrap gap-2" id="appr-status-chips">${statusChipsHtml(s.fStatus, counts.st)}</div></div>
            <div class="h-auto w-px self-stretch bg-white/6 hidden sm:block"></div>
            <div><p class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Team Member</p>
              <select id="appr-employee-filter" class="rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-violet-500/40 [color-scheme:dark]">
                <option value="all">All Members</option>
                ${teamList.map((t) => `<option value="${t.id}" ${s.fEmployee === String(t.id) ? "selected" : ""}>${esc(t.name)}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="px-5 py-4 flex flex-wrap items-end gap-x-8 gap-y-4">
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Date Range</p>
              <div class="flex items-center gap-2">
                <div class="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 focus-within:border-violet-500/40">${CALENDAR_SVG}<input type="date" id="appr-from" value="${s.fFrom}" class="flex-1 min-w-0 bg-transparent border-none outline-none text-xs text-slate-200 [color-scheme:dark]"></div>
                <span class="text-slate-600 text-sm shrink-0">—</span>
                <div class="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-1.5 focus-within:border-violet-500/40">${CALENDAR_SVG}<input type="date" id="appr-to" value="${s.fTo}" class="flex-1 min-w-0 bg-transparent border-none outline-none text-xs text-slate-200 [color-scheme:dark]"></div>
                ${s.fFrom || s.fTo ? '<button id="appr-clear-dates" class="shrink-0 text-xs text-slate-500 hover:text-rose-400 transition px-2 py-1.5 rounded-lg border border-white/6 hover:border-rose-500/20">Clear</button>' : ""}
              </div>
            </div>
            <div class="h-auto w-px self-stretch bg-white/6 hidden sm:block"></div>
            <div><p class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Duration</p><div class="inline-flex rounded-xl border border-white/10 overflow-hidden" id="appr-duration-seg">${durationSegHtml(s.fDuration)}</div></div>
            ${hasActiveFilter ? '<button id="appr-reset-filters" class="ml-auto self-end text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5 rounded-lg border border-white/6 hover:border-white/15 px-3 py-1.5"><svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>Reset all filters</button>' : ""}
          </div>
        </div>

        <div class="flex items-center justify-between">
          <p class="text-sm text-slate-500">Showing <span class="font-semibold text-slate-200">${filtered.length}</span> of <span class="font-semibold text-slate-200">${s.requests.length}</span> requests</p>
          ${
            hasActiveFilter
              ? `<div class="flex flex-wrap gap-1.5">
              ${s.fType !== "all" ? `<span class="rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[11px] text-violet-400">${CAT_ICON[s.fType]} ${s.fType}</span>` : ""}
              ${s.fStatus !== "pending" ? `<span class="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-slate-300 capitalize">${s.fStatus}</span>` : ""}
              ${s.fDuration !== "all" ? `<span class="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-slate-300">${s.fDuration.replace("_", " ")}</span>` : ""}
              ${s.fEmployee !== "all" ? `<span class="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-slate-300">${esc((teamList.find((t) => String(t.id) === s.fEmployee) || {}).name || "")}</span>` : ""}
              ${s.fFrom || s.fTo ? `<span class="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-slate-300">${s.fFrom || "…"} → ${s.fTo || "…"}</span>` : ""}
            </div>`
              : ""
          }
        </div>

        ${listHtml}
      </div>`;

    root.querySelectorAll(".ftype-btn").forEach((b) => b.addEventListener("click", () => { s.fType = b.dataset.ftype; paintApprovalsTab(); }));
    root.querySelectorAll(".fstatus-btn").forEach((b) => b.addEventListener("click", () => { s.fStatus = b.dataset.fstatus; paintApprovalsTab(); }));
    root.querySelectorAll(".fduration-btn").forEach((b) => b.addEventListener("click", () => { s.fDuration = b.dataset.fduration; paintApprovalsTab(); }));
    const empFilter = document.getElementById("appr-employee-filter");
    if (empFilter) empFilter.addEventListener("change", (e) => { s.fEmployee = e.target.value; paintApprovalsTab(); });
    const fromEl = document.getElementById("appr-from");
    const toEl = document.getElementById("appr-to");
    if (fromEl) fromEl.addEventListener("change", (e) => { s.fFrom = e.target.value; paintApprovalsTab(); });
    if (toEl) toEl.addEventListener("change", (e) => { s.fTo = e.target.value; paintApprovalsTab(); });
    const clearBtn = document.getElementById("appr-clear-dates");
    if (clearBtn) clearBtn.addEventListener("click", () => { s.fFrom = ""; s.fTo = ""; paintApprovalsTab(); });
    const resetBtn = document.getElementById("appr-reset-filters");
    if (resetBtn) resetBtn.addEventListener("click", () => { Object.assign(s, { fType: "all", fStatus: "pending", fDuration: "all", fEmployee: "all", fFrom: "", fTo: "" }); paintApprovalsTab(); });

    root.querySelectorAll(".approve-btn").forEach((b) =>
      b.addEventListener("click", async () => {
        const id = Number(b.dataset.approve);
        s.actingId = id;
        s.actingType = "approve";
        paintApprovalsTab();
        try {
          await apiRequest(`/leave-requests/${id}/approve`, { method: "POST" });
          pushToast("Leave approved", "success");
        } catch (e) {
          pushToast(e.message || "Error", "error");
        }
        s.actingId = null;
        s.actingType = null;
        await renderApprovalsTab();
      })
    );
    root.querySelectorAll(".reject-btn").forEach((b) =>
      b.addEventListener("click", async () => {
        const reason = prompt("Reason for rejection:");
        if (!reason) return;
        const id = Number(b.dataset.reject);
        s.actingId = id;
        s.actingType = "reject";
        paintApprovalsTab();
        try {
          await apiRequest(`/leave-requests/${id}/reject`, { method: "POST", body: JSON.stringify({ rejection_reason: reason }) });
          pushToast("Leave rejected", "success");
        } catch (e) {
          pushToast(e.message || "Error", "error");
        }
        s.actingId = null;
        s.actingType = null;
        await renderApprovalsTab();
      })
    );
  }

  /* ══════════════════════════════════════════════════════════════
     POLICIES TAB
  ══════════════════════════════════════════════════════════════ */
  const DEFAULT_CFG = { days: "0", carryForward: false, encashable: false };
  const polState = {
    editing: null, showForm: false, saving: false, name: "", startDate: "", endDate: "", proRata: false,
    annual: { ...DEFAULT_CFG, days: "21" }, sick: { ...DEFAULT_CFG, days: "10" }, casual: { ...DEFAULT_CFG, days: "10" }, errors: {},
    renewTarget: null, renewName: "", renewStart: "", renewEnd: "", carryForward: true, autoAssign: true, preview: [], loadingPreview: false, renewing: false,
  };

  function typeConfigRowHtml(key, icon, label, colorCls, cfg) {
    return `
      <div class="rounded-xl border border-white/8 bg-white/2 p-4 space-y-3" data-cfg-key="${key}">
        <div class="flex items-center gap-2"><span class="text-lg">${icon}</span><p class="font-semibold text-sm ${colorCls}">${label}</p></div>
        <div><label class="form-label">Days / Year *</label><input type="number" min="0" max="365" required value="${cfg.days}" class="form-input cfg-days" ${polState.saving ? "disabled" : ""}></div>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" class="cfg-carry h-3.5 w-3.5 accent-violet-500" ${cfg.carryForward ? "checked" : ""} ${polState.saving ? "disabled" : ""}><span class="text-xs text-slate-300">Carry Forward</span></label>
          <label class="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" class="cfg-encash h-3.5 w-3.5 accent-violet-500" ${cfg.encashable ? "checked" : ""} ${polState.saving ? "disabled" : ""}><span class="text-xs text-slate-300">Encashable</span></label>
        </div>
      </div>`;
  }

  function renderPoliciesTab() {
    paintPoliciesTab();
  }

  function paintPoliciesTab() {
    const root = document.getElementById("policies-tab-root");
    const s = polState;

    let listHtml;
    if (policies.length === 0) {
      listHtml = '<div class="rounded-xl border border-white/6 bg-white/2 p-10 text-center"><p class="text-3xl mb-2">📋</p><p class="text-slate-400 text-sm">No leave policies yet.</p><button id="pol-open-new-empty" class="mt-3 text-xs text-violet-400 hover:underline">Create first policy →</button></div>';
    } else {
      listHtml =
        '<div class="space-y-3">' +
        policies
          .map((p) => {
            const cs = p.computed_status || "active";
            const cards = [
              ["annual", "🌴", "Annual", "text-violet-300", "border-violet-500/20 bg-violet-500/8"],
              ["sick", "🏥", "Sick", "text-rose-300", "border-rose-500/20 bg-rose-500/8"],
              ["casual", "🎯", "Casual", "text-cyan-300", "border-cyan-500/20 bg-cyan-500/8"],
            ]
              .map(([cat, icon, label, textCls, bgCls]) => {
                const t = (p.leave_types || []).find((x) => x.category === cat);
                return `
              <div class="rounded-lg border px-3 py-2.5 ${bgCls}">
                <p class="text-xs text-slate-500 mb-1">${icon} ${label}</p>
                <p class="text-xl font-black ${textCls}">${t ? t.annual_quota : 0}<span class="text-xs font-normal text-slate-500 ml-1">days</span></p>
                <div class="flex flex-wrap gap-x-2 mt-1">${t && t.carry_forward_enabled ? '<span class="text-[10px] text-violet-400">↩ CF</span>' : ""}${t && t.encashable ? '<span class="text-[10px] text-emerald-400">💵</span>' : ""}</div>
              </div>`;
              })
              .join("");
            return `
          <div class="rounded-xl border border-white/8 bg-white/3 p-5">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="font-semibold text-slate-200">${esc(p.name)}</p>
                  <span class="rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_COLORS[cs] || STATUS_COLORS.active}">${esc(cs.replace("_", " "))}</span>
                  ${p.is_default ? '<span class="rounded-full bg-violet-500/15 border border-violet-500/25 px-2 py-0.5 text-[10px] font-bold text-violet-300">DEFAULT</span>' : ""}
                  ${p.pro_rata ? '<span class="rounded-full bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 text-[10px] font-bold text-amber-300">PRO-RATA</span>' : ""}
                </div>
                ${p.start_date || p.end_date ? `<p class="text-xs text-slate-500 mt-1">${fmtDateOrDash(p.start_date)} — ${fmtDateOrDash(p.end_date)}</p>` : ""}
                ${p.employees_count != null ? `<p class="text-[10px] text-slate-600 mt-0.5">${p.employees_count} employee${p.employees_count !== 1 ? "s" : ""}</p>` : ""}
              </div>
              <div class="flex gap-2 shrink-0">
                ${cs === "expiring_soon" || cs === "expired" ? `<button data-renew="${p.id}" class="pol-renew-btn rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-400 hover:bg-violet-500/20 transition">Renew</button>` : ""}
                <button data-edit="${p.id}" class="pol-edit-btn rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-xs hover:bg-white/8 transition">Edit</button>
                <button data-delete="${p.id}" class="pol-delete-btn rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/15 transition">Delete</button>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3">${cards}</div>
          </div>`;
          })
          .join("") +
        "</div>";
    }

    let formHtml = "";
    if (s.showForm) {
      formHtml = `
        <form id="policy-form" class="rounded-xl border border-white/8 bg-slate-900/60 p-5 h-fit space-y-4">
          <div class="flex items-center justify-between"><h3 class="font-semibold text-white">${s.editing ? "Edit Policy" : "New Policy"}</h3><button type="button" id="pol-form-close" class="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button></div>
          <div><label class="form-label">Policy Name *</label><input id="pol-name" value="${esc(s.name)}" placeholder="e.g. Standard Policy 2026" class="form-input ${s.errors.name ? "!border-rose-500/60" : ""}" ${s.saving ? "disabled" : ""}>${s.errors.name ? `<p class="mt-1 text-xs text-rose-400">${esc(s.errors.name)}</p>` : ""}</div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="form-label">Start Date</label><input type="date" id="pol-start" value="${s.startDate}" class="form-input [color-scheme:dark]" ${s.saving ? "disabled" : ""}></div>
            <div><label class="form-label">End Date</label><input type="date" id="pol-end" value="${s.endDate}" class="form-input [color-scheme:dark]" ${s.saving ? "disabled" : ""}></div>
          </div>
          <label class="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-amber-500/20 bg-amber-500/6 p-3">
            <input type="checkbox" id="pol-prorata" ${s.proRata ? "checked" : ""} class="mt-0.5 h-4 w-4 accent-amber-500" ${s.saving ? "disabled" : ""}>
            <div><p class="text-sm font-semibold text-amber-300">Pro-Rata Allocation</p><p class="text-xs text-slate-400 mt-0.5">Quotas allocated proportionally based on hire date.</p></div>
          </label>
          <div class="border-t border-white/5 pt-2 space-y-3">
            ${typeConfigRowHtml("annual", "🌴", "Annual Leave", "text-violet-400", s.annual)}
            ${typeConfigRowHtml("sick", "🏥", "Sick Leave", "text-rose-400", s.sick)}
            ${typeConfigRowHtml("casual", "🎯", "Casual Leave", "text-cyan-400", s.casual)}
          </div>
          <button type="submit" ${s.saving ? "disabled" : ""} class="w-full btn-primary disabled:opacity-50"><span>${s.saving ? "Saving…" : s.editing ? "Update Policy" : "Create Policy"}</span></button>
        </form>`;
    } else if (s.renewTarget) {
      formHtml = `
        <div class="rounded-xl border border-violet-500/20 bg-slate-900/80 p-5 h-fit space-y-4">
          <div class="flex items-center justify-between"><h3 class="font-semibold text-white">Renew: ${esc(s.renewTarget.name)}</h3><button type="button" id="renew-close" class="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button></div>
          <div><label class="form-label">New Policy Name *</label><input id="renew-name" value="${esc(s.renewName)}" class="form-input"></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="form-label">Start Date *</label><input type="date" id="renew-start" value="${s.renewStart}" class="form-input [color-scheme:dark]"></div>
            <div><label class="form-label">End Date *</label><input type="date" id="renew-end" value="${s.renewEnd}" class="form-input [color-scheme:dark]"></div>
          </div>
          <label class="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-emerald-500/20 bg-emerald-500/6 p-3">
            <input type="checkbox" id="renew-carry" ${s.carryForward ? "checked" : ""} class="mt-0.5 h-4 w-4 accent-emerald-500">
            <div><p class="text-sm font-semibold text-emerald-300">Carry Forward Balances</p><p class="text-xs text-slate-400 mt-0.5">Add remaining leave from ${esc(s.renewTarget.name)} to the new policy.</p></div>
          </label>
          ${
            s.carryForward
              ? `<div class="rounded-lg border border-white/6 bg-white/2 overflow-hidden">
              <div class="px-3 py-2 border-b border-white/5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Carry-Forward Preview</div>
              ${
                s.loadingPreview
                  ? '<div class="flex justify-center py-4"><div class="h-5 w-5 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin"></div></div>'
                  : s.preview.length === 0
                  ? '<p class="px-3 py-3 text-xs text-slate-500">No balances to carry forward.</p>'
                  : `<div class="divide-y divide-white/4">${s.preview
                      .map(
                        (row) => `
                    <div class="px-3 py-2">
                      <p class="text-xs font-medium text-slate-200">${esc(row.full_name)} <span class="text-slate-600 font-mono">${esc(row.employee_code)}</span></p>
                      <div class="flex gap-3 mt-1">${row.balances.map((b) => `<span class="text-[10px] text-emerald-400">${esc(b.name)}: +${b.carry_forward_days}d <span class="text-slate-600">(${b.remaining} remaining)</span></span>`).join("")}</div>
                    </div>`
                      )
                      .join("")}</div>`
              }
            </div>`
              : ""
          }
          <label class="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-cyan-500/20 bg-cyan-500/6 p-3">
            <input type="checkbox" id="renew-autoassign" ${s.autoAssign ? "checked" : ""} class="mt-0.5 h-4 w-4 accent-cyan-500">
            <div><p class="text-sm font-semibold text-cyan-300">Auto-Assign Employees</p><p class="text-xs text-slate-400 mt-0.5">Move all employees from ${esc(s.renewTarget.name)} to the new policy.</p></div>
          </label>
          <button id="renew-submit" ${s.renewing || !s.renewName.trim() || !s.renewStart || !s.renewEnd ? "disabled" : ""} class="w-full btn-primary disabled:opacity-50"><span>${s.renewing ? "Renewing…" : "Renew Policy"}</span></button>
        </div>`;
    }

    root.innerHTML = `
      <div class="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <div>
          <div class="flex items-center justify-between mb-4"><h2 class="font-semibold text-slate-200">Leave Policies</h2><button id="pol-open-new" class="btn-primary rounded-xl px-4 py-2 text-sm"><span>+ New Policy</span></button></div>
          ${listHtml}
        </div>
        ${formHtml}
      </div>`;

    function openNew() {
      Object.assign(s, {
        editing: null, name: "", startDate: "", endDate: "", proRata: false,
        annual: { ...DEFAULT_CFG, days: "21" }, sick: { ...DEFAULT_CFG, days: "10" }, casual: { ...DEFAULT_CFG, days: "10" },
        errors: {}, showForm: true, renewTarget: null,
      });
      paintPoliciesTab();
    }
    const openNewBtn = document.getElementById("pol-open-new");
    if (openNewBtn) openNewBtn.addEventListener("click", openNew);
    const openNewEmptyBtn = document.getElementById("pol-open-new-empty");
    if (openNewEmptyBtn) openNewEmptyBtn.addEventListener("click", openNew);
    const formClose = document.getElementById("pol-form-close");
    if (formClose) formClose.addEventListener("click", () => { s.showForm = false; paintPoliciesTab(); });

    root.querySelectorAll(".pol-edit-btn").forEach((b) =>
      b.addEventListener("click", () => {
        const p = policies.find((x) => x.id === Number(b.dataset.edit));
        if (!p) return;
        s.editing = p;
        s.name = p.name;
        s.proRata = p.pro_rata || false;
        s.startDate = (p.start_date || "").split("T")[0] || "";
        s.endDate = (p.end_date || "").split("T")[0] || "";
        const fromType = (cat) => {
          const t = (p.leave_types || []).find((x) => x.category === cat);
          if (!t) return { ...DEFAULT_CFG };
          return { days: String(t.annual_quota), carryForward: t.carry_forward_enabled, encashable: t.encashable };
        };
        s.annual = fromType("annual");
        s.sick = fromType("sick");
        s.casual = fromType("casual");
        s.errors = {};
        s.showForm = true;
        s.renewTarget = null;
        paintPoliciesTab();
      })
    );
    root.querySelectorAll(".pol-delete-btn").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Delete this policy?")) return;
        try {
          await apiRequest(`/leave-policies/${b.dataset.delete}`, { method: "DELETE" });
          pushToast("Policy deleted", "success");
          await loadPolicies();
          paintPoliciesTab();
        } catch (e) {
          pushToast(e.message || "Error", "error");
        }
      })
    );
    root.querySelectorAll(".pol-renew-btn").forEach((b) =>
      b.addEventListener("click", async () => {
        const p = policies.find((x) => x.id === Number(b.dataset.renew));
        if (!p) return;
        s.renewTarget = p;
        s.showForm = false;
        const nextYear = p.end_date ? new Date(p.end_date).getFullYear() + 1 : new Date().getFullYear() + 1;
        s.renewName = `${p.name.replace(/\d{4}/, "")}${nextYear}`.trim();
        s.renewStart = `${nextYear}-01-01`;
        s.renewEnd = `${nextYear}-12-31`;
        s.carryForward = true;
        s.autoAssign = true;
        s.preview = [];
        s.loadingPreview = true;
        paintPoliciesTab();
        try {
          const r = await apiRequest(`/leave-policies/${p.id}/carry-forward-preview`);
          s.preview = unwrapData(r) || [];
        } catch (e) {}
        s.loadingPreview = false;
        paintPoliciesTab();
      })
    );

    // form field wiring
    if (s.showForm) {
      document.getElementById("pol-name").addEventListener("input", (e) => {
        s.name = e.target.value;
        if (s.errors.name) s.errors.name = "";
      });
      document.getElementById("pol-start").addEventListener("change", (e) => (s.startDate = e.target.value));
      document.getElementById("pol-end").addEventListener("change", (e) => (s.endDate = e.target.value));
      document.getElementById("pol-prorata").addEventListener("change", (e) => (s.proRata = e.target.checked));
      root.querySelectorAll("[data-cfg-key]").forEach((rowEl) => {
        const key = rowEl.dataset.cfgKey;
        rowEl.querySelector(".cfg-days").addEventListener("input", (e) => (s[key].days = e.target.value));
        rowEl.querySelector(".cfg-carry").addEventListener("change", (e) => (s[key].carryForward = e.target.checked));
        rowEl.querySelector(".cfg-encash").addEventListener("change", (e) => (s[key].encashable = e.target.checked));
      });
      document.getElementById("policy-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!s.name.trim()) {
          s.errors = { name: "Policy name is required" };
          paintPoliciesTab();
          return;
        }
        s.errors = {};
        s.saving = true;
        paintPoliciesTab();
        try {
          const payload = { name: s.name, pro_rata: s.proRata };
          if (s.startDate) payload.start_date = s.startDate;
          if (s.endDate) payload.end_date = s.endDate;
          let policyId;
          if (s.editing) {
            await apiRequest(`/leave-policies/${s.editing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
            policyId = s.editing.id;
            await saveType(policyId, "annual", "Annual Leave", s.annual, (s.editing.leave_types || []).find((t) => t.category === "annual"));
            await saveType(policyId, "sick", "Sick Leave", s.sick, (s.editing.leave_types || []).find((t) => t.category === "sick"));
            await saveType(policyId, "casual", "Casual Leave", s.casual, (s.editing.leave_types || []).find((t) => t.category === "casual"));
            pushToast("Policy updated", "success");
          } else {
            const res = await apiRequest("/leave-policies", { method: "POST", body: JSON.stringify(payload) });
            policyId = unwrapData(res).id;
            await saveType(policyId, "annual", "Annual Leave", s.annual);
            await saveType(policyId, "sick", "Sick Leave", s.sick);
            await saveType(policyId, "casual", "Casual Leave", s.casual);
            pushToast("Policy created", "success");
          }
          s.showForm = false;
          await loadTypes();
          await loadPolicies();
          paintPoliciesTab();
        } catch (err) {
          pushToast(err.message || "Error", "error");
        } finally {
          s.saving = false;
          paintPoliciesTab();
        }
      });
    }

    if (s.renewTarget) {
      document.getElementById("renew-close").addEventListener("click", () => { s.renewTarget = null; paintPoliciesTab(); });
      document.getElementById("renew-name").addEventListener("input", (e) => { s.renewName = e.target.value; refreshRenewBtn(); });
      document.getElementById("renew-start").addEventListener("change", (e) => { s.renewStart = e.target.value; refreshRenewBtn(); });
      document.getElementById("renew-end").addEventListener("change", (e) => { s.renewEnd = e.target.value; refreshRenewBtn(); });
      document.getElementById("renew-carry").addEventListener("change", (e) => { s.carryForward = e.target.checked; paintPoliciesTab(); });
      document.getElementById("renew-autoassign").addEventListener("change", (e) => (s.autoAssign = e.target.checked));
      function refreshRenewBtn() {
        const btn = document.getElementById("renew-submit");
        if (btn) btn.disabled = s.renewing || !s.renewName.trim() || !s.renewStart || !s.renewEnd;
      }
      document.getElementById("renew-submit").addEventListener("click", async () => {
        if (!s.renewTarget || !s.renewName.trim() || !s.renewStart || !s.renewEnd) return;
        s.renewing = true;
        paintPoliciesTab();
        try {
          const r = await apiRequest(`/leave-policies/${s.renewTarget.id}/renew`, {
            method: "POST",
            body: JSON.stringify({ name: s.renewName, start_date: s.renewStart, end_date: s.renewEnd, carry_forward: s.carryForward, auto_assign: s.autoAssign }),
          });
          pushToast("Policy renewed successfully", "success");
          s.renewTarget = null;
          await loadTypes();
          await loadPolicies();
          paintPoliciesTab();
        } catch (e) {
          pushToast(e.message || "Error", "error");
        } finally {
          s.renewing = false;
        }
      });
    }
  }

  async function saveType(policyId, cat, label, cfg, existing) {
    const payload = { name: label, category: cat, annual_quota: Number(cfg.days), carry_forward_enabled: cfg.carryForward, encashable: cfg.encashable, leave_policy_id: policyId, affects_balance: true, negative_balance_allowed: false };
    if (existing) await apiRequest(`/leave-types/${existing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    else await apiRequest("/leave-types", { method: "POST", body: JSON.stringify(payload) });
  }

  /* ══════════════════════════════════════════════════════════════
     BALANCES TAB
  ══════════════════════════════════════════════════════════════ */
  const balState = { empId: "", balances: [], loading: false };

  function renderBalancesTab() {
    paintBalancesTab();
    const opts = employees.map((e) => ({ value: String(e.id), label: e.full_name, sub: e.employee_code }));
    setTimeout(() => {
      const ss = searchSelect("ss-leave-balance-employee");
      if (ss) ss.setOptions(opts);
    }, 0);
  }

  function paintBalancesTab() {
    const root = document.getElementById("balances-tab-root");
    const s = balState;
    const year = new Date().getFullYear();
    const emp = employees.find((e) => String(e.id) === s.empId);

    let resultsHtml = "";
    if (emp && s.balances.length > 0) {
      resultsHtml = `
        <p class="text-sm text-slate-400 mb-4">Balances for <span class="font-semibold text-white">${esc(emp.full_name)}</span> — ${year}</p>
        <div class="grid gap-4 sm:grid-cols-3">
          ${s.balances
            .map((b) => {
              const cat = b.category || "";
              const allocated = b.allocated != null ? b.allocated : b.annual_quota;
              const usedPct = allocated > 0 ? Math.min(100, Math.round((b.used / allocated) * 100)) : 0;
              return `
            <div class="rounded-xl border border-white/6 bg-white/2 p-5">
              <div class="flex items-center gap-2 mb-3"><span class="text-xl">${CAT_ICON[cat] || "📋"}</span><p class="font-semibold ${CAT_COLOR[cat] || "text-slate-200"}">${esc(b.name)}</p></div>
              <div class="grid grid-cols-3 gap-2 mb-3 text-center">
                <div><p class="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Allocated</p><p class="text-base font-bold text-slate-200">${allocated}</p></div>
                <div><p class="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Used</p><p class="text-base font-bold text-rose-400">${b.used}</p></div>
                <div><p class="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Pending</p><p class="text-base font-bold text-amber-400">${b.pending || 0}</p></div>
              </div>
              <div class="h-1.5 rounded-full bg-white/6 overflow-hidden mb-3"><div class="h-1.5 rounded-full bg-violet-500 transition-all" style="width:${usedPct}%"></div></div>
              <p class="text-2xl font-black text-emerald-400">${b.remaining}d <span class="text-sm font-normal text-slate-500">remaining</span></p>
            </div>`;
            })
            .join("")}
        </div>`;
    } else if (s.empId && !s.loading && s.balances.length === 0) {
      resultsHtml = '<p class="text-sm text-slate-500">Click "Load Balances" to view leave balances for this employee.</p>';
    }

    root.innerHTML = `
      <div class="mt-6">
        <div class="flex items-end gap-3 mb-6">
          <div class="w-72"><label class="form-label">Select Employee</label>${document.getElementById("ss-leave-balance-employee") ? "" : ""}<div id="balance-search-select-mount"></div></div>
          <button id="bal-load-btn" ${!s.empId || s.loading ? "disabled" : ""} class="btn-primary rounded-xl px-5 py-2.5 text-sm disabled:opacity-40"><span>${s.loading ? "Loading…" : `Load ${year} Balances`}</span></button>
        </div>
        ${resultsHtml}
      </div>`;

    const mount = document.getElementById("balance-search-select-mount");
    if (mount && !document.getElementById("ss-leave-balance-employee")) {
      mount.outerHTML = `<div id="ss-leave-balance-employee" class="js-search-select relative" data-placeholder="Search employee…">
        <script type="application/json" class="js-ss-options">[]</script>
        <input type="hidden" name="balance_employee_id" class="js-ss-input" value="">
        <button type="button" class="form-input flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-sm transition focus:outline-none js-ss-trigger">
          <span class="flex flex-col items-start js-ss-trigger-label"><span>Search employee…</span></span>
          <svg class="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 js-ss-chevron" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div class="dropdown-panel absolute z-50 mt-1.5 w-full min-w-[200px] rounded-xl overflow-hidden js-ss-panel" style="box-shadow:0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)" hidden>
          <div class="p-2 border-b border-b-black/5 dark:border-b-white/8">
            <div class="relative">
              <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" class="js-ss-search w-full rounded-lg border border-white/10 bg-white/5 py-1.5 pr-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-violet-500/40 dark-search-input" style="padding-left:28px" placeholder="Search…">
            </div>
          </div>
          <ul class="js-ss-list max-h-52 overflow-y-auto py-1"></ul>
        </div>
      </div>`;
      window.reinitSearchSelects(document.getElementById("balances-tab-root"));
      const ssEl = document.getElementById("ss-leave-balance-employee");
      ssEl.addEventListener("change", (e) => {
        s.empId = e.target.value;
        s.balances = [];
        paintBalancesTab();
      }, true);
      const opts = employees.map((e) => ({ value: String(e.id), label: e.full_name, sub: e.employee_code }));
      const ss = searchSelect("ss-leave-balance-employee");
      if (ss) ss.setOptions(opts);
      if (s.empId) ss.setValue(s.empId);
    }

    const loadBtn = document.getElementById("bal-load-btn");
    if (loadBtn)
      loadBtn.addEventListener("click", async () => {
        if (!s.empId) return;
        s.loading = true;
        paintBalancesTab();
        try {
          const r = await apiRequest(`/leave-types/balances?employee_id=${s.empId}&year=${year}`);
          s.balances = unwrapData(r) || [];
        } catch (e) {
          s.balances = [];
        }
        s.loading = false;
        paintBalancesTab();
      });
  }

  /* ══════════════════════════════════════════════════════════════
     REPORT TAB
  ══════════════════════════════════════════════════════════════ */
  const repState = { rows: [], loading: false, year: new Date().getFullYear(), loaded: false };
  const REPORT_CATS = [
    { cat: "annual", icon: "🌴", color: "text-violet-300" },
    { cat: "sick", icon: "🏥", color: "text-rose-300" },
    { cat: "casual", icon: "🎯", color: "text-cyan-300" },
  ];

  function renderReportTab() {
    paintReportTab();
  }

  function paintReportTab() {
    const root = document.getElementById("report-tab-root");
    const s = repState;

    let tableHtml = "";
    if (s.loaded && s.rows.length === 0) {
      tableHtml = '<div class="rounded-xl border border-white/6 bg-white/2 p-10 text-center"><p class="text-slate-400 text-sm">No active employees found.</p></div>';
    } else if (s.loaded && s.rows.length > 0) {
      tableHtml = `
        <div class="overflow-x-auto rounded-2xl border border-white/7">
          <table class="data-table min-w-[900px]">
            <thead>
              <tr>
                <th>Employee</th><th>Department</th><th>Policy</th>
                ${REPORT_CATS.map((c) => `<th colspan="4" class="text-center"><span class="${c.color}">${c.icon} ${c.cat.charAt(0).toUpperCase() + c.cat.slice(1)}</span></th>`).join("")}
              </tr>
              <tr class="text-[10px] text-slate-500 uppercase">
                <th></th><th></th><th></th>
                ${REPORT_CATS.map(() => '<th class="text-right">Alloc</th><th class="text-right">Used</th><th class="text-right">Pending</th><th class="text-right">Left</th>').join("")}
              </tr>
            </thead>
            <tbody>
              ${s.rows
                .map(
                  (row) => `
                <tr>
                  <td><p class="font-medium text-slate-200">${esc(row.full_name)}</p><p class="text-xs text-slate-500">${esc(row.employee_code)}</p></td>
                  <td class="text-slate-400">${esc(row.department || "—")}</td>
                  <td class="text-slate-400 text-xs">${esc(row.policy_name || "—")}</td>
                  ${REPORT_CATS.map((c) => {
                    const b = (row.balances || []).find((x) => x.category === c.cat);
                    return b
                      ? `<td class="text-right text-slate-300">${b.allocated}</td><td class="text-right text-rose-400">${b.used}</td><td class="text-right text-amber-400">${b.pending}</td><td class="text-right text-emerald-400 font-semibold">${b.remaining}</td>`
                      : '<td class="text-right text-slate-600">—</td><td class="text-right text-slate-600">—</td><td class="text-right text-slate-600">—</td><td class="text-right text-slate-600">—</td>';
                  }).join("")}
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
    }

    root.innerHTML = `
      <div class="mt-6">
        <div class="flex items-end gap-3 mb-6">
          <div><label class="form-label">Year</label><input type="number" id="report-year" value="${s.year}" min="2020" max="2100" class="form-input w-28"></div>
          <button id="report-generate-btn" ${s.loading ? "disabled" : ""} class="btn-primary rounded-xl px-5 py-2.5 text-sm disabled:opacity-40"><span>${s.loading ? "Loading…" : "Generate Report"}</span></button>
        </div>
        ${tableHtml}
      </div>`;

    document.getElementById("report-year").addEventListener("input", (e) => (s.year = Number(e.target.value)));
    document.getElementById("report-generate-btn").addEventListener("click", async () => {
      s.loading = true;
      paintReportTab();
      try {
        const r = await apiRequest(`/leave-reports/balances?year=${s.year}`);
        s.rows = unwrapData(r) || [];
        s.loaded = true;
      } catch (e) {
        s.rows = [];
        s.loaded = true;
      }
      s.loading = false;
      paintReportTab();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════════ */
  document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("leave-subtitle").textContent = PRIVILEGED ? "Manage leave requests, approvals, and policies." : "Track your leave requests and apply for time off.";

    await loadTypes();
    if (ADMIN || MANAGER) {
      await Promise.all([loadPolicies(), loadEmployees()]);
    }

    document.getElementById("leave-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn) switchTab(btn.dataset.tab);
    });

    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get("tab") || "requests";
    const validTabs = Array.from(document.querySelectorAll("#leave-tab-bar .tab-btn")).map((b) => b.dataset.tab);
    switchTab(validTabs.includes(initialTab) ? initialTab : "requests");
  });
})();
