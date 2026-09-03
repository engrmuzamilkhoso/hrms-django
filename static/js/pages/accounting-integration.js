(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  const COMMON_COMPONENTS = [
    "basic_salary", "house_rent_allowance", "medical_allowance", "conveyance_allowance",
    "income_tax", "eobi_deduction", "social_security", "provident_fund",
    "overtime_pay", "bonus", "loan_deduction", "absence_deduction",
  ];

  let integration = null;
  let mappingRows = [];

  function switchTab(tab) {
    document.querySelectorAll("#acc-tab-bar .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }

  async function load() {
    try {
      const r = await apiRequest("/accounting-integration");
      const d = unwrapData(r) || {};
      integration = d.integration || null;
      const mappings = d.mappings || [];
      mappingRows = COMMON_COMPONENTS.map((c) => {
        const found = mappings.find((x) => x.hrms_component === c);
        return { hrms_component: c, ledger_account_code: found ? found.ledger_account_code : "", ledger_account_name: found ? found.ledger_account_name || "" : "" };
      });
      renderStatus();
      renderSetupForm();
      renderMappings();
      renderPushWarning();
    } catch (err) {
      /* silent, matches original */
    }
  }

  function renderStatus() {
    const el = document.getElementById("integration-status");
    if (integration) {
      el.innerHTML = `
        <div class="rounded-xl border border-emerald-500/20 bg-emerald-500/6 p-5 mb-5">
          <div class="flex items-center gap-2 mb-2"><div class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div><p class="font-semibold text-emerald-300">Integration Active</p></div>
          <p class="text-sm text-slate-400">Provider: <span class="text-white">${esc(integration.provider)}</span></p>
          <p class="text-sm text-slate-400">Endpoint: <span class="text-white font-mono text-xs">${esc(integration.endpoint_url)}</span></p>
          <p class="text-sm text-slate-400">Auth: <span class="text-white">${esc(integration.auth_type)}</span></p>
        </div>`;
    } else {
      el.innerHTML = '<div class="rounded-xl border border-amber-500/20 bg-amber-500/6 p-4 mb-5 text-sm text-amber-300">No integration configured yet. Set up a connection below.</div>';
    }
  }

  function renderSetupForm() {
    const form = document.getElementById("setup-form");
    if (integration) {
      form.provider.value = integration.provider;
      form.auth_type.value = integration.auth_type;
    }
  }

  function renderMappings() {
    const tbody = document.getElementById("mappings-tbody");
    tbody.innerHTML = "";
    mappingRows.forEach((row, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="font-mono text-xs text-violet-400">${esc(row.hrms_component)}</td>
        <td><input data-idx="${i}" data-field="ledger_account_code" value="${esc(row.ledger_account_code)}" placeholder="e.g. 5001" class="mapping-input form-input py-1 text-sm"></td>
        <td><input data-idx="${i}" data-field="ledger_account_name" value="${esc(row.ledger_account_name)}" placeholder="e.g. Salaries Expense" class="mapping-input form-input py-1 text-sm"></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll(".mapping-input").forEach((input) =>
      input.addEventListener("input", (e) => {
        mappingRows[Number(e.target.dataset.idx)][e.target.dataset.field] = e.target.value;
      })
    );
  }

  async function renderPushWarning() {
    document.getElementById("push-integration-warning").hidden = !!integration;
  }

  async function loadPushRuns() {
    const list = document.getElementById("push-runs-list");
    try {
      const r = await apiRequest("/payroll-runs");
      const runs = (unwrapData(r)?.data || []).filter((x) => x.status === "approved");
      if (runs.length === 0) {
        list.innerHTML = '<p class="text-sm text-slate-500">No approved payroll runs available.</p>';
        return;
      }
      list.innerHTML = "";
      runs.forEach((run) => {
        const div = document.createElement("div");
        div.className = "flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-5 py-4 mb-3";
        div.innerHTML = `
          <div><p class="font-medium text-white">Payroll Run #${run.id}</p><p class="text-xs text-slate-400">${run.period_start} → ${run.period_end} · ${esc(run.status)}</p></div>
          <button data-id="${run.id}" class="push-journal-btn rounded-xl border border-violet-500/30 px-4 py-2 text-sm text-violet-400 hover:bg-violet-500/10 transition" ${integration ? "" : "disabled"}>Push Journal →</button>`;
        list.appendChild(div);
      });
      list.querySelectorAll(".push-journal-btn").forEach((btn) =>
        btn.addEventListener("click", async () => {
          try {
            const r = await apiRequest(`/accounting-integration/push-journal/${btn.dataset.id}`, { method: "POST" });
            pushToast(unwrapData(r)?.message || "Pushed", "success");
          } catch (err) {
            pushToast(err.message || "Error", "error");
          }
        })
      );
    } catch (err) {
      list.innerHTML = `<p class="text-sm text-red-400">${esc(err.message || "Failed to load")}</p>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    loadPushRuns();

    document.getElementById("acc-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn) switchTab(btn.dataset.tab);
    });

    document.getElementById("setup-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = document.getElementById("setup-save-btn");
      btn.disabled = true;
      try {
        await apiRequest("/accounting-integration", {
          method: "POST",
          body: JSON.stringify({
            provider: fd.get("provider"), endpoint_url: fd.get("endpoint_url"), auth_type: fd.get("auth_type"),
            secret_ref: fd.get("secret_ref") || null, is_active: true,
          }),
        });
        pushToast("Integration saved", "success");
        load();
        loadPushRuns();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("mappings-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("mappings-save-btn");
      btn.disabled = true;
      try {
        await apiRequest("/accounting-integration/mappings", {
          method: "POST",
          body: JSON.stringify({ mappings: mappingRows.filter((r) => r.ledger_account_code) }),
        });
        pushToast("Mappings saved", "success");
        load();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
