/**
 * Port of saas-hrms-frontend/app/dashboard/employees/create/page.tsx.
 */
(function () {
  function validate(data) {
    const errors = {};
    if (!data.full_name.trim()) errors.full_name = "Full name is required";
    else if (data.full_name.trim().length < 2) errors.full_name = "Name must be at least 2 characters";
    if (!data.email.trim()) errors.email = "Email is required";
    else if (!/.+@.+\..+/.test(data.email)) errors.email = "Enter a valid email address";
    if (!data.hire_date) errors.hire_date = "Hire date is required";
    return errors;
  }

  function showErrors(errors) {
    ["full_name", "email", "hire_date"].forEach((f) => {
      const el = document.getElementById(`error-${f}`);
      const field = document.getElementById(`field-${f}`);
      if (errors[f]) {
        el.hidden = false;
        el.textContent = errors[f];
        field.classList.add("!border-rose-500/60");
      } else {
        el.hidden = true;
        field.classList.remove("!border-rose-500/60");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("create-employee-form");
    const submitBtn = document.getElementById("submit-btn");
    const formError = document.getElementById("form-error");
    const hireDateField = document.getElementById("field-hire_date");
    hireDateField.value = new Date().toISOString().split("T")[0];

    // Trial-limit guard
    apiRequest("/organizations/me")
      .then((r) => {
        const org = unwrapData(r);
        const limit = org.trial_user_limit != null ? Number(org.trial_user_limit) : null;
        if (limit === null) return;
        return apiRequest("/employees?per_page=1").then((er) => {
          const total = unwrapData(er).total || 0;
          if (total >= limit) window.location.href = "/dashboard/employees/?limit_reached=1";
        });
      })
      .catch(() => {});

    // Populate dropdowns in parallel
    apiRequest("/designations")
      .then((r) => {
        const list = unwrapData(r) || [];
        const active = list.filter((d) => d.is_active);
        searchSelect("ss-designation_id").setOptions(
          active.map((d) => ({ value: String(d.id), label: d.title, sub: d.grade ? `Grade ${d.grade}` : undefined }))
        );
      })
      .catch(() => {});

    apiRequest("/shifts")
      .then((r) => {
        const d = unwrapData(r);
        const list = d.data || d || [];
        searchSelect("ss-shift_id").setOptions(
          list.map((s) => ({ value: String(s.id), label: s.name, sub: `${s.start_time} – ${s.end_time}` }))
        );
      })
      .catch(() => {});

    apiRequest("/leave-policies")
      .then((r) => {
        const list = unwrapData(r) || [];
        if (list.length === 0) document.getElementById("no-policies-hint").hidden = false;
        searchSelect("ss-leave_policy_id").setOptions(
          list.map((p) => ({ value: String(p.id), label: p.name, sub: p.description || undefined }))
        );
      })
      .catch(() => {
        document.getElementById("no-policies-hint").hidden = false;
      });

    apiRequest("/employees?per_page=100")
      .then((r) => {
        const list = unwrapData(r).data || [];
        searchSelect("ss-reporting_manager_id").setOptions(
          list.map((m) => ({
            value: String(m.id),
            label: m.full_name,
            sub: `${m.employee_code}${m.designation ? ` · ${m.designation}` : ""}`,
          }))
        );
      })
      .catch(() => {});

    apiRequest("/departments?per_page=100")
      .then((r) => {
        const d = unwrapData(r);
        const list = (d.data || d || []).filter((x) => x.is_active !== false);
        searchSelect("ss-department_id").setOptions(list.map((d2) => ({ value: String(d2.id), label: d2.name, sub: d2.code })));
      })
      .catch(() => {});

    document.getElementById("ss-reporting_manager_id").addEventListener("change", (e) => {
      document.getElementById("manager-hint").hidden = !e.target.value;
    }, true);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = {
        full_name: fd.get("full_name") || "",
        email: fd.get("email") || "",
        phone: fd.get("phone") || "",
        hire_date: fd.get("hire_date") || "",
        employment_status: fd.get("employment_status") || "active",
        gross_monthly: fd.get("gross_monthly") || "",
        currency: fd.get("currency") || "PKR",
        designation_id: searchSelect("ss-designation_id").getValue(),
        department_id: searchSelect("ss-department_id").getValue(),
        reporting_manager_id: searchSelect("ss-reporting_manager_id").getValue(),
        shift_id: searchSelect("ss-shift_id").getValue(),
        leave_policy_id: searchSelect("ss-leave_policy_id").getValue(),
      };

      const errors = validate(data);
      showErrors(errors);
      if (Object.keys(errors).length) return;

      formError.hidden = true;
      submitBtn.disabled = true;
      submitBtn.querySelector("span").textContent = "Creating…";

      try {
        await apiRequest("/employees", {
          method: "POST",
          body: JSON.stringify({
            ...data,
            designation_id: data.designation_id ? Number(data.designation_id) : null,
            department_id: data.department_id ? Number(data.department_id) : null,
            reporting_manager_id: data.reporting_manager_id ? Number(data.reporting_manager_id) : null,
            shift_id: data.shift_id ? Number(data.shift_id) : null,
            leave_policy_id: data.leave_policy_id ? Number(data.leave_policy_id) : null,
            gross_monthly: data.gross_monthly ? Number(data.gross_monthly) : null,
          }),
        });
        window.location.href = "/dashboard/employees/";
      } catch (err) {
        formError.hidden = false;
        formError.textContent = err.message || "Failed to create employee";
        submitBtn.disabled = false;
        submitBtn.querySelector("span").textContent = "Create Employee";
      }
    });
  });
})();
