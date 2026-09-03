/**
 * Pixel-precise port of app/dashboard/organization/offices/{page,create/page}.tsx,
 * rebuilt against the real /offices endpoint (see templates/organization/offices.html).
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  const TIMEZONES = ["UTC", "Asia/Karachi", "Asia/Dubai", "America/New_York", "Europe/London", "Asia/Singapore"];

  let offices = [];

  async function load() {
    const wrap = document.getElementById("office-grid-wrap");
    try {
      const r = await apiRequest("/offices?per_page=100");
      offices = unwrapData(r)?.data || [];
      render();
    } catch (err) {
      wrap.innerHTML = `<p class="text-sm text-rose-400">${esc(err.message || "Failed to load offices")}</p>`;
    }
  }

  function render() {
    const wrap = document.getElementById("office-grid-wrap");
    if (offices.length === 0) {
      wrap.innerHTML = `
        <div class="text-center py-16 stat-card rounded-2xl">
          <p class="text-slate-400 mb-3">No offices created yet</p>
          <button id="office-empty-new" class="text-sm text-violet-400 hover:text-violet-300 transition">Create your first office →</button>
        </div>`;
      document.getElementById("office-empty-new").addEventListener("click", openNew);
      return;
    }
    wrap.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"></div>';
    const grid = wrap.firstElementChild;
    offices.forEach((o) => {
      const card = document.createElement("div");
      card.className = "stat-card rounded-2xl";
      card.innerHTML = `
        <div class="flex items-start justify-between mb-3">
          <div><h3 class="font-semibold text-slate-100">${esc(o.name)}</h3><p class="text-sm text-slate-500">${esc(o.city)}, ${esc(o.country_code)}</p></div>
          <span class="badge ${o.is_default ? "badge-green" : "badge-slate"}">${o.is_default ? "Default" : "Office"}</span>
        </div>
        <p class="text-xs text-slate-500 mb-4">Timezone: ${esc(o.timezone || "—")}</p>
        <div class="flex gap-2">
          <button data-id="${o.id}" class="office-edit-btn btn-secondary flex-1 rounded-xl py-2 text-xs text-center">Edit</button>
          <button data-id="${o.id}" class="office-delete-btn flex-1 rounded-xl py-2 text-xs border border-red-500/20 bg-red-500/8 text-red-400 hover:bg-red-500/18 transition">Delete</button>
        </div>`;
      grid.appendChild(card);
    });
    grid.querySelectorAll(".office-edit-btn").forEach((btn) =>
      btn.addEventListener("click", () => openForm(offices.find((o) => o.id === Number(btn.dataset.id))))
    );
    grid.querySelectorAll(".office-delete-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this office?")) return;
        try {
          await apiRequest(`/offices/${btn.dataset.id}`, { method: "DELETE" });
          pushToast("Office deleted", "success");
          offices = offices.filter((o) => o.id !== Number(btn.dataset.id));
          render();
        } catch (err) {
          pushToast(err.message || "Failed to delete office", "error");
        }
      })
    );
  }

  function openNew() {
    openForm(null);
  }

  function openForm(office) {
    const backdrop = document.getElementById("office-form-backdrop");
    const isEdit = !!office;
    backdrop.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" id="office-form-close"></div>
        <div class="relative w-full max-w-2xl glass rounded-2xl p-8 shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto">
          <div class="page-header"><h1>${isEdit ? "Edit Office" : "Create Office"}</h1><p>${isEdit ? "Update this office location" : "Add a new office location to your organization"}</p></div>
          <form id="office-form" class="form-section space-y-5 mt-4">
            <div><label class="form-label">Office Name *</label><input type="text" name="name" required class="form-input" placeholder="e.g., Headquarters"></div>
            <div><label class="form-label">Address</label><input type="text" name="address" class="form-input" placeholder="123 Main Street"></div>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="form-label">City *</label><input type="text" name="city" required class="form-input" placeholder="e.g., Karachi"></div>
              <div><label class="form-label">Country Code *</label><input type="text" name="country_code" required maxlength="2" class="form-input uppercase" placeholder="e.g., PK"></div>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div><label class="form-label">Latitude</label><input type="number" name="latitude" step="0.000001" min="-90" max="90" class="form-input" placeholder="24.8607"></div>
              <div><label class="form-label">Longitude</label><input type="number" name="longitude" step="0.000001" min="-180" max="180" class="form-input" placeholder="67.0104"></div>
              <div><label class="form-label">Radius (m)</label><input type="number" name="attendance_radius_m" min="0" max="10000" class="form-input" placeholder="100"></div>
            </div>
            <div><label class="form-label">Timezone</label><select name="timezone" class="form-select">${TIMEZONES.map((tz) => `<option value="${tz}">${tz}</option>`).join("")}</select></div>
            <div><label class="form-label">Monthly WFH Cap (days)</label><input type="number" name="wfh_monthly_cap" min="0" class="form-input" placeholder="Optional"></div>
            <label class="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" name="is_default" class="h-4 w-4 accent-violet-500">
              <span class="text-sm text-slate-300">Default office</span>
            </label>
            <div class="flex gap-3 pt-2">
              <button type="submit" class="btn-primary flex-1 rounded-xl py-3 text-sm disabled:opacity-50" id="office-save-btn"><span id="office-save-label">${isEdit ? "Update Office" : "Create Office"}</span></button>
              <button type="button" id="office-cancel-btn" class="btn-secondary flex-none rounded-xl px-6 py-3 text-sm text-center">Cancel</button>
            </div>
          </form>
        </div>
      </div>`;

    const form = document.getElementById("office-form");
    if (isEdit) {
      form.name.value = office.name;
      form.address.value = office.address || "";
      form.city.value = office.city;
      form.country_code.value = office.country_code;
      form.latitude.value = office.latitude ?? "";
      form.longitude.value = office.longitude ?? "";
      form.attendance_radius_m.value = office.attendance_radius_m ?? "";
      form.timezone.value = office.timezone || "UTC";
      form.wfh_monthly_cap.value = office.wfh_monthly_cap ?? "";
      form.is_default.checked = !!office.is_default;
    }

    const close = () => (backdrop.innerHTML = "");
    document.getElementById("office-form-close").addEventListener("click", close);
    document.getElementById("office-cancel-btn").addEventListener("click", close);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const payload = {
        name: fd.get("name"),
        address: fd.get("address") || null,
        city: fd.get("city"),
        country_code: (fd.get("country_code") || "").toUpperCase(),
        latitude: fd.get("latitude") || null,
        longitude: fd.get("longitude") || null,
        attendance_radius_m: fd.get("attendance_radius_m") || null,
        timezone: fd.get("timezone") || "UTC",
        wfh_monthly_cap: fd.get("wfh_monthly_cap") || null,
        is_default: fd.get("is_default") === "on",
      };
      const btn = document.getElementById("office-save-btn");
      const label = document.getElementById("office-save-label");
      btn.disabled = true;
      label.textContent = isEdit ? "Updating…" : "Creating…";
      try {
        if (isEdit) {
          await apiRequest(`/offices/${office.id}`, { method: "PATCH", body: JSON.stringify(payload) });
          pushToast("Office updated", "success");
        } else {
          await apiRequest("/offices", { method: "POST", body: JSON.stringify(payload) });
          pushToast("Office created", "success");
        }
        close();
        load();
      } catch (err) {
        pushToast(err.message || "Failed to save office", "error");
        btn.disabled = false;
        label.textContent = isEdit ? "Update Office" : "Create Office";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    document.getElementById("office-new-btn").addEventListener("click", openNew);
  });
})();
