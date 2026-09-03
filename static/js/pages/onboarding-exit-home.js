(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  const STATUS_BADGE = {
    pending: "bg-amber-500/20 text-amber-300", completed: "bg-emerald-500/20 text-emerald-300",
    overdue: "bg-rose-500/20 text-rose-300", active: "bg-blue-500/20 text-blue-300",
    cleared: "bg-emerald-500/20 text-emerald-300", finalized: "bg-purple-500/20 text-purple-300",
  };
  function statusBadgeClass(s) {
    return STATUS_BADGE[s] || "bg-slate-700 text-slate-300";
  }

  let tasks = [];
  let exits = [];
  const settlements = {};

  function switchTab(tab) {
    document.querySelectorAll("#oe-tab-bar .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }

  async function load() {
    try {
      const [t, e] = await Promise.all([apiRequest("/onboarding-tasks"), apiRequest("/exit-workflows")]);
      tasks = unwrapData(t)?.data || [];
      exits = unwrapData(e)?.data || [];
      renderTasks();
      renderExits();
    } catch (err) {
      /* silent, matches original */
    }
  }

  function renderTasks() {
    const pending = tasks.filter((t) => t.status !== "completed");
    const completed = tasks.filter((t) => t.status === "completed");

    document.getElementById("pending-count").textContent = pending.length;
    const badge = document.getElementById("pending-count-badge");
    if (pending.length > 0) {
      badge.hidden = false;
      badge.textContent = pending.length;
    } else {
      badge.hidden = true;
    }

    const pendingList = document.getElementById("pending-tasks-list");
    if (pending.length === 0) {
      pendingList.innerHTML = '<p class="text-sm text-slate-500">No pending tasks.</p>';
    } else {
      pendingList.innerHTML = "";
      pending.forEach((t) => {
        const div = document.createElement("div");
        div.className = "rounded-lg border border-white/8 bg-white/3 p-4 flex items-start justify-between";
        div.innerHTML = `
          <div>
            <p class="font-medium text-sm">${esc(t.title)}</p>
            <p class="text-xs text-slate-400 mt-0.5">Employee #${t.employee_id}${t.due_date ? ` · Due ${t.due_date}` : ""}${t.assigned_to ? ` · Assigned to ${esc(t.assigned_to)}` : ""}</p>
          </div>
          <div class="flex items-center gap-2 ml-3">
            <span class="rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(t.status)}">${esc(t.status)}</span>
            <button data-id="${t.id}" class="complete-task-btn rounded border border-emerald-700/50 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-700/20 transition">Mark Done</button>
          </div>`;
        pendingList.appendChild(div);
      });
      pendingList.querySelectorAll(".complete-task-btn").forEach((btn) =>
        btn.addEventListener("click", async () => {
          try {
            await apiRequest(`/onboarding-tasks/${btn.dataset.id}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
            pushToast("Task completed", "success");
            load();
          } catch (err) {
            pushToast(err.message || "Error", "error");
          }
        })
      );
    }

    const completedSection = document.getElementById("completed-tasks-section");
    document.getElementById("completed-count").textContent = completed.length;
    if (completed.length > 0) {
      completedSection.hidden = false;
      const list = document.getElementById("completed-tasks-list");
      list.innerHTML = "";
      completed.forEach((t) => {
        const div = document.createElement("div");
        div.className = "rounded-lg border border-white/6 bg-white/2 p-3 flex items-center justify-between opacity-60";
        div.innerHTML = `<p class="text-sm line-through">${esc(t.title)}</p><span class="text-xs text-emerald-400">✓</span>`;
        list.appendChild(div);
      });
    } else {
      completedSection.hidden = true;
    }
  }

  function renderExits() {
    document.getElementById("exit-count").textContent = exits.length;
    const list = document.getElementById("exits-list");
    if (exits.length === 0) {
      list.innerHTML = '<p class="text-sm text-slate-500">No active exit workflows.</p>';
      return;
    }
    list.innerHTML = "";
    exits.forEach((ex) => {
      const div = document.createElement("div");
      div.className = "rounded-xl border border-white/8 bg-white/3 p-5";
      const hasSettlement = !!settlements[ex.id];
      div.innerHTML = `
        <div class="flex items-start justify-between">
          <div>
            <span class="font-semibold">Employee #${ex.employee_id}</span>
            <span class="ml-2 text-sm text-slate-400 capitalize">${esc(ex.exit_type)}</span>
            <div class="mt-1 text-xs text-slate-400">Last working day: ${ex.last_working_date || ""}</div>
          </div>
          <span class="rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(ex.status)}">${ex.status || ""}</span>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          ${ex.status !== "finalized" ? `<button data-id="${ex.id}" class="calc-settlement-btn rounded border border-white/10 px-3 py-1.5 text-xs hover:border-cyan-500 transition">Calculate Settlement</button>` : ""}
          ${hasSettlement && ex.status !== "finalized" ? `<button data-id="${ex.id}" class="finalize-settlement-btn rounded border border-emerald-700/50 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-700/20 transition">Finalize Settlement</button>` : ""}
        </div>
        ${
          hasSettlement
            ? `<div class="mt-3 rounded border border-white/8 bg-black/20 p-3 text-xs text-slate-300"><p class="font-semibold mb-1 text-slate-200">Settlement Summary</p><pre class="whitespace-pre-wrap">${esc(JSON.stringify(settlements[ex.id], null, 2))}</pre></div>`
            : ""
        }`;
      list.appendChild(div);
    });

    list.querySelectorAll(".calc-settlement-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          const r = await apiRequest(`/exit-workflows/${btn.dataset.id}/calculate-settlement`, { method: "POST" });
          settlements[btn.dataset.id] = unwrapData(r);
          pushToast("Settlement calculated", "success");
          await load();
        } catch (err) {
          pushToast(err.message || "Error", "error");
        }
      })
    );
    list.querySelectorAll(".finalize-settlement-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await apiRequest(`/exit-workflows/${btn.dataset.id}/finalize-settlement`, { method: "POST" });
          pushToast("Settlement finalized", "success");
          load();
        } catch (err) {
          pushToast(err.message || "Error", "error");
        }
      })
    );
  }

  async function loadEmployeeOptions() {
    try {
      const r = await apiRequest("/employees?per_page=500");
      const list = unwrapData(r)?.data || [];
      const options = list.map((e) => ({ value: String(e.id), label: e.full_name, sub: [e.employee_code, e.designation].filter(Boolean).join(" · ") }));
      searchSelect("ss-onboard-employee")?.setOptions(options);
      searchSelect("ss-exit-employee")?.setOptions(options);
    } catch (err) {
      /* silent */
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    loadEmployeeOptions();

    document.getElementById("oe-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn) switchTab(btn.dataset.tab);
    });

    document.getElementById("task-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const empId = searchSelect("ss-onboard-employee")?.getValue();
      if (!empId) {
        pushToast("Select an employee", "error");
        return;
      }
      const fd = new FormData(e.target);
      const btn = document.getElementById("task-save-btn");
      btn.disabled = true;
      try {
        await apiRequest("/onboarding-tasks", {
          method: "POST",
          body: JSON.stringify({
            employee_id: Number(empId), title: fd.get("title"),
            due_date: fd.get("due_date") || undefined, assigned_to: fd.get("assigned_to") || undefined,
          }),
        });
        pushToast("Onboarding task created", "success");
        e.target.reset();
        load();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("exit-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const empId = searchSelect("ss-exit-employee")?.getValue();
      if (!empId) {
        pushToast("Select an employee", "error");
        return;
      }
      const fd = new FormData(e.target);
      const btn = document.getElementById("exit-save-btn");
      btn.disabled = true;
      try {
        await apiRequest("/exit-workflows", {
          method: "POST",
          body: JSON.stringify({
            employee_id: Number(empId), exit_type: fd.get("exit_type"), last_working_date: fd.get("last_working_date"),
            notice_period_days: fd.get("notice_period_days") ? Number(fd.get("notice_period_days")) : undefined,
          }),
        });
        pushToast("Exit workflow created", "success");
        e.target.reset();
        load();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
