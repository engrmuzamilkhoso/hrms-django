/**
 * Pixel-precise port of app/platform/attendance/page.tsx.
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  function formatTime(t) {
    if (!t) return "—";
    return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function formatMins(m) {
    if (!m) return "—";
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }
  function rowClass(r) {
    if (r.is_half_day) return "bg-amber-500/5";
    if (r.is_late) return "bg-rose-500/5";
    if (r.is_wfh) return "bg-blue-500/5";
    return "";
  }

  let currentRecords = [];
  let currentMonth = "";
  let allRules = [];
  let editingRule = null;

  function switchTab(tab) {
    document.querySelectorAll("#att-tab-bar .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }

  async function loadMonthly() {
    const loadingText = document.getElementById("loading-text");
    const tableWrap = document.getElementById("table-wrap");
    loadingText.hidden = false;
    tableWrap.hidden = true;
    try {
      const r = await apiRequest(`/attendance/reports/monthly?month=${currentMonth}`);
      const data = unwrapData(r) || {};
      currentRecords = data.records || [];
      const summary = data.summary;
      if (summary) {
        document.getElementById("summary-cards").hidden = false;
        document.getElementById("sum-wfh").textContent = summary.wfh_days;
        document.getElementById("sum-late").textContent = summary.late_days;
        document.getElementById("sum-half").textContent = summary.half_days;
      }
      const tbody = document.getElementById("records-tbody");
      if (currentRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-slate-500">No records for this period.</td></tr>';
      } else {
        tbody.innerHTML = currentRecords
          .map(
            (r) => `
          <tr class="border-b border-slate-800/50 ${rowClass(r)}">
            <td class="py-2 pr-4 font-mono text-xs">${r.attendance_date}</td>
            <td class="py-2 pr-4">${r.employee_id}</td>
            <td class="py-2 pr-4 text-emerald-400">${formatTime(r.clock_in)}</td>
            <td class="py-2 pr-4 text-rose-400">${formatTime(r.clock_out)}</td>
            <td class="py-2 pr-4 text-slate-300">${formatMins(r.work_minutes)}</td>
            <td class="py-2 pr-4 text-xs text-slate-400 capitalize">${esc((r.method || "").replace("_", " "))}</td>
            <td class="py-2">
              <div class="flex gap-1">
                ${r.is_wfh ? '<span class="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-300">WFH</span>' : ""}
                ${r.is_late ? '<span class="rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300">Late</span>' : ""}
                ${r.is_half_day ? '<span class="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">Half</span>' : ""}
              </div>
            </td>
          </tr>`
          )
          .join("");
      }
    } catch (err) {
      /* silent, matches original */
    }
    loadingText.hidden = true;
    tableWrap.hidden = false;
  }

  function exportCSV() {
    if (currentRecords.length === 0) {
      pushToast("No data to export", "info");
      return;
    }
    const header = "Date,Employee ID,Clock In,Clock Out,Work Minutes,WFH,Late,Half Day,Method\n";
    const rows = currentRecords
      .map((r) => `${r.attendance_date},${r.employee_id},${r.clock_in || ""},${r.clock_out || ""},${r.work_minutes || ""},${r.is_wfh ? "Yes" : ""},${r.is_late ? "Yes" : ""},${r.is_half_day ? "Yes" : ""},${r.method}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${currentMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("CSV exported", "success");
  }

  async function loadEmployeeOptions() {
    try {
      const r = await apiRequest("/employees?per_page=500");
      const list = unwrapData(r)?.data || [];
      const options = list.map((e) => ({ value: String(e.id), label: e.full_name, sub: [e.employee_code, e.designation].filter(Boolean).join(" · ") }));
      const ci = searchSelect("ss-clockin-employee");
      const co = searchSelect("ss-clockout-employee");
      if (ci) ci.setOptions(options);
      if (co) co.setOptions(options);
    } catch (err) {
      /* silent */
    }
  }

  async function loadRules() {
    try {
      const r = await apiRequest("/attendance-rules");
      allRules = unwrapData(r) || [];
      if (!editingRule && allRules.length > 0) editingRule = allRules[0];
      renderRules();
    } catch (err) {
      /* silent */
    }
  }

  function renderRules() {
    const list = document.getElementById("rules-list");
    if (!list) return;
    if (allRules.length === 0) {
      list.innerHTML = '<div class="rounded-xl border border-white/6 bg-white/2 p-8 text-center"><p class="text-2xl mb-2">📋</p><p class="text-sm text-slate-400">No attendance rules configured yet.</p><p class="text-xs text-slate-500 mt-1">Fill the form to create your first policy.</p></div>';
    } else {
      list.innerHTML = '<div class="space-y-3">' +
        allRules
          .map((r) => {
            const active = editingRule && editingRule.id === r.id;
            return `
          <div data-rule-id="${r.id}" class="rule-card cursor-pointer rounded-xl border p-4 transition ${active ? "border-violet-500/40 bg-violet-500/5" : "border-slate-800 bg-slate-900/60 hover:border-slate-700"}">
            <div class="flex items-center justify-between mb-2">
              <span class="font-medium text-sm">Office #${r.office_id}</span>
              ${active ? '<span class="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">Editing</span>' : ""}
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs text-slate-400">
              <div><p class="text-slate-500">Grace</p><p class="font-medium">${r.grace_minutes} min</p></div>
              <div><p class="text-slate-500">Full day</p><p class="font-medium">${r.min_hours_for_full_day} hrs</p></div>
              <div><p class="text-slate-500">Late deduct</p><p class="font-medium">${r.late_deduction_after_n_days === 0 ? "Off" : `After ${r.late_deduction_after_n_days}`}</p></div>
            </div>
          </div>`;
          })
          .join("") +
        "</div>";
      list.querySelectorAll(".rule-card").forEach((el) =>
        el.addEventListener("click", () => {
          editingRule = allRules.find((r) => r.id === Number(el.dataset.ruleId));
          renderRules();
          fillRuleForm();
        })
      );
    }
    fillRuleForm();
  }

  function fillRuleForm() {
    const form = document.getElementById("rule-form");
    if (!form) return;
    document.getElementById("rule-office-id").value = editingRule ? editingRule.office_id : "";
    form.grace_minutes.value = editingRule ? editingRule.grace_minutes : 15;
    form.min_hours_for_full_day.value = editingRule ? editingRule.min_hours_for_full_day : 8;
    form.late_deduction_after_n_days.value = editingRule ? editingRule.late_deduction_after_n_days : 0;
    document.getElementById("rule-form-title").textContent = editingRule ? `Edit Policy — Office #${editingRule.office_id}` : "New Attendance Policy";
    document.getElementById("rule-new-btn").hidden = !editingRule;
  }

  document.addEventListener("DOMContentLoaded", () => {
    currentMonth = new Date().toISOString().slice(0, 7);
    document.getElementById("month-input").value = currentMonth;
    loadMonthly();
    loadEmployeeOptions();
    if (document.getElementById("rules-list")) loadRules();

    document.getElementById("att-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn) switchTab(btn.dataset.tab);
    });

    document.getElementById("month-input").addEventListener("change", (e) => {
      currentMonth = e.target.value;
      loadMonthly();
    });
    document.getElementById("export-csv-btn").addEventListener("click", exportCSV);

    document.getElementById("clockin-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const empId = searchSelect("ss-clockin-employee")?.getValue();
      const isWfh = e.target.is_wfh.checked;
      const btn = document.getElementById("clockin-btn");
      const spinner = document.getElementById("clockin-btn-spinner");
      const label = document.getElementById("clockin-btn-label");
      btn.disabled = true;
      spinner.hidden = false;
      label.textContent = "Recording…";
      try {
        await apiRequest("/attendance/clock-in", {
          method: "POST",
          body: JSON.stringify({ employee_id: Number(empId), method: isWfh ? "wfh" : "manual", is_wfh: isWfh }),
        });
        pushToast("Clock-in recorded", "success");
        loadMonthly();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
        spinner.hidden = true;
        label.textContent = "Record Clock-In";
      }
    });

    document.getElementById("clockout-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const empId = searchSelect("ss-clockout-employee")?.getValue();
      const btn = document.getElementById("clockout-btn");
      const spinner = document.getElementById("clockout-btn-spinner");
      const label = document.getElementById("clockout-btn-label");
      btn.disabled = true;
      spinner.hidden = false;
      label.textContent = "Recording…";
      try {
        await apiRequest("/attendance/clock-out", { method: "POST", body: JSON.stringify({ employee_id: Number(empId) }) });
        pushToast("Clock-out recorded", "success");
        loadMonthly();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
        spinner.hidden = true;
        label.textContent = "Record Clock-Out";
      }
    });

    const missingPunchBtn = document.getElementById("missing-punch-btn");
    if (missingPunchBtn) {
      missingPunchBtn.addEventListener("click", async () => {
        try {
          const r = await apiRequest("/attendance/rules/missing-punch-check", { method: "POST" });
          const data = unwrapData(r);
          pushToast(`Missing punch check complete — ${data.checked} records checked`, "success");
        } catch (err) {
          pushToast(err.message || "Error", "error");
        }
      });
    }

    const ruleForm = document.getElementById("rule-form");
    if (ruleForm) {
      ruleForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(ruleForm);
        const btn = document.getElementById("rule-save-btn");
        const spinner = document.getElementById("rule-save-spinner");
        const label = document.getElementById("rule-save-label");
        btn.disabled = true;
        spinner.hidden = false;
        label.textContent = "Saving…";
        try {
          await apiRequest("/attendance-rules", {
            method: "POST",
            body: JSON.stringify({
              office_id: editingRule ? editingRule.office_id : 1,
              grace_minutes: Number(fd.get("grace_minutes") || 0),
              min_hours_for_full_day: Number(fd.get("min_hours_for_full_day") || 8),
              late_deduction_after_n_days: Number(fd.get("late_deduction_after_n_days") || 0),
            }),
          });
          pushToast("Attendance rule saved", "success");
          loadRules();
        } catch (err) {
          pushToast(err.message || "Error", "error");
        } finally {
          btn.disabled = false;
          spinner.hidden = true;
          label.textContent = "Save Policy";
        }
      });
      document.getElementById("rule-new-btn").addEventListener("click", () => {
        editingRule = null;
        renderRules();
      });
    }
  });
})();
