(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }
  const TYPE_BADGE = { public: "bg-emerald-500/20 text-emerald-300", optional: "bg-amber-500/20 text-amber-300", restricted: "bg-rose-500/20 text-rose-300" };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  let holidays = [];
  let editHoliday = null;

  function switchTab(tab) {
    document.querySelectorAll("#hs-tab-bar .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }

  async function loadHolidays() {
    const year = document.getElementById("year-filter").value;
    try {
      const r = await apiRequest(`/holidays?year=${year}`);
      holidays = unwrapData(r) || [];
      renderHolidays();
    } catch (err) {
      /* silent, matches original */
    }
  }

  function renderHolidays() {
    document.getElementById("holiday-count").textContent = holidays.length;
    const grid = document.getElementById("holiday-calendar");
    grid.innerHTML = "";
    MONTHS.forEach((month, mi) => {
      const monthHolidays = holidays.filter((h) => new Date(h.holiday_date).getMonth() === mi);
      const card = document.createElement("div");
      card.className = "rounded-xl border border-white/8 bg-white/3 p-4";
      let body;
      if (monthHolidays.length === 0) {
        body = '<p class="text-xs text-slate-600">No holidays</p>';
      } else {
        body =
          '<div class="space-y-1.5">' +
          monthHolidays
            .map(
              (h) => `
          <div class="flex items-center justify-between">
            <div><span class="text-xs font-medium">${new Date(h.holiday_date).getDate()} — ${esc(h.name)}</span>${h.is_recurring ? '<span class="ml-1 text-[10px] text-slate-500">↺</span>' : ""}</div>
            <div class="flex items-center gap-1.5">
              <span class="rounded-full px-1.5 py-0.5 text-[10px] ${TYPE_BADGE[h.holiday_type] || "bg-slate-700 text-slate-300"}">${esc((h.holiday_type || "?")[0].toUpperCase())}</span>
              <button data-id="${h.id}" class="edit-holiday-btn text-[10px] text-cyan-400 hover:underline">Edit</button>
              <button data-id="${h.id}" class="del-holiday-btn text-[10px] text-rose-400 hover:underline">Del</button>
            </div>
          </div>`
            )
            .join("") +
          "</div>";
      }
      card.innerHTML = `<h3 class="font-semibold text-sm text-slate-300 mb-2">${month}</h3>${body}`;
      grid.appendChild(card);
    });

    grid.querySelectorAll(".edit-holiday-btn").forEach((btn) => btn.addEventListener("click", () => openHolidayForm(holidays.find((h) => h.id === Number(btn.dataset.id)))));
    grid.querySelectorAll(".del-holiday-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this holiday?")) return;
        try {
          await apiRequest(`/holidays/${btn.dataset.id}`, { method: "DELETE" });
          pushToast("Holiday deleted", "success");
          loadHolidays();
        } catch (err) {
          pushToast(err.message || "Error", "error");
        }
      })
    );
  }

  function openHolidayForm(holiday) {
    editHoliday = holiday || null;
    const form = document.getElementById("holiday-form");
    form.hidden = false;
    document.getElementById("holiday-form-title").textContent = editHoliday ? "Edit Holiday" : "New Holiday";
    document.getElementById("holiday-id").value = editHoliday ? editHoliday.id : "";
    form.name.value = editHoliday ? editHoliday.name : "";
    form.holiday_date.value = editHoliday ? editHoliday.holiday_date : "";
    form.holiday_type.value = editHoliday ? editHoliday.holiday_type : "public";
    form.office_id.value = editHoliday && editHoliday.office_id != null ? editHoliday.office_id : "";
    form.is_recurring.checked = !!(editHoliday && editHoliday.is_recurring);
  }

  async function loadShifts() {
    try {
      const r = await apiRequest("/shifts");
      const shifts = unwrapData(r)?.data || [];
      renderShifts(shifts);
    } catch (err) {
      /* silent */
    }
  }

  function renderShifts(shifts) {
    const list = document.getElementById("shifts-list");
    if (shifts.length === 0) {
      list.innerHTML = '<p class="text-sm text-slate-500">No shifts defined yet.</p>';
      return;
    }
    list.innerHTML = "";
    shifts.forEach((s) => {
      const card = document.createElement("div");
      card.className = "rounded-xl border border-white/8 bg-white/3 p-4";
      card.innerHTML = `
        <p class="font-semibold">${esc(s.name)}</p>
        <p class="text-sm text-slate-400 mt-1">${esc(s.start_time)} → ${esc(s.end_time)}</p>
        <div class="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
          <span>OT after: ${s.overtime_after_hours ?? 8}h</span>
          <span>OT rate: ${s.overtime_multiplier ?? 1.5}×</span>
          ${s.night_diff_multiplier && s.night_diff_multiplier > 0 ? `<span class="col-span-2">Night diff: ${s.night_diff_multiplier}×</span>` : ""}
        </div>`;
      list.appendChild(card);
    });
  }

  async function loadEmployeeOptions() {
    try {
      const r = await apiRequest("/employees?per_page=500");
      const list = unwrapData(r)?.data || [];
      const options = list.map((e) => ({ value: String(e.id), label: e.full_name, sub: [e.employee_code, e.designation].filter(Boolean).join(" · ") }));
      searchSelect("ss-swap-from")?.setOptions(options);
      searchSelect("ss-swap-to")?.setOptions(options);
    } catch (err) {
      /* silent */
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadHolidays();
    loadShifts();
    loadEmployeeOptions();

    document.getElementById("hs-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn) switchTab(btn.dataset.tab);
    });
    document.getElementById("year-filter").addEventListener("change", loadHolidays);
    document.getElementById("add-holiday-btn").addEventListener("click", () => openHolidayForm(null));
    document.getElementById("holiday-cancel-btn").addEventListener("click", () => {
      document.getElementById("holiday-form").hidden = true;
      editHoliday = null;
    });
    document.getElementById("holiday-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        name: fd.get("name"),
        holiday_date: fd.get("holiday_date"),
        holiday_type: fd.get("holiday_type"),
        is_recurring: fd.get("is_recurring") === "on",
        office_id: fd.get("office_id") ? Number(fd.get("office_id")) : null,
      };
      const btn = document.getElementById("holiday-save-btn");
      btn.disabled = true;
      try {
        if (editHoliday) {
          await apiRequest(`/holidays/${editHoliday.id}`, { method: "PATCH", body: JSON.stringify(payload) });
          pushToast("Holiday updated", "success");
        } else {
          await apiRequest("/holidays", { method: "POST", body: JSON.stringify(payload) });
          pushToast("Holiday created", "success");
        }
        document.getElementById("holiday-form").hidden = true;
        editHoliday = null;
        loadHolidays();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("shift-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = document.getElementById("shift-save-btn");
      btn.disabled = true;
      try {
        await apiRequest("/shifts", {
          method: "POST",
          body: JSON.stringify({
            name: fd.get("name"),
            start_time: fd.get("start_time"),
            end_time: fd.get("end_time"),
            overtime_after_hours: Number(fd.get("overtime_after_hours") || 8),
            overtime_multiplier: Number(fd.get("overtime_multiplier") || 1.5),
            night_diff_multiplier: fd.get("night_diff_multiplier") ? Number(fd.get("night_diff_multiplier")) : null,
          }),
        });
        pushToast("Shift created", "success");
        e.target.reset();
        loadShifts();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById("swap-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fromId = searchSelect("ss-swap-from")?.getValue();
      const toId = searchSelect("ss-swap-to")?.getValue();
      if (!fromId || !toId) {
        pushToast("Select both employees", "error");
        return;
      }
      const fd = new FormData(e.target);
      const btn = document.getElementById("swap-save-btn");
      btn.disabled = true;
      try {
        await apiRequest("/shift-swaps", {
          method: "POST",
          body: JSON.stringify({ from_employee_id: Number(fromId), to_employee_id: Number(toId), swap_date: fd.get("swap_date") }),
        });
        pushToast("Swap requested", "success");
        e.target.reset();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
