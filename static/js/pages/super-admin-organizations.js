(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  const PLAN_LABEL = { trial: "Trial", silver: "Silver", gold: "Gold", platinum: "Platinum", custom: "Custom" };
  const PLAN_PRICE = { trial: "Free", silver: "$29/mo", gold: "$79/mo", platinum: "$149/mo" };
  const PLAN_BADGE = {
    trial: "border-cyan-500/30 bg-cyan-500/20 text-cyan-300",
    silver: "border-slate-400/30 bg-slate-500/20 text-slate-300",
    gold: "border-amber-500/30 bg-amber-500/20 text-amber-300",
    platinum: "border-violet-500/30 bg-violet-500/20 text-violet-300",
    custom: "border-rose-500/30 bg-rose-500/20 text-rose-300",
  };
  const STATUS_META = {
    active: { dot: "bg-emerald-400", text: "text-emerald-400" },
    inactive: { dot: "bg-slate-500", text: "text-slate-400" },
    suspended: { dot: "bg-amber-400", text: "text-amber-400" },
    trial: { dot: "bg-cyan-400", text: "text-cyan-400" },
  };

  let orgs = [];
  let actionId = null;

  async function load() {
    const tbody = document.getElementById("orgs-tbody");
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-slate-500 py-10">Loading…</td></tr>';
    try {
      const r = await apiRequest("/platform/organizations");
      orgs = unwrapData(r)?.data || [];
      render();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-red-400 py-10">${esc(err.message || "Failed to load")}</td></tr>`;
    }
  }

  function render() {
    const search = document.getElementById("search-input").value.toLowerCase();
    const planFilter = document.getElementById("plan-filter").value;
    const statusFilter = document.getElementById("status-filter").value;

    const filtered = orgs.filter((o) => {
      const code = o.plan_code || "trial";
      const matchSearch = !search || o.name.toLowerCase().includes(search) || (o.country_code || "").toLowerCase().includes(search);
      const matchPlan = planFilter === "all" || code.toLowerCase() === planFilter;
      const matchStatus = statusFilter === "all" || o.status === statusFilter;
      return matchSearch && matchPlan && matchStatus;
    });

    const totalEmp = orgs.reduce((s, o) => s + (o.employee_count || 0), 0);
    const activeCount = orgs.filter((o) => o.status === "active" || o.status === "trial").length;
    const inactiveCount = orgs.length - activeCount;
    document.getElementById("s-total").textContent = orgs.length;
    document.getElementById("s-active").textContent = activeCount;
    document.getElementById("s-inactive").textContent = inactiveCount;
    document.getElementById("s-employees").textContent = totalEmp;

    const tbody = document.getElementById("orgs-tbody");
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center text-slate-500 py-12">${orgs.length === 0 ? "No organizations registered yet." : "No results match your filters."}</td></tr>`;
      document.getElementById("showing-count").textContent = "";
      return;
    }
    tbody.innerHTML = "";
    filtered.forEach((org) => {
      const code = (org.plan_code || "trial").toLowerCase();
      const sm = STATUS_META[org.status] || { dot: "bg-rose-400", text: "text-rose-400" };
      const isInactive = org.status !== "active" && org.status !== "trial";
      const fee = code === "custom" ? (org.custom_monthly_price != null ? `$${Number(org.custom_monthly_price).toFixed(2)}` : "—") : (PLAN_PRICE[code] || "—");

      const tr = document.createElement("tr");
      if (isInactive) tr.className = "opacity-60";
      tr.innerHTML = `
        <td class="font-medium text-slate-200">${esc(org.name)}</td>
        <td class="text-slate-400 text-xs uppercase">${esc(org.country_code || "—")}</td>
        <td><span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${PLAN_BADGE[code] || PLAN_BADGE.trial}">${PLAN_LABEL[code] || code}</span></td>
        <td>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-400">${org.trial_user_limit != null ? `${org.trial_user_limit} users` : "—"}</span>
            <button data-id="${org.id}" class="change-plan-btn rounded-md border border-violet-500/25 bg-violet-500/8 px-2.5 py-0.5 text-xs text-violet-300 hover:bg-violet-500/18 transition">Change Plan</button>
          </div>
        </td>
        <td class="text-xs font-medium ${code === "trial" ? "text-cyan-400" : code === "custom" ? "text-rose-300" : "text-amber-300"}">${fee}</td>
        <td class="text-right text-slate-300">${org.employee_count || 0}</td>
        <td><span class="flex items-center gap-1.5 ${sm.text}"><span class="h-1.5 w-1.5 rounded-full ${sm.dot}"></span><span class="text-xs capitalize">${esc(org.status)}</span></span></td>
        <td class="text-slate-500 text-xs">${org.created_at ? new Date(org.created_at).toLocaleDateString() : "—"}</td>
        <td>
          <button data-id="${org.id}" data-active="${isInactive ? "0" : "1"}" class="toggle-status-btn rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        isInactive
          ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/18"
          : "border-rose-500/25 bg-rose-500/8 text-rose-400 hover:bg-rose-500/18"
      }" ${actionId === org.id ? "disabled" : ""}>${actionId === org.id ? "…" : isInactive ? "Activate" : "Deactivate"}</button>
        </td>`;
      tbody.appendChild(tr);
    });
    document.getElementById("showing-count").textContent = `Showing ${filtered.length} of ${orgs.length} organizations`;

    tbody.querySelectorAll(".change-plan-btn").forEach((btn) => btn.addEventListener("click", () => openPlanModal(Number(btn.dataset.id))));
    tbody.querySelectorAll(".toggle-status-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        const org = orgs.find((o) => o.id === id);
        const isActive = org.status === "active" || org.status === "trial";
        actionId = id;
        render();
        try {
          await apiRequest(`/platform/organizations/${id}/${isActive ? "suspend" : "activate"}`, { method: "POST" });
          org.status = isActive ? "inactive" : "active";
        } catch (err) {
          pushToast(err.message || "Failed to update status.", "error");
        }
        actionId = null;
        render();
      })
    );
  }

  function openPlanModal(orgId) {
    const org = orgs.find((o) => o.id === orgId);
    if (!org) return;
    document.getElementById("plan-org-id").value = org.id;
    document.getElementById("plan-modal-org-name").textContent = org.name;
    const code = org.plan_code || "trial";
    document.getElementById("plan-select").value = code;
    document.getElementById("plan-limit").value = code === "custom" ? org.trial_user_limit || "" : "";
    document.getElementById("plan-price").value = code === "custom" ? org.custom_monthly_price || "" : "";
    document.getElementById("plan-custom-fields").hidden = code !== "custom";
    document.getElementById("plan-error").hidden = true;
    document.getElementById("plan-modal").hidden = false;
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    document.getElementById("search-input").addEventListener("input", render);
    document.getElementById("plan-filter").addEventListener("change", render);
    document.getElementById("status-filter").addEventListener("change", render);

    // Create org modal
    const createModal = document.getElementById("create-modal");
    document.getElementById("create-org-btn").addEventListener("click", () => {
      document.getElementById("create-form").reset();
      document.getElementById("create-form").hidden = false;
      document.getElementById("create-success").hidden = true;
      document.getElementById("create-error").hidden = true;
      document.getElementById("custom-plan-fields").hidden = true;
      createModal.hidden = false;
    });
    document.getElementById("create-close").addEventListener("click", () => (createModal.hidden = true));
    document.getElementById("create-cancel").addEventListener("click", () => (createModal.hidden = true));
    document.getElementById("create-done").addEventListener("click", () => {
      createModal.hidden = true;
      load();
    });
    document.getElementById("create-plan-select").addEventListener("change", (e) => {
      document.getElementById("custom-plan-fields").hidden = e.target.value !== "custom";
    });
    document.getElementById("create-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const errBox = document.getElementById("create-error");
      errBox.hidden = true;
      const planCode = fd.get("plan_code");
      const body = {
        organization_name: fd.get("organization_name"),
        admin_name: fd.get("admin_name"),
        admin_email: fd.get("admin_email"),
        password: fd.get("password"),
        country_code: fd.get("country_code"),
        industry: fd.get("industry"),
        default_currency: fd.get("default_currency"),
        timezone: fd.get("timezone"),
        plan_code: planCode,
      };
      if (planCode === "custom") {
        body.custom_user_limit = parseInt(fd.get("custom_user_limit"), 10);
        body.custom_monthly_price = parseFloat(fd.get("custom_monthly_price"));
      }
      const btn = document.getElementById("create-submit-btn");
      btn.disabled = true;
      try {
        const res = await apiRequest("/platform/organizations", { method: "POST", body: JSON.stringify(body) });
        const data = unwrapData(res);
        document.getElementById("success-email").textContent = fd.get("admin_email");
        document.getElementById("success-password").textContent = fd.get("password");
        document.getElementById("create-form").hidden = true;
        document.getElementById("create-success").hidden = false;
      } catch (err) {
        errBox.hidden = false;
        errBox.textContent = err.message || "Failed to create organization.";
      } finally {
        btn.disabled = false;
      }
    });

    // Change plan modal
    const planModal = document.getElementById("plan-modal");
    document.getElementById("plan-modal-close").addEventListener("click", () => (planModal.hidden = true));
    document.getElementById("plan-cancel").addEventListener("click", () => (planModal.hidden = true));
    document.getElementById("plan-select").addEventListener("change", (e) => {
      document.getElementById("plan-custom-fields").hidden = e.target.value !== "custom";
    });
    document.getElementById("plan-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = Number(document.getElementById("plan-org-id").value);
      const pickedPlan = document.getElementById("plan-select").value;
      const errBox = document.getElementById("plan-error");
      errBox.hidden = true;

      const body = { plan_code: pickedPlan };
      if (pickedPlan === "custom") {
        const limit = parseInt(document.getElementById("plan-limit").value, 10);
        const price = parseFloat(document.getElementById("plan-price").value);
        if (!limit || limit < 1) {
          errBox.hidden = false;
          errBox.textContent = "Enter a valid user limit (≥ 1).";
          return;
        }
        if (isNaN(price) || price < 0) {
          errBox.hidden = false;
          errBox.textContent = "Enter a valid monthly price (≥ 0).";
          return;
        }
        body.trial_user_limit = limit;
        body.custom_monthly_price = price;
      }
      try {
        const res = await apiRequest(`/platform/organizations/${id}`, { method: "PATCH", body: JSON.stringify(body) });
        const updated = unwrapData(res);
        const org = orgs.find((o) => o.id === id);
        Object.assign(org, updated);
        planModal.hidden = true;
        pushToast("Plan updated", "success");
        render();
      } catch (err) {
        errBox.hidden = false;
        errBox.textContent = err.message || "Failed to update plan.";
      }
    });
  });
})();
