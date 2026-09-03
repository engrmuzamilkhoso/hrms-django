/**
 * Functional port of app/platform/leave/page.tsx's 6 tabs against the
 * preserved /api/v1/leave-* endpoints.
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  const STATUS_BADGE = { pending: "badge-amber", approved: "badge-green", rejected: "badge-red" };

  function switchTab(tab) {
    document.querySelectorAll("#leave-tab-bar .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    const url = new URL(window.location);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url);
    loadTab(tab);
  }

  const loaded = {};
  function loadTab(tab) {
    if (loaded[tab]) return;
    loaded[tab] = true;
    if (tab === "requests") loadMyRequests();
    else if (tab === "apply") loadApplyForm();
    else if (tab === "approvals") loadApprovals();
    else if (tab === "policies") loadPolicies();
    else if (tab === "balances") loadBalancesEmployees();
    else if (tab === "report") loadReport();
  }

  document.getElementById("leave-tab-bar").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (btn) switchTab(btn.dataset.tab);
  });

  // ── My Requests ───────────────────────────────────────────────────────
  async function loadMyRequests() {
    const container = document.getElementById("requests-list");
    container.innerHTML = '<div class="flex justify-center py-10"><div class="h-6 w-6 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin"></div></div>';
    try {
      const rows = unwrapData(await apiRequest("/leave-requests/my")) || [];
      if (rows.length === 0) {
        container.innerHTML = '<div class="rounded-2xl border border-white/8 bg-white/3 p-12 text-center text-slate-400">📋 No leave requests yet</div>';
        return;
      }
      const table = document.createElement("table");
      table.className = "data-table w-full";
      table.innerHTML = "<thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th></th></tr></thead>";
      const tbody = document.createElement("tbody");
      rows.forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${esc(r.leave_type ? r.leave_type.name : "")}</td>
          <td>${r.from_date}</td><td>${r.to_date}</td><td>${r.requested_days}</td>
          <td><span class="badge ${STATUS_BADGE[r.status] || "badge-slate"} capitalize">${esc(r.status)}</span></td>
          <td>${r.status === "pending" ? `<button data-id="${r.id}" class="del-req text-xs text-red-400 hover:text-red-300">Delete</button>` : ""}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.innerHTML = "";
      container.appendChild(table);
      container.querySelectorAll(".del-req").forEach((btn) =>
        btn.addEventListener("click", async () => {
          if (!confirm("Delete this leave request?")) return;
          try {
            await apiRequest(`/leave-requests/${btn.dataset.id}`, { method: "DELETE" });
            pushToast("Leave request deleted", "success");
            loaded.requests = false;
            loadMyRequests();
          } catch (err) {
            pushToast(err.message || "Error deleting", "error");
          }
        })
      );
    } catch (err) {
      container.innerHTML = `<div class="text-sm text-red-400">${esc(err.message || "Failed to load")}</div>`;
    }
  }

  // ── Apply Leave ───────────────────────────────────────────────────────
  async function loadApplyForm() {
    try {
      const r = await apiRequest("/leave-types");
      const d = unwrapData(r);
      const types = d.data || d || [];
      const select = document.getElementById("apply-leave-type");
      select.innerHTML = "";
      types.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = `${t.name} (${t.annual_quota} days/yr)`;
        select.appendChild(opt);
      });
    } catch (err) {
      pushToast(err.message || "Failed to load leave types", "error");
    }
  }

  document.getElementById("apply-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const errBox = document.getElementById("apply-error");
    errBox.hidden = true;
    const btn = document.getElementById("apply-submit-btn");
    btn.disabled = true;
    btn.querySelector("span").textContent = "Submitting…";
    try {
      await apiRequest("/leave-requests", {
        method: "POST",
        body: JSON.stringify({
          leave_type_id: Number(fd.get("leave_type_id")), from_date: fd.get("from_date"), to_date: fd.get("to_date"),
          duration_type: fd.get("duration_type"), reason: fd.get("reason") || null,
        }),
      });
      pushToast("Leave request submitted", "success");
      form.reset();
      loaded.requests = false;
      switchTab("requests");
    } catch (err) {
      errBox.hidden = false;
      errBox.textContent = err.message || "Failed to submit leave request";
    } finally {
      btn.disabled = false;
      btn.querySelector("span").textContent = "Submit Request";
    }
  });

  // ── Approvals ─────────────────────────────────────────────────────────
  async function loadApprovals() {
    const container = document.getElementById("approvals-list");
    container.innerHTML = '<div class="flex justify-center py-10"><div class="h-6 w-6 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin"></div></div>';
    try {
      const rows = unwrapData(await apiRequest("/leave-requests/pending-approval")) || [];
      const pending = rows.filter((r) => r.can_act);
      if (pending.length === 0) {
        container.innerHTML = '<div class="rounded-2xl border border-white/8 bg-white/3 p-12 text-center text-slate-400">✅ No pending approvals — all caught up!</div>';
        return;
      }
      container.innerHTML = "";
      pending.forEach((r) => {
        const div = document.createElement("div");
        div.className = "rounded-xl border border-white/8 bg-white/3 px-5 py-4 mb-3 flex items-center justify-between gap-4";
        const steps = (r.approval_steps || []).map((s) => `${s.role}: ${s.status}`).join(" · ");
        div.innerHTML = `
          <div>
            <p class="font-medium text-white">${esc(r.employee ? r.employee.full_name : "")} <span class="text-xs text-slate-500 font-mono">${esc(r.employee ? r.employee.employee_code : "")}</span></p>
            <p class="text-sm text-slate-400">${esc(r.leave_type ? r.leave_type.name : "")} · ${r.from_date} → ${r.to_date} · ${r.requested_days} day(s)</p>
            <p class="text-xs text-slate-600 mt-0.5">${esc(steps)}</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <button data-id="${r.id}" class="approve-btn rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 px-3 py-1.5 text-xs">Approve</button>
            <button data-id="${r.id}" class="reject-btn rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 text-xs">Reject</button>
          </div>`;
        container.appendChild(div);
      });
      container.querySelectorAll(".approve-btn").forEach((btn) =>
        btn.addEventListener("click", async () => {
          try {
            const r = await apiRequest(`/leave-requests/${btn.dataset.id}/approve`, { method: "POST" });
            pushToast(r.message || "Approved", "success");
            loaded.approvals = false;
            loadApprovals();
          } catch (err) {
            pushToast(err.message || "Error approving", "error");
          }
        })
      );
      container.querySelectorAll(".reject-btn").forEach((btn) =>
        btn.addEventListener("click", async () => {
          const reason = prompt("Rejection reason:");
          if (!reason) return;
          try {
            await apiRequest(`/leave-requests/${btn.dataset.id}/reject`, { method: "POST", body: JSON.stringify({ rejection_reason: reason }) });
            pushToast("Leave request rejected", "success");
            loaded.approvals = false;
            loadApprovals();
          } catch (err) {
            pushToast(err.message || "Error rejecting", "error");
          }
        })
      );
    } catch (err) {
      container.innerHTML = `<div class="text-sm text-red-400">${esc(err.message || "Failed to load")}</div>`;
    }
  }

  // ── Policies ──────────────────────────────────────────────────────────
  async function loadPolicies() {
    const container = document.getElementById("policies-list");
    container.innerHTML = '<div class="flex justify-center py-10"><div class="h-6 w-6 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin"></div></div>';
    try {
      const rows = unwrapData(await apiRequest("/leave-policies")) || [];
      container.innerHTML = "";
      if (rows.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-500">No leave policies yet.</p>';
        return;
      }
      rows.forEach((p) => {
        const div = document.createElement("div");
        div.className = "rounded-xl border border-white/8 bg-white/3 px-5 py-4 mb-3";
        div.innerHTML = `
          <div class="flex items-center gap-2">
            <p class="font-medium text-white">${esc(p.name)}</p>
            ${p.is_default ? '<span class="badge badge-violet">Default</span>' : ""}
            ${p.pro_rata ? '<span class="badge badge-blue">Pro-rata</span>' : ""}
            <span class="badge ${p.status === "active" ? "badge-green" : "badge-slate"}">${esc(p.status)}</span>
          </div>
          ${p.description ? `<p class="text-xs text-slate-500 mt-1">${esc(p.description)}</p>` : ""}`;
        container.appendChild(div);
      });
    } catch (err) {
      container.innerHTML = `<div class="text-sm text-red-400">${esc(err.message || "Failed to load")}</div>`;
    }
  }

  document.getElementById("policy-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    try {
      await apiRequest("/leave-policies", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"), description: fd.get("description") || null,
          pro_rata: fd.get("pro_rata") === "on", is_default: fd.get("is_default") === "on",
        }),
      });
      pushToast("Leave policy created", "success");
      form.reset();
      loaded.policies = false;
      loadPolicies();
    } catch (err) {
      pushToast(err.message || "Error creating policy", "error");
    }
  });

  // ── Balances ──────────────────────────────────────────────────────────
  async function loadBalancesEmployees() {
    try {
      const r = await apiRequest("/employees?per_page=200");
      const list = unwrapData(r).data || [];
      searchSelect("ss-balance-employee").setOptions(list.map((e) => ({ value: String(e.id), label: e.full_name, sub: e.employee_code })));
    } catch (err) {
      pushToast(err.message || "Failed to load employees", "error");
    }
    document.getElementById("ss-balance-employee").addEventListener("change", async (e) => {
      const empId = e.target.value;
      if (!empId) return;
      const container = document.getElementById("balances-table");
      container.innerHTML = '<div class="flex justify-center py-10"><div class="h-6 w-6 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin"></div></div>';
      try {
        const rows = unwrapData(await apiRequest(`/leave-types/balances?employee_id=${empId}`)) || [];
        const table = document.createElement("table");
        table.className = "data-table w-full";
        table.innerHTML = "<thead><tr><th>Type</th><th>Allocated</th><th>Used</th><th>Pending</th><th>Remaining</th></tr></thead>";
        const tbody = document.createElement("tbody");
        rows.forEach((b) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${esc(b.name)}</td><td>${b.allocated}</td><td>${b.used}</td><td>${b.pending}</td><td class="font-semibold text-emerald-400">${b.remaining}</td>`;
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.innerHTML = "";
        container.appendChild(table);
      } catch (err) {
        container.innerHTML = `<div class="text-sm text-red-400">${esc(err.message || "Failed to load")}</div>`;
      }
    }, true);
  }

  // ── Report ────────────────────────────────────────────────────────────
  async function loadReport() {
    const container = document.getElementById("report-table");
    container.innerHTML = '<div class="flex justify-center py-10"><div class="h-6 w-6 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin"></div></div>';
    try {
      const rows = unwrapData(await apiRequest("/leave-reports/balances")) || [];
      const table = document.createElement("table");
      table.className = "data-table w-full";
      table.innerHTML = "<thead><tr><th>Employee</th><th>Department</th><th>Policy</th><th>Leave Balances</th></tr></thead>";
      const tbody = document.createElement("tbody");
      rows.forEach((r) => {
        const balancesText = (r.balances || []).map((b) => `${b.name}: ${b.remaining}/${b.allocated}`).join(", ");
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${esc(r.full_name)} <span class="text-xs text-slate-500 font-mono">${esc(r.employee_code)}</span></td><td>${esc(r.department || "—")}</td><td>${esc(r.policy_name || "—")}</td><td class="text-xs text-slate-400">${esc(balancesText)}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      container.innerHTML = "";
      container.appendChild(table);
    } catch (err) {
      container.innerHTML = `<div class="text-sm text-red-400">${esc(err.message || "Failed to load")}</div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get("tab") || "requests";
    const validTabs = Array.from(document.querySelectorAll("#leave-tab-bar .tab-btn")).map((b) => b.dataset.tab);
    switchTab(validTabs.includes(initialTab) ? initialTab : "requests");
  });
})();
