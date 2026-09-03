(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  const fmt = (n) => (n != null ? Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00");
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
  const periodLabel = (p) => {
    const [y, m] = p.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };
  const PLAN_LABEL = { trial: "Trial", silver: "Silver", gold: "Gold", platinum: "Platinum", custom: "Custom" };
  const PLAN_BADGE = {
    trial: "border-cyan-500/30 bg-cyan-500/20 text-cyan-300",
    silver: "border-slate-500/30 bg-slate-500/20 text-slate-300",
    gold: "border-amber-500/30 bg-amber-500/20 text-amber-300",
    platinum: "border-violet-500/30 bg-violet-500/20 text-violet-300",
    custom: "border-rose-500/30 bg-rose-500/20 text-rose-300",
  };
  const PLAN_ACCENT = {
    trial: { color: "text-cyan-300", border: "border-cyan-500/30", bg: "bg-cyan-500/8" },
    silver: { color: "text-slate-300", border: "border-slate-400/30", bg: "bg-slate-500/8" },
    gold: { color: "text-amber-300", border: "border-amber-500/30", bg: "bg-amber-500/8" },
    platinum: { color: "text-violet-300", border: "border-violet-500/30", bg: "bg-violet-500/8" },
    custom: { color: "text-rose-300", border: "border-rose-500/30", bg: "bg-rose-500/8" },
  };
  const PLAN_ORDER = ["trial", "silver", "gold", "platinum", "custom"];

  function isOverdue(inv) {
    return inv.status !== "paid" && !!inv.due_date && new Date(inv.due_date) < new Date();
  }
  function statusMeta(inv) {
    if (inv.status === "paid") return { label: "Paid", cls: "border-emerald-500/30 bg-emerald-500/20 text-emerald-300" };
    if (isOverdue(inv)) return { label: "Overdue", cls: "border-rose-500/30 bg-rose-500/20 text-rose-300" };
    return { label: "Pending", cls: "border-amber-500/30 bg-amber-500/20 text-amber-300" };
  }

  let invoices = [];
  let planPrices = [];
  let statusTab = "all";

  function setActive(container, selector, dataAttr, value) {
    container.querySelectorAll(selector).forEach((btn) => {
      const active = btn.dataset[dataAttr] === value;
      btn.classList.toggle("bg-white/8", active);
      btn.classList.toggle("text-slate-200", active);
      btn.classList.toggle("text-slate-500", !active);
    });
  }

  async function loadInvoices() {
    const tbody = document.getElementById("invoices-tbody");
    try {
      const [invRes, priceRes] = await Promise.allSettled([apiRequest("/platform/billing/records"), apiRequest("/platform/plan-pricing")]);
      if (invRes.status === "fulfilled") invoices = unwrapData(invRes.value)?.data || [];
      if (priceRes.status === "fulfilled") planPrices = unwrapData(priceRes.value) || [];
      renderInvoices();
      renderPricing();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-red-400 py-10">${esc(err.message || "Failed to load")}</td></tr>`;
    }
  }

  function renderInvoices() {
    const periodFilter = document.getElementById("period-filter").value;
    const allPaid = invoices.filter((i) => i.status === "paid");
    const allPending = invoices.filter((i) => i.status !== "paid" && !isOverdue(i));
    const allOverdue = invoices.filter(isOverdue);
    const tabFiltered = statusTab === "pending" ? allPending : statusTab === "paid" ? allPaid : statusTab === "overdue" ? allOverdue : invoices;
    const displayed = periodFilter === "all" ? tabFiltered : tabFiltered.filter((i) => i.billing_period === periodFilter);

    const totalRev = allPaid.reduce((s, i) => s + Number(i.amount), 0);
    const totalPend = [...allPending, ...allOverdue].reduce((s, i) => s + Number(i.amount), 0);
    document.getElementById("s-orgs").textContent = new Set(invoices.map((i) => i.organization_id)).size;
    document.getElementById("s-revenue").textContent = `$${fmt(totalRev)}`;
    document.getElementById("s-outstanding").textContent = `$${fmt(totalPend)}`;
    document.getElementById("s-overdue").textContent = allOverdue.length;

    // status tab counts + active state
    document.querySelectorAll(".status-tab-btn").forEach((btn) => {
      const key = btn.dataset.statusTab;
      const count = key === "all" ? invoices.length : key === "pending" ? allPending.length : key === "overdue" ? allOverdue.length : allPaid.length;
      const label = { all: "All Invoices", pending: "Pending", overdue: "Overdue", paid: "Completed" }[key];
      btn.innerHTML = `${label} <span class="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${btn.dataset.statusTab === statusTab ? "bg-white/8" : "bg-white/4 text-slate-600"}">${count}</span>`;
    });
    setActive(document, ".status-tab-btn", "statusTab", statusTab);

    // period filter options
    const periodSelect = document.getElementById("period-filter");
    const periods = Array.from(new Set(invoices.map((i) => i.billing_period))).sort().reverse();
    const currentVal = periodSelect.value;
    periodSelect.innerHTML = '<option value="all">All Periods</option>' + periods.map((p) => `<option value="${p}">${periodLabel(p)}</option>`).join("");
    periodSelect.value = periods.includes(currentVal) ? currentVal : "all";

    const tbody = document.getElementById("invoices-tbody");
    if (displayed.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-slate-500 py-12">No invoices found.</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    displayed.forEach((inv) => {
      const sm = statusMeta(inv);
      const orgName = inv.organization ? inv.organization.name : `Org #${inv.organization_id}`;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="font-mono text-xs text-violet-300 whitespace-nowrap">${esc(inv.invoice_number || `#${inv.id}`)}</td>
        <td class="font-medium text-slate-200 max-w-36 truncate" title="${esc(orgName)}">${esc(orgName)}</td>
        <td class="text-slate-400 text-xs whitespace-nowrap">${periodLabel(inv.billing_period)}</td>
        <td><span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${PLAN_BADGE[inv.plan_code] || PLAN_BADGE.trial}">${PLAN_LABEL[inv.plan_code] || inv.plan_code}</span></td>
        <td class="text-right text-slate-300">${inv.active_employee_count}</td>
        <td class="text-right font-semibold text-amber-300 whitespace-nowrap">${esc(inv.currency)} ${fmt(inv.amount)}</td>
        <td class="text-xs whitespace-nowrap ${isOverdue(inv) ? "text-rose-400 font-medium" : "text-slate-500"}">${fmtDate(inv.due_date)}</td>
        <td><span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${sm.cls}">${sm.label}</span></td>
        <td>
          <div class="flex items-center gap-1.5">
            <button data-id="${inv.id}" class="view-inv-btn rounded-md border border-white/10 bg-white/4 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/8 hover:text-white transition">View</button>
            ${inv.status !== "paid" ? `<button data-id="${inv.id}" class="mark-paid-btn rounded-md border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-500/18 transition">Mark Paid</button>` : ""}
          </div>
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".view-inv-btn").forEach((btn) => btn.addEventListener("click", () => openInvoiceModal(Number(btn.dataset.id))));
    tbody.querySelectorAll(".mark-paid-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "…";
        try {
          const res = await apiRequest(`/platform/billing/records/${btn.dataset.id}/mark-paid`, { method: "POST" });
          const updated = unwrapData(res);
          const inv = invoices.find((i) => i.id === Number(btn.dataset.id));
          Object.assign(inv, updated);
          pushToast("Invoice marked as paid", "success");
          renderInvoices();
        } catch (err) {
          pushToast(err.message || "Failed to mark as paid.", "error");
          btn.disabled = false;
          btn.textContent = "Mark Paid";
        }
      })
    );
  }

  function openInvoiceModal(id) {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    const orgName = inv.organization ? inv.organization.name : `Organization #${inv.organization_id}`;
    const planRow = planPrices.find((p) => p.plan_code === inv.plan_code);
    const planPrice = planRow ? planRow.monthly_price : 0;
    const sm = statusMeta(inv);
    document.getElementById("invoice-modal-body").innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <div>
          <p class="font-mono text-sm text-violet-300">${esc(inv.invoice_number || `#${inv.id}`)}</p>
          <p class="text-xs text-slate-500 mt-0.5">${esc(orgName)} · Org ID ${inv.organization_id}</p>
        </div>
        <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sm.cls}">${sm.label}</span>
      </div>
      <div class="grid grid-cols-3 gap-4 mb-6 rounded-xl border border-white/8 bg-white/3 p-4">
        <div><p class="text-[10px] uppercase text-slate-500">Billing Period</p><p class="mt-1 text-sm font-medium text-slate-200">${periodLabel(inv.billing_period)}</p></div>
        <div><p class="text-[10px] uppercase text-slate-500">Invoice Date</p><p class="mt-1 text-sm font-medium text-slate-200">${fmtDate(inv.generated_at)}</p></div>
        <div><p class="text-[10px] uppercase text-slate-500">Due Date</p><p class="mt-1 text-sm font-medium text-slate-200">${fmtDate(inv.due_date)}</p></div>
      </div>
      <table class="w-full text-sm mb-6 rounded-xl overflow-hidden border border-white/8">
        <thead><tr class="bg-white/4"><th class="px-4 py-3 text-left text-[10px] uppercase text-slate-500">Description</th><th class="px-4 py-3 text-right text-[10px] uppercase text-slate-500">Unit Price</th><th class="px-4 py-3 text-right text-[10px] uppercase text-slate-500">Amount</th></tr></thead>
        <tbody><tr class="border-t border-white/5">
          <td class="px-4 py-4"><p class="font-medium text-slate-200">${PLAN_LABEL[inv.plan_code] || inv.plan_code} Plan — Monthly Subscription</p><p class="text-xs text-slate-500 mt-0.5">${inv.active_employee_count} active employees</p></td>
          <td class="px-4 py-4 text-right text-slate-300">${esc(inv.currency)} ${fmt(planPrice)}</td>
          <td class="px-4 py-4 text-right font-semibold text-amber-300">${esc(inv.currency)} ${fmt(inv.amount)}</td>
        </tr></tbody>
      </table>
      <div class="flex justify-end">
        <div class="w-64 space-y-2">
          <div class="flex justify-between text-sm text-slate-400"><span>Subtotal</span><span>${esc(inv.currency)} ${fmt(inv.amount)}</span></div>
          <div class="flex justify-between pt-2 border-t border-violet-500/30 text-base font-bold text-slate-100"><span>Total Due</span><span class="text-amber-300">${esc(inv.currency)} ${fmt(inv.amount)}</span></div>
          ${inv.status === "paid" && inv.paid_at ? `<div class="flex justify-between text-xs text-emerald-400 pt-1"><span>Paid on</span><span>${fmtDate(inv.paid_at)}</span></div>` : ""}
        </div>
      </div>`;
    document.getElementById("invoice-modal").hidden = false;
  }

  function renderPricing() {
    const grid = document.getElementById("pricing-grid");
    const sorted = [...planPrices].sort((a, b) => PLAN_ORDER.indexOf(a.plan_code) - PLAN_ORDER.indexOf(b.plan_code));
    grid.innerHTML = "";
    sorted.forEach((plan) => {
      const acc = PLAN_ACCENT[plan.plan_code] || PLAN_ACCENT.trial;
      const card = document.createElement("div");
      card.className = `relative rounded-2xl border p-5 transition ${acc.border} ${acc.bg}`;
      let body;
      if (plan.is_custom) {
        body = `<div class="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2.5"><p class="text-xs text-rose-300 font-medium">Price set individually per organization when assigning this plan.</p></div>`;
      } else if (plan.is_free) {
        body = `<div class="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5 flex items-center justify-between"><span class="text-xl font-black text-cyan-300">$0</span><span class="text-xs text-slate-500">/ month</span></div>`;
      } else {
        body = `<div class="price-display flex items-center justify-between">
          <div><span class="text-3xl font-black ${acc.color}">$${fmt(plan.monthly_price)}</span><span class="ml-1 text-xs text-slate-500">/ month</span></div>
          <button class="edit-price-btn rounded-lg border px-3 py-1.5 text-xs font-medium transition ${acc.border} text-slate-300 hover:text-white" data-code="${plan.plan_code}">Edit Price</button>
        </div>
        <div class="price-edit-form" hidden>
          <div class="flex items-center gap-2 mb-2"><span class="text-slate-400 text-sm">$</span><input type="number" min="0" step="0.01" class="price-input form-input text-sm flex-1 py-2" value="${plan.monthly_price}"><span class="text-slate-500 text-xs">/ mo</span></div>
          <p class="price-error text-xs text-red-400 mb-2" hidden></p>
          <div class="flex gap-2">
            <button class="price-cancel-btn flex-1 rounded-lg border border-white/10 bg-white/4 py-1.5 text-xs hover:bg-white/6 transition">Cancel</button>
            <button class="price-save-btn btn-primary flex-[2] rounded-lg py-1.5 text-xs" data-code="${plan.plan_code}"><span>Save</span></button>
          </div>
        </div>`;
      }
      card.innerHTML = `
        <div class="flex items-start justify-between mb-3">
          <div>
            <span class="text-base font-extrabold uppercase tracking-wide ${acc.color}">${esc(plan.label)}</span>
            ${plan.is_free ? '<span class="ml-2 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">Free Forever</span>' : ""}
            ${plan.is_custom ? '<span class="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">Per Org</span>' : ""}
          </div>
        </div>
        <div class="mb-3"><p class="text-[10px] uppercase text-slate-500 mb-1">User Limit</p><p class="text-sm font-semibold ${acc.color}">${plan.user_limit != null ? `${plan.user_limit} users` : "Custom (set per org)"}</p></div>
        ${body}`;
      grid.appendChild(card);

      const editBtn = card.querySelector(".edit-price-btn");
      if (editBtn) {
        const displayEl = card.querySelector(".price-display");
        const formEl = card.querySelector(".price-edit-form");
        editBtn.addEventListener("click", () => {
          displayEl.hidden = true;
          formEl.hidden = false;
        });
        card.querySelector(".price-cancel-btn").addEventListener("click", () => {
          formEl.hidden = true;
          displayEl.hidden = false;
        });
        card.querySelector(".price-save-btn").addEventListener("click", async () => {
          const input = card.querySelector(".price-input");
          const errEl = card.querySelector(".price-error");
          const val = parseFloat(input.value);
          if (isNaN(val) || val < 0) {
            errEl.hidden = false;
            errEl.textContent = "Enter a valid price (≥ 0).";
            return;
          }
          try {
            const res = await apiRequest(`/platform/plan-pricing/${plan.plan_code}`, { method: "PATCH", body: JSON.stringify({ monthly_price: val }) });
            const updated = unwrapData(res);
            Object.assign(plan, updated);
            pushToast("Plan price updated", "success");
            renderPricing();
          } catch (err) {
            errEl.hidden = false;
            errEl.textContent = err.message || "Failed to save.";
          }
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadInvoices();
    setActive(document, ".page-tab-btn", "pageTab", "invoices");

    document.getElementById("page-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".page-tab-btn");
      if (!btn) return;
      const tab = btn.dataset.pageTab;
      setActive(document, ".page-tab-btn", "pageTab", tab);
      document.getElementById("invoices-panel").hidden = tab !== "invoices";
      document.getElementById("pricing-panel").hidden = tab !== "pricing";
      document.getElementById("generate-btn").hidden = tab !== "invoices";
    });

    document.getElementById("status-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".status-tab-btn");
      if (!btn) return;
      statusTab = btn.dataset.statusTab;
      renderInvoices();
    });
    document.getElementById("period-filter").addEventListener("change", renderInvoices);

    document.getElementById("invoice-modal-close").addEventListener("click", () => (document.getElementById("invoice-modal").hidden = true));

    const genModal = document.getElementById("generate-modal");
    const now = new Date();
    document.getElementById("generate-period").value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    document.getElementById("generate-btn").addEventListener("click", () => {
      document.getElementById("generate-form").hidden = false;
      document.getElementById("generate-result").hidden = true;
      document.getElementById("generate-done").hidden = true;
      document.getElementById("generate-error").hidden = true;
      genModal.hidden = false;
    });
    document.getElementById("generate-close").addEventListener("click", () => (genModal.hidden = true));
    document.getElementById("generate-cancel").addEventListener("click", () => (genModal.hidden = true));
    document.getElementById("generate-done").addEventListener("click", () => {
      genModal.hidden = true;
      loadInvoices();
    });
    document.getElementById("generate-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const period = document.getElementById("generate-period").value;
      const errBox = document.getElementById("generate-error");
      errBox.hidden = true;
      const btn = document.getElementById("generate-submit-btn");
      btn.disabled = true;
      try {
        const res = await apiRequest(`/platform/billing/generate/${period}`, { method: "POST" });
        const data = unwrapData(res);
        document.getElementById("generate-count").textContent = data?.count ?? 0;
        document.getElementById("generate-form").hidden = true;
        document.getElementById("generate-result").hidden = false;
        document.getElementById("generate-done").hidden = false;
      } catch (err) {
        errBox.hidden = false;
        errBox.textContent = err.message || "Failed to generate invoices.";
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
