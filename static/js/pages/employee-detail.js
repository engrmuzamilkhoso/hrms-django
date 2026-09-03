/**
 * Port of saas-hrms-frontend/app/dashboard/employees/[id]/page.tsx (9 tabs:
 * Profile, Setup, Bank, Emergency, Education, Experience, Compensation,
 * Documents, Account).
 */
(function () {
  const root = document.getElementById("employee-detail-root");
  const empId = root.dataset.employeeId;
  let employee = null;
  let accountInfo = null;
  let accountFormType = "user";

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function showFieldErrors(form, errors) {
    form.querySelectorAll(".err").forEach((el) => (el.hidden = true));
    if (!errors) return;
    Object.entries(errors).forEach(([field, messages]) => {
      const el = form.querySelector(`.err[data-field="${field}"]`);
      if (el) {
        el.hidden = false;
        el.textContent = Array.isArray(messages) ? messages[0] : messages;
      }
    });
  }

  // ── Tabs ──────────────────────────────────────────────────────────────
  document.getElementById("tab-bar").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    if (tab === "account" && !accountInfo) loadAccount();
  });

  // ── Hero card ─────────────────────────────────────────────────────────
  function renderHero(e) {
    const initials = e.full_name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    document.getElementById("hero-initials").textContent = initials;
    document.getElementById("hero-name").textContent = e.full_name;
    const statusBadge = document.getElementById("hero-status");
    statusBadge.className = `badge ${e.employment_status === "active" ? "badge-green" : "badge-slate"}`;
    statusBadge.textContent = (e.employment_status || "").replace("_", " ");

    const meta = document.getElementById("hero-meta");
    meta.innerHTML = "";
    const metaParts = [
      [`<span class="font-mono text-slate-400">${esc(e.employee_code)}</span>`, true],
      [esc(e.email), !!e.email],
      [esc(e.phone), !!e.phone],
      [`📅 Hired ${esc(e.hire_date)}`, !!e.hire_date],
    ];
    metaParts.forEach(([html, cond]) => {
      if (cond) {
        const span = document.createElement("span");
        span.innerHTML = html;
        meta.appendChild(span);
      }
    });

    const chips = document.getElementById("hero-chips");
    chips.innerHTML = "";
    const chipDefs = [
      [e.designation, "🎯", "border-violet-500/25 bg-violet-500/10 text-violet-300"],
      [e.department && e.department.name, "🏢", "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"],
      [e.shift && e.shift.name, "🕐", "border-amber-500/25 bg-amber-500/10 text-amber-300"],
      [e.leave_policy && e.leave_policy.name, "📋", "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"],
      [e.reporting_manager && e.reporting_manager.full_name, "👤", "border-white/15 bg-white/5 text-slate-300"],
    ];
    chipDefs.forEach(([label, icon, cls]) => {
      if (label) {
        const span = document.createElement("span");
        span.className = `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`;
        span.innerHTML = `${icon} ${esc(label)}`;
        chips.appendChild(span);
      }
    });
  }

  function fillProfileForm(e) {
    const form = document.getElementById("profile-form");
    const fields = [
      "full_name", "email", "phone", "hire_date", "employment_status", "contract_type",
      "dob", "gender", "marital_status", "nationality", "national_id_no", "passport_no", "probation_end_date",
    ];
    fields.forEach((f) => {
      const el = form.elements[f];
      if (el) el.value = e[f] || "";
    });
  }

  // ── Load everything ──────────────────────────────────────────────────
  async function loadAll() {
    const results = await Promise.allSettled([
      apiRequest(`/employees/${empId}`),
      apiRequest(`/employees/${empId}/bank-accounts`),
      apiRequest(`/employees/${empId}/emergency-contacts`),
      apiRequest(`/employees/${empId}/education`),
      apiRequest(`/employees/${empId}/experience`),
      apiRequest(`/employees/${empId}/designation-history`),
      apiRequest(`/employee-documents?employee_id=${empId}`),
      apiRequest(`/shifts`),
      apiRequest(`/leave-policies`),
      apiRequest(`/employees?per_page=200`),
      apiRequest(`/designations`),
    ]);
    const [empR, bankR, emR, eduR, expR, compR, docR, shiftR, policyR, mgrR, desR] = results;

    document.getElementById("loading").hidden = true;

    if (empR.status !== "fulfilled") {
      document.getElementById("not-found").hidden = false;
      return;
    }
    document.getElementById("detail-content").hidden = false;

    employee = unwrapData(empR.value);
    renderHero(employee);
    fillProfileForm(employee);

    if (shiftR.status === "fulfilled") {
      const d = unwrapData(shiftR.value);
      const list = d.data || d || [];
      searchSelect("ss-setup-shift").setOptions(list.map((s) => ({ value: String(s.id), label: s.name, sub: `${s.start_time} – ${s.end_time}` })));
    }
    if (policyR.status === "fulfilled") {
      const list = unwrapData(policyR.value) || [];
      searchSelect("ss-setup-policy").setOptions(list.map((p) => ({ value: String(p.id), label: p.name, sub: p.description || undefined })));
    }
    let managers = [];
    if (mgrR.status === "fulfilled") {
      managers = (unwrapData(mgrR.value).data || []).filter((m) => String(m.id) !== String(empId));
      searchSelect("ss-setup-manager").setOptions(managers.map((m) => ({ value: String(m.id), label: m.full_name, sub: `${m.employee_code}${m.designation ? ` · ${m.designation}` : ""}` })));
    }
    searchSelect("ss-setup-manager").setValue(employee.reporting_manager_id || "");
    searchSelect("ss-setup-shift").setValue(employee.shift_id || "");
    searchSelect("ss-setup-policy").setValue(employee.leave_policy_id || "");

    if (bankR.status === "fulfilled") renderBanks(unwrapData(bankR.value) || []);
    if (emR.status === "fulfilled") renderEmergency(unwrapData(emR.value) || []);
    if (eduR.status === "fulfilled") renderEducation(unwrapData(eduR.value) || []);
    if (expR.status === "fulfilled") renderExperience(unwrapData(expR.value) || []);
    if (compR.status === "fulfilled") renderCompensation(unwrapData(compR.value) || []);
    if (docR.status === "fulfilled") renderDocuments((unwrapData(docR.value) || {}).data || []);

    if (desR.status === "fulfilled") {
      const list = unwrapData(desR.value) || [];
      const select = document.getElementById("comp-designation-select");
      list.filter((d) => d.is_active).forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.title + (d.grade ? ` (${d.grade})` : "");
        select.appendChild(opt);
      });
    }
  }

  // ── Profile ───────────────────────────────────────────────────────────
  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    const errors = {};
    if (!data.full_name.trim()) errors.full_name = "Full name is required.";
    if (!data.email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = "Enter a valid email address.";
    if (Object.keys(errors).length) {
      showFieldErrors(form, errors);
      return;
    }
    showFieldErrors(form, null);

    const btn = document.getElementById("profile-save-btn");
    btn.disabled = true;
    btn.querySelector("span").textContent = "Saving…";
    try {
      ["dob", "probation_end_date", "gender", "marital_status", "contract_type", "nationality", "national_id_no", "passport_no", "phone"].forEach((k) => {
        if (!data[k]) data[k] = null;
      });
      await apiRequest(`/employees/${empId}`, { method: "PUT", body: JSON.stringify(data) });
      pushToast("Profile updated", "success");
      const r = await apiRequest(`/employees/${empId}`);
      employee = unwrapData(r);
      renderHero(employee);
      fillProfileForm(employee);
    } catch (err) {
      if (err.errors && Object.keys(err.errors).length) showFieldErrors(form, err.errors);
      else pushToast(err.message || "Error saving profile", "error");
    } finally {
      btn.disabled = false;
      btn.querySelector("span").textContent = "Save Profile";
    }
  });

  // ── Setup ─────────────────────────────────────────────────────────────
  document.getElementById("setup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("setup-save-btn");
    btn.disabled = true;
    btn.querySelector("span").textContent = "Saving…";
    try {
      const mgr = searchSelect("ss-setup-manager").getValue();
      const shift = searchSelect("ss-setup-shift").getValue();
      const policy = searchSelect("ss-setup-policy").getValue();
      await apiRequest(`/employees/${empId}`, {
        method: "PUT",
        body: JSON.stringify({
          reporting_manager_id: mgr ? Number(mgr) : null,
          shift_id: shift ? Number(shift) : null,
          leave_policy_id: policy ? Number(policy) : null,
        }),
      });
      pushToast("Work setup updated", "success");
      const r = await apiRequest(`/employees/${empId}`);
      employee = unwrapData(r);
      renderHero(employee);
    } catch (err) {
      pushToast(err.message || "Error saving work setup", "error");
    } finally {
      btn.disabled = false;
      btn.querySelector("span").textContent = "Save Setup";
    }
  });

  // ── Bank accounts ─────────────────────────────────────────────────────
  function renderBanks(banks) {
    const list = document.getElementById("bank-list");
    list.innerHTML = banks.length === 0 ? '<p class="text-sm text-slate-500">No bank accounts added.</p>' : "";
    banks.forEach((b) => {
      const div = document.createElement("div");
      div.className = "flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-5 py-4";
      div.innerHTML = `
        <div>
          <div class="flex items-center gap-2"><p class="font-medium text-white">${esc(b.bank_name)}</p>${b.is_primary ? '<span class="badge badge-violet">Primary</span>' : ""}</div>
          <p class="text-xs text-slate-400 mt-0.5">${esc(b.account_title)} · ${esc(b.account_number)}</p>
          ${b.iban ? `<p class="text-xs text-slate-600 font-mono mt-0.5">${esc(b.iban)}</p>` : ""}
        </div>
        <button data-id="${b.id}" class="del-bank text-xs text-red-400 hover:text-red-300">Remove</button>`;
      list.appendChild(div);
    });
    list.querySelectorAll(".del-bank").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await apiRequest(`/employees/${empId}/bank-accounts/${btn.dataset.id}`, { method: "DELETE" });
        pushToast("Removed", "success");
        renderBanks((await apiRequest(`/employees/${empId}/bank-accounts`).then(unwrapData)) || []);
      })
    );
  }

  document.getElementById("bank-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const data = { bank_name: fd.get("bank_name"), account_title: fd.get("account_title"), account_number: fd.get("account_number"), iban: fd.get("iban") || null, currency: fd.get("currency"), is_primary: fd.get("is_primary") === "on" };
    const errors = {};
    if (!data.bank_name.trim()) errors.bank_name = "Bank name is required";
    if (!data.account_title.trim()) errors.account_title = "Account title is required";
    if (!data.account_number.trim()) errors.account_number = "Account number is required";
    if (Object.keys(errors).length) return showFieldErrors(form, errors);
    try {
      await apiRequest(`/employees/${empId}/bank-accounts`, { method: "POST", body: JSON.stringify(data) });
      pushToast("Bank account added", "success");
      form.reset();
      showFieldErrors(form, null);
      renderBanks((await apiRequest(`/employees/${empId}/bank-accounts`).then(unwrapData)) || []);
    } catch (err) {
      pushToast(err.message || "Error", "error");
    }
  });

  // ── Emergency contacts ────────────────────────────────────────────────
  function renderEmergency(rows) {
    const list = document.getElementById("emergency-list");
    list.innerHTML = rows.length === 0 ? '<p class="text-sm text-slate-500">No emergency contacts added.</p>' : "";
    rows.forEach((c) => {
      const div = document.createElement("div");
      div.className = "rounded-xl border border-white/8 bg-white/3 px-5 py-4";
      div.innerHTML = `
        <div class="flex items-center gap-2 mb-1"><p class="font-medium text-white">${esc(c.name)}</p>${c.is_primary ? '<span class="badge badge-violet">Primary</span>' : ""}</div>
        <p class="text-xs text-slate-400">${esc(c.relationship)} · ${esc(c.phone)}</p>
        ${c.email ? `<p class="text-xs text-slate-600">${esc(c.email)}</p>` : ""}`;
      list.appendChild(div);
    });
  }

  document.getElementById("emergency-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const data = { name: fd.get("name"), relationship: fd.get("relationship"), phone: fd.get("phone"), email: fd.get("email") || null, is_primary: fd.get("is_primary") === "on" };
    const errors = {};
    if (!data.name.trim()) errors.name = "Name is required";
    if (!data.relationship.trim()) errors.relationship = "Relationship is required";
    if (!data.phone.trim()) errors.phone = "Phone is required";
    if (Object.keys(errors).length) return showFieldErrors(form, errors);
    try {
      await apiRequest(`/employees/${empId}/emergency-contacts`, { method: "POST", body: JSON.stringify(data) });
      pushToast("Contact added", "success");
      form.reset();
      showFieldErrors(form, null);
      renderEmergency((await apiRequest(`/employees/${empId}/emergency-contacts`).then(unwrapData)) || []);
    } catch (err) {
      pushToast(err.message || "Error", "error");
    }
  });

  // ── Education ─────────────────────────────────────────────────────────
  function renderEducation(rows) {
    const list = document.getElementById("education-list");
    list.innerHTML = rows.length === 0 ? '<p class="text-sm text-slate-500">No education records added.</p>' : "";
    rows.forEach((e) => {
      const div = document.createElement("div");
      div.className = "rounded-xl border border-white/8 bg-white/3 px-5 py-4";
      div.innerHTML = `
        <p class="font-medium text-white">${esc(e.degree)}</p>
        <p class="text-sm text-slate-400">${esc(e.institution)}${e.field_of_study ? ` · ${esc(e.field_of_study)}` : ""}</p>
        <p class="text-xs text-slate-600 mt-0.5">${e.start_year || "?"} — ${e.end_year || "Present"}${e.grade ? ` · Grade: ${esc(e.grade)}` : ""}</p>`;
      list.appendChild(div);
    });
  }

  document.getElementById("education-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const data = { degree: fd.get("degree"), institution: fd.get("institution"), field_of_study: fd.get("field_of_study") || null, start_year: Number(fd.get("start_year")) || null, end_year: Number(fd.get("end_year")) || null, grade: fd.get("grade") || null };
    const errors = {};
    if (!data.degree.trim()) errors.degree = "Degree is required";
    if (!data.institution.trim()) errors.institution = "Institution is required";
    if (Object.keys(errors).length) return showFieldErrors(form, errors);
    try {
      await apiRequest(`/employees/${empId}/education`, { method: "POST", body: JSON.stringify(data) });
      pushToast("Education added", "success");
      form.reset();
      showFieldErrors(form, null);
      renderEducation((await apiRequest(`/employees/${empId}/education`).then(unwrapData)) || []);
    } catch (err) {
      pushToast(err.message || "Error", "error");
    }
  });

  // ── Experience ────────────────────────────────────────────────────────
  function renderExperience(rows) {
    const list = document.getElementById("experience-list");
    list.innerHTML = rows.length === 0 ? '<p class="text-sm text-slate-500">No work experience added.</p>' : "";
    rows.forEach((x) => {
      const div = document.createElement("div");
      div.className = "rounded-xl border border-white/8 bg-white/3 px-5 py-4";
      div.innerHTML = `
        <div class="flex items-center gap-2"><p class="font-medium text-white">${esc(x.job_title)}</p>${x.is_current ? '<span class="badge badge-green">Current</span>' : ""}</div>
        <p class="text-sm text-slate-400">${esc(x.company_name)}</p>
        <p class="text-xs text-slate-600 mt-0.5">${x.start_date} — ${x.end_date || "Present"}</p>
        ${x.responsibilities ? `<p class="text-xs text-slate-500 mt-1 line-clamp-2">${esc(x.responsibilities)}</p>` : ""}`;
      list.appendChild(div);
    });
  }

  document.getElementById("exp-is-current").addEventListener("change", (e) => {
    document.getElementById("exp-end-date").disabled = e.target.checked;
    if (e.target.checked) document.getElementById("exp-end-date").value = "";
  });

  document.getElementById("experience-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const data = { company_name: fd.get("company_name"), job_title: fd.get("job_title"), start_date: fd.get("start_date"), end_date: fd.get("end_date") || null, is_current: fd.get("is_current") === "on", responsibilities: fd.get("responsibilities") || null };
    const errors = {};
    if (!data.company_name.trim()) errors.company_name = "Company name is required";
    if (!data.job_title.trim()) errors.job_title = "Job title is required";
    if (!data.start_date) errors.start_date = "Start date is required";
    if (Object.keys(errors).length) return showFieldErrors(form, errors);
    try {
      await apiRequest(`/employees/${empId}/experience`, { method: "POST", body: JSON.stringify(data) });
      pushToast("Experience added", "success");
      form.reset();
      showFieldErrors(form, null);
      renderExperience((await apiRequest(`/employees/${empId}/experience`).then(unwrapData)) || []);
    } catch (err) {
      pushToast(err.message || "Error", "error");
    }
  });

  // ── Compensation ──────────────────────────────────────────────────────
  function renderCompensation(rows) {
    document.getElementById("comp-form-title").textContent = rows.length === 0 ? "Add First Compensation" : "Assign / Update Compensation";
    if (rows.length === 0) {
      document.getElementById("comp-empty").hidden = false;
      document.getElementById("comp-table-wrap").hidden = true;
      return;
    }
    document.getElementById("comp-empty").hidden = true;
    document.getElementById("comp-table-wrap").hidden = false;
    const tbody = document.getElementById("comp-tbody");
    tbody.innerHTML = "";
    rows.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.designation_title ? `<span class="font-medium text-slate-200">${esc(c.designation_title)}</span>${c.designation_grade ? ` <span class="ml-1.5 text-xs text-slate-500">${esc(c.designation_grade)}</span>` : ""}` : '<span class="text-slate-600">—</span>'}</td>
        <td class="font-mono text-emerald-400 font-semibold">${c.gross_monthly ? Number(c.gross_monthly).toLocaleString() : '<span class="text-slate-600">—</span>'}</td>
        <td>${c.currency || ""}</td>
        <td>${c.effective_from || ""}</td>
        <td>${c.effective_to || "—"}</td>
        <td>${!c.effective_to ? '<span class="badge badge-green">Current</span>' : '<span class="badge badge-slate">Closed</span>'}</td>`;
      tbody.appendChild(tr);
    });
  }

  document.getElementById("comp-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const errors = {};
    if (!fd.get("designation_id")) errors.designation_id = "Please select a designation";
    if (!fd.get("effective_from")) errors.effective_from = "Effective date is required";
    if (Object.keys(errors).length) return showFieldErrors(form, errors);
    try {
      await apiRequest("/designations/assign", {
        method: "POST",
        body: JSON.stringify({
          employee_id: Number(empId), designation_id: Number(fd.get("designation_id")),
          effective_from: fd.get("effective_from"),
          gross_monthly: fd.get("gross_monthly") ? Number(fd.get("gross_monthly")) : null,
          currency: fd.get("currency"),
        }),
      });
      pushToast("Compensation record added", "success");
      form.reset();
      showFieldErrors(form, null);
      renderCompensation((await apiRequest(`/employees/${empId}/designation-history`).then(unwrapData)) || []);
    } catch (err) {
      pushToast(err.message || "Error saving compensation", "error");
    }
  });

  // ── Documents ─────────────────────────────────────────────────────────
  function renderDocuments(rows) {
    const list = document.getElementById("documents-list");
    if (rows.length === 0) {
      list.innerHTML = '<div class="rounded-xl border border-dashed border-white/10 bg-white/2 px-6 py-10 text-center"><p class="text-sm text-slate-500">No documents uploaded yet.</p><p class="text-xs text-slate-600 mt-1">Upload passport, national ID, visa, certificates and more.</p></div>';
      return;
    }
    list.innerHTML = "";
    rows.forEach((d) => {
      const div = document.createElement("div");
      div.className = "flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-5 py-4 gap-3";
      const label = (d.document_type || "").replace(/_/g, " ");
      div.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
            <svg class="h-4 w-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <p class="font-medium text-white capitalize">${esc(label)}</p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          ${d.file_url ? `<a href="/media/${esc(d.file_url)}" target="_blank" rel="noreferrer" class="text-xs text-cyan-400 hover:text-cyan-300 transition whitespace-nowrap">View ↗</a>` : ""}
          <button data-id="${d.id}" class="del-doc text-xs text-red-400 hover:text-red-300 transition">Remove</button>
        </div>`;
      list.appendChild(div);
    });
    list.querySelectorAll(".del-doc").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await apiRequest(`/employee-documents/${btn.dataset.id}`, { method: "DELETE" });
        pushToast("Document removed", "success");
        const r = await apiRequest(`/employee-documents?employee_id=${empId}`);
        renderDocuments((unwrapData(r) || {}).data || []);
      })
    );
  }

  document.getElementById("doc-file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    document.getElementById("doc-file-name").textContent = file ? file.name : "Click to choose file";
    document.getElementById("doc-upload-btn").disabled = !file;
  });

  document.getElementById("documents-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const file = document.getElementById("doc-file-input").files[0];
    if (!file) {
      pushToast("Please select a file", "error");
      return;
    }
    const btn = document.getElementById("doc-upload-btn");
    btn.disabled = true;
    btn.querySelector("span").textContent = "Uploading…";
    try {
      const fd = new FormData();
      fd.append("employee_id", empId);
      fd.append("document_type", form.elements["document_type"].value);
      fd.append("file", file);
      await fetch("/api/v1/employee-documents", {
        method: "POST",
        headers: { "X-CSRFToken": getCsrfToken() },
        credentials: "same-origin",
        body: fd,
      }).then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Upload failed");
      });
      pushToast("Document uploaded", "success");
      form.reset();
      document.getElementById("doc-file-name").textContent = "Click to choose file";
      const r = await apiRequest(`/employee-documents?employee_id=${empId}`);
      renderDocuments((unwrapData(r) || {}).data || []);
    } catch (err) {
      pushToast(err.message || "Upload error", "error");
    } finally {
      btn.disabled = false;
      btn.querySelector("span").textContent = "Upload Document";
    }
  });

  // ── Account ───────────────────────────────────────────────────────────
  async function loadAccount() {
    document.getElementById("account-loading").hidden = false;
    document.getElementById("account-create").hidden = true;
    document.getElementById("account-existing").hidden = true;
    try {
      const r = await apiRequest(`/employees/${empId}/account`);
      accountInfo = unwrapData(r);
      document.getElementById("account-loading").hidden = true;

      if (!accountInfo.has_account) {
        document.getElementById("account-create").hidden = false;
        document.getElementById("account-email-input").value = employee ? employee.email : "";
        accountFormType = accountInfo.is_manager_by_relationship ? "manager" : "user";
        updateTypeChoiceUI("account-type-choice", accountFormType);
        if (accountInfo.is_manager_by_relationship) {
          document.getElementById("account-manager-hint").hidden = false;
          document.getElementById("account-manages-count-text").textContent = `line manager for ${accountInfo.manages_count} ${accountInfo.manages_count === 1 ? "person" : "people"}`;
        }
      } else {
        document.getElementById("account-existing").hidden = false;
        document.getElementById("account-existing-email").textContent = accountInfo.email;
        const statusEl = document.getElementById("account-existing-status");
        statusEl.className = `badge shrink-0 ${accountInfo.is_active ? "badge-green" : "badge-slate"}`;
        statusEl.textContent = accountInfo.is_active ? "Active" : "Inactive";
        if (accountInfo.is_manager_by_relationship) {
          document.getElementById("account-existing-manager-hint").hidden = false;
          document.getElementById("account-existing-manages-text").textContent = `line manager for ${accountInfo.manages_count} ${accountInfo.manages_count === 1 ? "person" : "people"}`;
        }
        updateTypeChoiceUI("account-type-existing-choice", accountInfo.account_type);
        const toggleBtn = document.getElementById("toggle-active-btn");
        toggleBtn.textContent = accountInfo.is_active ? "Deactivate Account" : "Activate Account";
        toggleBtn.className = `w-full rounded-xl py-2.5 text-sm font-medium border transition ${accountInfo.is_active ? "border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/15" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"}`;
      }
    } catch (err) {
      document.getElementById("account-loading").hidden = true;
      pushToast(err.message || "Failed to load account info", "error");
    }
  }

  function updateTypeChoiceUI(containerId, activeType) {
    document.querySelectorAll(`#${containerId} button`).forEach((btn) => {
      const isActive = btn.dataset.type === activeType;
      btn.className = `rounded-xl border p-3 text-left transition ${isActive ? "border-violet-500/50 bg-violet-500/10" : "border-white/8 bg-white/2 hover:border-white/15"}`;
    });
  }

  document.getElementById("account-type-choice").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    accountFormType = btn.dataset.type;
    updateTypeChoiceUI("account-type-choice", accountFormType);
  });

  document.getElementById("account-create-btn").addEventListener("click", async () => {
    const email = document.getElementById("account-email-input").value;
    const errBox = document.getElementById("account-error");
    errBox.hidden = true;
    if (!email.trim()) return;
    try {
      const r = await apiRequest(`/employees/${empId}/account`, {
        method: "POST",
        body: JSON.stringify({ email, account_type: accountFormType }),
      });
      const d = unwrapData(r);
      pushToast("Account created", "success");
      accountInfo = null;
      await loadAccount();
      document.getElementById("new-credentials-banner").hidden = false;
      document.getElementById("new-cred-email").textContent = d.email;
      document.getElementById("new-cred-password").textContent = d.password;
    } catch (err) {
      errBox.hidden = false;
      errBox.textContent = err.message || "Failed to create account.";
    }
  });

  document.getElementById("account-type-existing-choice").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn || !accountInfo || btn.dataset.type === accountInfo.account_type) return;
    try {
      await apiRequest(`/employees/${empId}/account`, { method: "PATCH", body: JSON.stringify({ account_type: btn.dataset.type }) });
      pushToast("Account type updated", "success");
      accountInfo = null;
      await loadAccount();
    } catch (err) {
      pushToast(err.message || "Failed to update type.", "error");
    }
  });

  document.getElementById("reset-password-btn").addEventListener("click", async () => {
    try {
      const r = await apiRequest(`/employees/${empId}/account/reset-password`, { method: "POST" });
      const d = unwrapData(r);
      pushToast("Password reset", "success");
      document.getElementById("new-credentials-banner").hidden = false;
      document.getElementById("new-cred-email").textContent = d.email;
      document.getElementById("new-cred-password").textContent = d.password;
    } catch (err) {
      pushToast(err.message || "Failed to reset password.", "error");
    }
  });

  document.getElementById("toggle-active-btn").addEventListener("click", async () => {
    const activate = !accountInfo.is_active;
    try {
      await apiRequest(`/employees/${empId}/account/${activate ? "activate" : "deactivate"}`, { method: "POST" });
      pushToast(activate ? "Account activated" : "Account deactivated", "success");
      accountInfo = null;
      await loadAccount();
    } catch (err) {
      pushToast(err.message || "Failed.", "error");
    }
  });

  document.getElementById("dismiss-credentials-btn").addEventListener("click", () => {
    document.getElementById("new-credentials-banner").hidden = true;
  });

  document.addEventListener("DOMContentLoaded", loadAll);
})();
