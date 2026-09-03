(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  let designations = [];

  async function load() {
    try {
      const [dr, er] = await Promise.allSettled([apiRequest("/designations"), apiRequest("/employees?per_page=200")]);
      if (dr.status === "fulfilled") {
        designations = unwrapData(dr.value) || [];
        renderDesignationSelect();
      }
      if (er.status === "fulfilled") {
        const employees = unwrapData(er.value)?.data || [];
        renderEmployees(employees);
        searchSelect("ss-promote-employee")?.setOptions(
          employees.map((e) => ({ value: String(e.id), label: e.full_name, sub: [e.employee_code, e.designation].filter(Boolean).join(" · ") }))
        );
      }
    } catch (err) {
      /* silent, matches original */
    }
  }

  function renderEmployees(employees) {
    const list = document.getElementById("employees-list");
    list.innerHTML = "";
    employees.slice(0, 8).forEach((emp) => {
      const div = document.createElement("div");
      div.className = "flex items-center justify-between rounded-lg border border-white/6 bg-white/3 px-4 py-2.5";
      div.innerHTML = `
        <div><p class="text-sm font-medium text-slate-200">${esc(emp.full_name)}</p><p class="text-xs text-slate-500 font-mono">${esc(emp.employee_code)}</p></div>
        <span class="text-xs text-slate-400">${emp.designation ? esc(emp.designation) : '<em class="text-slate-600">unassigned</em>'}</span>`;
      list.appendChild(div);
    });
  }

  function renderDesignationSelect() {
    const select = document.getElementById("designation-select");
    select.innerHTML =
      '<option value="">— Select designation —</option>' +
      designations
        .filter((d) => d.is_active)
        .map((d) => `<option value="${d.id}">${esc(d.title)}${d.grade ? ` (${esc(d.grade)})` : ""}</option>`)
        .join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("effective-from-input").value = new Date().toISOString().split("T")[0];
    load();

    document.getElementById("designation-select").addEventListener("change", (e) => {
      document.getElementById("err-designation_id").hidden = true;
      const d = designations.find((x) => String(x.id) === e.target.value);
      const preview = document.getElementById("designation-preview");
      if (d) {
        preview.hidden = false;
        preview.innerHTML = `<span class="font-semibold">${esc(d.title)}</span>${d.grade ? `<span class="ml-2 text-violet-400/70">Grade ${esc(d.grade)}</span>` : ""}`;
      } else {
        preview.hidden = true;
      }
    });

    document.getElementById("promote-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const employeeId = searchSelect("ss-promote-employee")?.getValue();
      const designationId = document.getElementById("designation-select").value;
      const effectiveFrom = document.getElementById("effective-from-input").value;

      let hasError = false;
      document.getElementById("err-employee_id").hidden = !!employeeId;
      document.getElementById("err-designation_id").hidden = !!designationId;
      document.getElementById("err-effective_from").hidden = !!effectiveFrom;
      if (!employeeId || !designationId || !effectiveFrom) hasError = true;
      if (hasError) return;

      const fd = new FormData(e.target);
      const btn = document.getElementById("promote-save-btn");
      const spinner = document.getElementById("promote-save-spinner");
      const label = document.getElementById("promote-save-label");
      btn.disabled = true;
      spinner.hidden = false;
      label.textContent = "Processing…";
      try {
        await apiRequest("/designations/assign", {
          method: "POST",
          body: JSON.stringify({
            employee_id: Number(employeeId),
            designation_id: Number(designationId),
            effective_from: effectiveFrom,
            gross_monthly: fd.get("gross_monthly") ? Number(fd.get("gross_monthly")) : null,
            currency: fd.get("currency"),
          }),
        });
        pushToast("Designation assigned — promotion recorded", "success");
        searchSelect("ss-promote-employee")?.setValue("");
        document.getElementById("designation-select").value = "";
        document.getElementById("designation-preview").hidden = true;
        e.target.reset();
        document.getElementById("effective-from-input").value = new Date().toISOString().split("T")[0];
        load();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
        spinner.hidden = true;
        label.textContent = "Record Promotion";
      }
    });
  });
})();
