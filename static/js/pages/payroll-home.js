(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  const fmt = (n) => (n != null ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");
  const STATUS_BADGE = { draft: "bg-slate-700 text-slate-300", calculated: "bg-blue-500/20 text-blue-300", locked: "bg-amber-500/20 text-amber-300", approved: "bg-emerald-500/20 text-emerald-300" };
  const EXPENSE_BADGE = { approved: "badge-green", pending: "badge-amber", rejected: "badge-red" };

  function switchTab(tab) {
    document.querySelectorAll("#pr-tab-bar .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }

  // ── Payroll Runs ─────────────────────────────────────────────────────────
  async function loadRuns() {
    const list = document.getElementById("runs-list");
    try {
      const r = await apiRequest("/payroll-runs");
      const runs = unwrapData(r)?.data || [];
      if (runs.length === 0) {
        list.innerHTML = '<p class="text-sm text-slate-500">No payroll runs yet.</p>';
        return;
      }
      list.innerHTML = "";
      runs.forEach((run) => {
        const div = document.createElement("div");
        div.className = "rounded-xl border border-white/8 bg-white/3 p-5";
        let actions = "";
        if (run.status === "draft") actions += `<button data-id="${run.id}" data-action="calculate" class="run-action-btn rounded border border-white/10 px-3 py-1 text-xs hover:border-cyan-500 transition">Calculate</button>`;
        if (run.status === "calculated") actions += `<button data-id="${run.id}" data-action="lock" class="run-action-btn rounded border border-white/10 px-3 py-1 text-xs hover:border-amber-500 transition">Lock</button>`;
        if (run.status === "locked") actions += `<button data-id="${run.id}" data-action="approve" class="run-action-btn rounded bg-emerald-600/30 border border-emerald-600/50 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-600/50 transition">Approve</button>`;
        div.innerHTML = `
          <div class="flex items-start justify-between">
            <div>
              <span class="font-medium">Run #${run.id}</span>
              <span class="ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[run.status] || "bg-slate-700 text-slate-300"}">${esc(run.status)}</span>
              <div class="mt-1 text-sm text-slate-400">${run.period_start} → ${run.period_end}</div>
            </div>
            <div class="text-right text-sm">
              <div class="text-slate-400">Gross: <span class="text-white">${fmt(run.total_gross)}</span></div>
              <div class="text-slate-400">Net: <span class="text-emerald-300 font-semibold">${fmt(run.total_net)}</span></div>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            ${actions}
            <a href="/api/v1/payroll-runs/${run.id}/bank-export" class="rounded border border-white/10 px-3 py-1 text-xs hover:border-white/30 transition">Bank Export CSV</a>
            <div class="flex items-center gap-1">
              <input placeholder="Emp ID" class="payslip-emp-input w-20 rounded border border-white/10 bg-transparent px-2 py-1 text-xs">
              <button data-run-id="${run.id}" class="payslip-btn rounded border border-white/10 px-3 py-1 text-xs hover:border-white/30 transition">Payslip</button>
            </div>
          </div>`;
        list.appendChild(div);
      });

      list.querySelectorAll(".run-action-btn").forEach((btn) =>
        btn.addEventListener("click", async () => {
          try {
            await apiRequest(`/payroll-runs/${btn.dataset.id}/${btn.dataset.action}`, { method: "POST" });
            pushToast(`Payroll ${btn.dataset.action} done`, "success");
            loadRuns();
          } catch (err) {
            pushToast(err.message || "Error", "error");
          }
        })
      );
      list.querySelectorAll(".payslip-btn").forEach((btn) =>
        btn.addEventListener("click", () => {
          const input = btn.parentElement.querySelector(".payslip-emp-input");
          const empId = input.value.trim();
          if (!empId) {
            pushToast("Enter employee ID", "info");
            return;
          }
          window.open(`/api/v1/payroll-runs/${btn.dataset.runId}/payslip/${empId}`, "_blank");
          pushToast("Payslip download started", "success");
        })
      );
    } catch (err) {
      list.innerHTML = `<p class="text-sm text-red-400">${esc(err.message || "Failed to load")}</p>`;
    }
  }

  document.getElementById("run-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = document.getElementById("run-save-btn");
    btn.disabled = true;
    try {
      await apiRequest("/payroll-runs", { method: "POST", body: JSON.stringify({ period_start: fd.get("period_start"), period_end: fd.get("period_end") }) });
      pushToast("Payroll run created", "success");
      e.target.reset();
      loadRuns();
    } catch (err) {
      pushToast(err.message || "Error", "error");
    } finally {
      btn.disabled = false;
    }
  });

  // ── Salary Structures / Components ──────────────────────────────────────
  let structures = [];

  async function loadStructures() {
    try {
      const [s, c] = await Promise.all([apiRequest("/salary-structures"), apiRequest("/salary-components")]);
      structures = unwrapData(s)?.data || [];
      const components = unwrapData(c)?.data || [];
      renderStructures();
      renderComponents(components);
    } catch (err) {
      /* silent, matches original */
    }
  }

  function renderStructures() {
    const list = document.getElementById("structures-list");
    list.innerHTML = structures.length === 0 ? "" : "";
    structures.forEach((s) => {
      const div = document.createElement("div");
      div.className = "rounded border border-white/8 px-3 py-2 text-sm";
      div.textContent = s.name;
      list.appendChild(div);
    });
    const select = document.getElementById("component-structure-select");
    const currentVal = select.value;
    select.innerHTML = '<option value="">Select structure</option>' + structures.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
    select.value = currentVal;
  }

  function renderComponents(components) {
    const list = document.getElementById("components-list");
    if (components.length === 0) {
      list.innerHTML = "";
      return;
    }
    list.innerHTML = "";
    components.forEach((c) => {
      const div = document.createElement("div");
      div.className = "flex items-center justify-between rounded border border-white/8 px-3 py-1.5 text-xs gap-2";
      div.innerHTML = `
        <span>${esc(c.component_name)}</span>
        <span class="rounded-full px-2 py-0.5 ${c.component_type === "earning" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}">${esc(c.component_type)}</span>
        <span class="text-slate-400">${esc(c.calc_method)} · ${c.default_amount ?? "—"}</span>`;
      list.appendChild(div);
    });
  }

  document.getElementById("structure-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = document.getElementById("structure-save-btn");
    btn.disabled = true;
    try {
      await apiRequest("/salary-structures", { method: "POST", body: JSON.stringify({ name: fd.get("name"), effective_from: fd.get("effective_from") }) });
      pushToast("Structure created", "success");
      e.target.reset();
      loadStructures();
    } catch (err) {
      pushToast(err.message || "Error", "error");
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("component-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = document.getElementById("component-save-btn");
    btn.disabled = true;
    try {
      await apiRequest("/salary-components", {
        method: "POST",
        body: JSON.stringify({
          salary_structure_id: Number(fd.get("salary_structure_id")),
          component_name: fd.get("component_name"),
          component_type: fd.get("component_type"),
          calc_method: fd.get("calc_method"),
          default_amount: fd.get("default_amount") ? Number(fd.get("default_amount")) : null,
        }),
      });
      pushToast("Component added", "success");
      e.target.reset();
      loadStructures();
    } catch (err) {
      pushToast(err.message || "Error", "error");
    } finally {
      btn.disabled = false;
    }
  });

  // ── Tax Rules / Brackets ─────────────────────────────────────────────────
  let taxRules = [];
  let selectedRuleId = null;

  async function loadTaxRules() {
    try {
      const r = await apiRequest("/tax-rules");
      taxRules = unwrapData(r)?.data || [];
      renderTaxRules();
    } catch (err) {
      /* silent */
    }
  }

  function renderTaxRules() {
    const list = document.getElementById("tax-rules-list");
    list.innerHTML = "";
    taxRules.forEach((r) => {
      const btn = document.createElement("button");
      const active = selectedRuleId === r.id;
      btn.className = `w-full rounded border px-3 py-2 text-left text-sm transition ${active ? "border-cyan-500 text-cyan-300" : "border-white/8 hover:border-white/20"}`;
      btn.innerHTML = `<div class="font-medium">${esc(r.rule_name)}</div><div class="form-label">${esc((r.country_code || "").toUpperCase())} · from ${r.effective_from}</div>`;
      btn.addEventListener("click", () => loadBracketsFor(r));
      list.appendChild(btn);
    });
  }

  async function loadBracketsFor(rule) {
    selectedRuleId = rule.id;
    renderTaxRules();
    const panel = document.getElementById("tax-brackets-panel");
    panel.innerHTML = '<p class="text-sm text-slate-500">Loading…</p>';
    try {
      const r = await apiRequest(`/tax-brackets?tax_rule_id=${rule.id}`);
      const brackets = unwrapData(r) || [];
      renderBrackets(rule, brackets);
    } catch (err) {
      panel.innerHTML = `<p class="text-sm text-red-400">${esc(err.message || "Failed to load")}</p>`;
    }
  }

  function renderBrackets(rule, brackets) {
    const panel = document.getElementById("tax-brackets-panel");
    panel.innerHTML = `
      <h2 class="font-semibold mb-1">Brackets — ${esc(rule.rule_name)}</h2>
      <p class="text-xs text-slate-400 mb-4">Each bracket: fixed_amount + ((income - range_min) × percentage_rate / 100)</p>
      <form id="bracket-form" class="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-4">
        <div><label class="form-label">Range Min</label><input name="range_min" type="number" min="0" required value="0" class="form-input"></div>
        <div><label class="form-label">Range Max (blank=∞)</label><input name="range_max" type="number" class="form-input"></div>
        <div><label class="form-label">Rate (%)</label><input name="percentage_rate" type="number" step="0.01" required class="form-input"></div>
        <div><label class="form-label">Fixed Amount</label><input name="fixed_amount" type="number" step="0.01" value="0" class="form-input"></div>
        <div class="col-span-2 lg:col-span-4"><button type="submit" class="btn-primary rounded-lg px-5 py-2 text-sm" id="bracket-save-btn"><span>Add Bracket</span></button></div>
      </form>
      <table class="w-full text-sm">
        <thead><tr class="border-b border-white/8 text-xs text-slate-400"><th class="pb-2 text-left pr-4">Range Min</th><th class="pb-2 text-left pr-4">Range Max</th><th class="pb-2 text-left pr-4">Rate %</th><th class="pb-2 text-left pr-4">Fixed</th><th class="pb-2 text-left">Action</th></tr></thead>
        <tbody id="brackets-tbody"></tbody>
      </table>`;

    const tbody = document.getElementById("brackets-tbody");
    if (brackets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-500 text-sm">No brackets yet.</td></tr>';
    } else {
      tbody.innerHTML = "";
      brackets.forEach((b) => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-white/5";
        tr.innerHTML = `
          <td class="py-2 pr-4">${Number(b.range_min).toLocaleString()}</td>
          <td class="py-2 pr-4">${b.range_max !== null ? Number(b.range_max).toLocaleString() : "∞"}</td>
          <td class="py-2 pr-4">${b.percentage_rate}%</td>
          <td class="py-2 pr-4">${b.fixed_amount}</td>
          <td class="py-2"><button data-id="${b.id}" class="del-bracket-btn text-xs text-rose-400 hover:underline">Delete</button></td>`;
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll(".del-bracket-btn").forEach((btn) =>
        btn.addEventListener("click", async () => {
          try {
            await apiRequest(`/tax-brackets/${btn.dataset.id}`, { method: "DELETE" });
            pushToast("Bracket deleted", "success");
            loadBracketsFor(rule);
          } catch (err) {
            pushToast(err.message || "Error", "error");
          }
        })
      );
    }

    document.getElementById("bracket-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = document.getElementById("bracket-save-btn");
      btn.disabled = true;
      try {
        await apiRequest("/tax-brackets", {
          method: "POST",
          body: JSON.stringify({
            tax_rule_id: rule.id,
            range_min: Number(fd.get("range_min")),
            range_max: fd.get("range_max") ? Number(fd.get("range_max")) : null,
            percentage_rate: Number(fd.get("percentage_rate")),
            fixed_amount: Number(fd.get("fixed_amount") || 0),
          }),
        });
        pushToast("Bracket added", "success");
        loadBracketsFor(rule);
      } catch (err) {
        pushToast(err.message || "Error", "error");
        btn.disabled = false;
      }
    });
  }

  document.getElementById("tax-rule-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = document.getElementById("tax-rule-save-btn");
    btn.disabled = true;
    try {
      await apiRequest("/tax-rules", {
        method: "POST",
        body: JSON.stringify({ country_code: fd.get("country_code"), rule_name: fd.get("rule_name"), effective_from: fd.get("effective_from") }),
      });
      pushToast("Tax rule created", "success");
      e.target.reset();
      loadTaxRules();
    } catch (err) {
      pushToast(err.message || "Error", "error");
    } finally {
      btn.disabled = false;
    }
  });

  // ── Expense Reimbursements ───────────────────────────────────────────────
  async function loadExpenses() {
    const list = document.getElementById("expenses-list");
    try {
      const r = await apiRequest("/expense-reimbursements");
      const expenses = unwrapData(r)?.data || [];
      if (expenses.length === 0) {
        list.innerHTML = '<p class="text-sm text-slate-500">No expense claims submitted.</p>';
        return;
      }
      list.innerHTML = "";
      expenses.forEach((exp) => {
        const div = document.createElement("div");
        div.className = "rounded-xl border border-white/8 bg-white/3 px-4 py-3";
        div.innerHTML = `
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-medium text-white text-sm">${esc(exp.description)}</p>
              <p class="text-xs text-slate-400 mt-0.5">${esc(exp.employee_name)} (${esc(exp.employee_code)}) · ${esc(exp.category)} · ${exp.expense_date}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="font-mono text-emerald-400 text-sm">${esc(exp.currency)} ${Number(exp.amount).toLocaleString()}</p>
              <span class="badge text-[10px] ${EXPENSE_BADGE[exp.status] || "badge-blue"}">${esc((exp.status || "").replace(/_/g, " "))}</span>
            </div>
          </div>
          ${
            exp.status === "pending"
              ? `<div class="flex gap-2 mt-2">
                  <button data-id="${exp.id}" data-action="approve" class="expense-action-btn rounded px-3 py-1 text-xs border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition">Approve</button>
                  <button data-id="${exp.id}" data-action="reject" class="expense-action-btn rounded px-3 py-1 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 transition">Reject</button>
                </div>`
              : ""
          }`;
        list.appendChild(div);
      });
      list.querySelectorAll(".expense-action-btn").forEach((btn) =>
        btn.addEventListener("click", async () => {
          try {
            await apiRequest(`/expense-reimbursements/${btn.dataset.id}/${btn.dataset.action}`, { method: "POST" });
            pushToast(btn.dataset.action === "approve" ? "Approved" : "Rejected", "success");
            loadExpenses();
          } catch (err) {
            pushToast(err.message || "Error", "error");
          }
        })
      );
    } catch (err) {
      list.innerHTML = `<p class="text-sm text-red-400">${esc(err.message || "Failed to load")}</p>`;
    }
  }

  document.getElementById("expense-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const empId = searchSelect("ss-expense-employee")?.getValue();
    if (!empId) {
      pushToast("Select an employee", "error");
      return;
    }
    const fd = new FormData(e.target);
    const btn = document.getElementById("expense-save-btn");
    btn.disabled = true;
    try {
      await apiRequest("/expense-reimbursements", {
        method: "POST",
        body: JSON.stringify({
          employee_id: Number(empId),
          description: fd.get("description"),
          category: fd.get("category"),
          amount: Number(fd.get("amount")),
          currency: fd.get("currency"),
          expense_date: fd.get("expense_date"),
        }),
      });
      pushToast("Expense submitted", "success");
      e.target.reset();
      loadExpenses();
    } catch (err) {
      pushToast(err.message || "Error", "error");
    } finally {
      btn.disabled = false;
    }
  });

  async function loadEmployeeOptions() {
    try {
      const r = await apiRequest("/employees?per_page=500");
      const list = unwrapData(r)?.data || [];
      const options = list.map((e) => ({ value: String(e.id), label: e.full_name, sub: [e.employee_code, e.designation].filter(Boolean).join(" · ") }));
      searchSelect("ss-expense-employee")?.setOptions(options);
    } catch (err) {
      /* silent */
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadRuns();
    loadStructures();
    loadTaxRules();
    loadExpenses();
    loadEmployeeOptions();

    document.getElementById("pr-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn) switchTab(btn.dataset.tab);
    });
  });
})();
