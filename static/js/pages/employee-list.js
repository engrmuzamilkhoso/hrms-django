/**
 * Port of saas-hrms-frontend/app/dashboard/employees/page.tsx. Same
 * behavior: fetch via apiRequest against the preserved /api/v1/employees
 * and /api/v1/organizations/me endpoints, client-side search/pagination,
 * trial-limit banner + paywall modal.
 */
(function () {
  const STATUS_BADGE = { active: "badge-green", inactive: "badge-slate", on_leave: "badge-amber", terminated: "badge-red" };
  const PLAN_LABEL = {
    trial: { label: "Trial", cls: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
    beta_free: { label: "Trial", cls: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
    free: { label: "Free", cls: "border-slate-600/30 bg-slate-700/30 text-slate-400" },
    starter: { label: "Starter", cls: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
    growth: { label: "Growth", cls: "border-violet-500/30 bg-violet-500/10 text-violet-300" },
    enterprise: { label: "Enterprise", cls: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  };

  const state = { employees: [], search: "", currentPage: 1, totalPages: 1, total: 0, org: null };

  const el = {
    root: document.getElementById("employees-root"),
    planBadge: document.getElementById("plan-badge"),
    subtitle: document.getElementById("employees-subtitle"),
    limitBanner: document.getElementById("limit-banner"),
    searchInput: document.getElementById("search-input"),
    searchForm: document.getElementById("search-form"),
    errorBox: document.getElementById("error-box"),
    loading: document.getElementById("loading-spinner"),
    emptyState: document.getElementById("empty-state"),
    tableWrap: document.getElementById("table-wrap"),
    tbody: document.getElementById("employees-tbody"),
    pagination: document.getElementById("pagination"),
    pageLabel: document.getElementById("page-label"),
    prevBtn: document.getElementById("prev-btn"),
    nextBtn: document.getElementById("next-btn"),
    addBtn: document.getElementById("add-employee-btn"),
    addBtnBadge: document.getElementById("add-btn-badge"),
    paywall: document.getElementById("paywall-modal"),
    paywallLimit: document.getElementById("paywall-limit"),
  };

  function limitReached() {
    return state.org && state.org.trial_user_limit != null && state.total >= state.org.trial_user_limit;
  }
  function limitNearing() {
    return (
      state.org &&
      state.org.trial_user_limit != null &&
      !limitReached() &&
      state.total >= state.org.trial_user_limit * 0.8
    );
  }

  function renderHeader() {
    if (state.org) {
      const meta = PLAN_LABEL[state.org.plan_code] || PLAN_LABEL.trial;
      el.planBadge.hidden = false;
      el.planBadge.className = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`;
      el.planBadge.textContent = `${meta.label} Plan`;
    }
    let subtitle = state.total > 0 ? `${state.total} total employees` : "Manage your workforce";
    el.subtitle.textContent = subtitle;
    if (state.org && state.org.trial_user_limit != null) {
      const span = document.createElement("span");
      span.className = `ml-2 font-medium ${limitReached() ? "text-rose-400" : limitNearing() ? "text-amber-400" : "text-slate-500"}`;
      span.textContent = `· ${state.total}/${state.org.trial_user_limit} trial limit`;
      el.subtitle.appendChild(span);
    }
    if (state.org && state.org.trial_user_limit != null) {
      el.addBtnBadge.hidden = false;
      el.addBtnBadge.textContent = `${state.total}/${state.org.trial_user_limit}`;
    }

    el.limitBanner.innerHTML = "";
    if (limitReached() || limitNearing()) {
      const reached = limitReached();
      el.limitBanner.hidden = false;
      el.limitBanner.className = `mb-6 rounded-2xl border px-5 py-4 flex items-center justify-between gap-4 ${reached ? "border-rose-500/30 bg-rose-500/8" : "border-amber-500/30 bg-amber-500/8"}`;
      const remaining = state.org.trial_user_limit - state.total;
      el.limitBanner.innerHTML = `
        <div class="flex items-center gap-3">
          <svg class="h-5 w-5 shrink-0 ${reached ? "text-rose-400" : "text-amber-400"}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div>
            <p class="text-sm font-semibold ${reached ? "text-rose-300" : "text-amber-300"}">${reached ? `Trial limit reached — ${state.total}/${state.org.trial_user_limit} employees` : `Approaching trial limit — ${state.total}/${state.org.trial_user_limit} employees used`}</p>
            <p class="text-xs text-slate-500 mt-0.5">${reached ? "You cannot add more employees on the trial plan. Upgrade to continue growing your team." : `Only ${remaining} more employee${remaining === 1 ? "" : "s"} available on your trial plan.`}</p>
          </div>
        </div>
        ${reached ? '<button id="upgrade-btn" class="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition">Upgrade Plan</button>' : ""}
      `;
      const upgradeBtn = document.getElementById("upgrade-btn");
      if (upgradeBtn) upgradeBtn.addEventListener("click", () => showPaywall());
    } else {
      el.limitBanner.hidden = true;
    }
  }

  function showPaywall() {
    if (state.org) el.paywallLimit.textContent = state.org.trial_user_limit;
    el.paywall.hidden = false;
  }
  function hidePaywall() {
    el.paywall.hidden = true;
  }

  function renderRows() {
    el.tbody.innerHTML = "";
    state.employees.forEach((emp) => {
      const tr = document.createElement("tr");
      const badgeClass = STATUS_BADGE[emp.employment_status] || "badge-slate";
      const status = (emp.employment_status || "active").replace("_", " ");
      tr.innerHTML = `
        <td class="font-mono text-xs text-violet-400">${escapeHtml(emp.employee_code)}</td>
        <td class="font-medium text-white">${escapeHtml(emp.full_name)}</td>
        <td class="text-slate-400">${escapeHtml(emp.email)}</td>
        <td>${emp.designation ? escapeHtml(emp.designation) : '<span class="text-slate-600">—</span>'}</td>
        <td>${emp.department && emp.department.name ? escapeHtml(emp.department.name) : '<span class="text-slate-600">—</span>'}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(status)}</span></td>
        <td class="text-slate-400 text-xs">${escapeHtml(emp.hire_date || "")}</td>
        <td><a href="/dashboard/employees/${emp.id}/" class="rounded px-3 py-1 text-xs border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition">View</a></td>
      `;
      el.tbody.appendChild(tr);
    });
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  async function load(page, q) {
    el.loading.hidden = false;
    el.tableWrap.hidden = true;
    el.emptyState.hidden = true;
    el.errorBox.hidden = true;
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (q) params.set("search", q);
      const r = await apiRequest(`/employees?${params}`);
      const d = unwrapData(r);
      state.employees = d.data || [];
      state.currentPage = d.current_page || 1;
      state.totalPages = d.last_page || 1;
      state.total = d.total || 0;
    } catch (err) {
      el.errorBox.hidden = false;
      el.errorBox.textContent = err.message || "Failed to load employees";
    } finally {
      el.loading.hidden = true;
      renderHeader();
      if (state.employees.length === 0) {
        el.emptyState.hidden = false;
      } else {
        el.tableWrap.hidden = false;
        renderRows();
        el.pagination.hidden = state.totalPages <= 1;
        el.pageLabel.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
        el.prevBtn.disabled = state.currentPage === 1;
        el.nextBtn.disabled = state.currentPage === state.totalPages;
      }
    }
  }

  function handleAddEmployee() {
    if (limitReached()) {
      showPaywall();
      return;
    }
    window.location.href = "/dashboard/employees/create/";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("limit_reached") === "1") showPaywall();

    load(1, "");
    apiRequest("/organizations/me")
      .then((r) => {
        const d = unwrapData(r);
        state.org = {
          plan_code: d.plan_code || "trial",
          trial_user_limit: d.trial_user_limit != null ? Number(d.trial_user_limit) : null,
          status: d.status || "active",
        };
        renderHeader();
      })
      .catch(() => {});

    el.searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      state.search = el.searchInput.value;
      load(1, state.search);
    });
    el.prevBtn.addEventListener("click", () => load(Math.max(1, state.currentPage - 1), state.search));
    el.nextBtn.addEventListener("click", () => load(Math.min(state.totalPages, state.currentPage + 1), state.search));
    el.addBtn.addEventListener("click", handleAddEmployee);
    document.getElementById("empty-add-btn")?.addEventListener("click", handleAddEmployee);
    document.getElementById("paywall-backdrop")?.addEventListener("click", hidePaywall);
    document.getElementById("paywall-later-btn")?.addEventListener("click", hidePaywall);
    document.getElementById("paywall-contact-btn")?.addEventListener("click", () => {
      hidePaywall();
      window.open("mailto:billing@workforce-hrms.com?subject=Plan Upgrade Request", "_blank");
    });
  });
})();
