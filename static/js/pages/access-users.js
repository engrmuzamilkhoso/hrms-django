/**
 * Pixel-precise port of app/platform/users/page.tsx.
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  const ROLE_COLORS = {
    "Org Admin": "bg-violet-500/20 text-violet-300 border-violet-500/30",
    "HR Manager": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    "Team Lead": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    Employee: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    "Finance Viewer": "bg-amber-500/20 text-amber-300 border-amber-500/30",
    Recruiter: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    Interviewer: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  };

  let users = [];
  let userLimit = null;
  let search = "";

  async function load() {
    const [usersRes, orgRes] = await Promise.allSettled([apiRequest("/users"), apiRequest("/organizations/me")]);
    if (usersRes.status === "fulfilled") users = unwrapData(usersRes.value) || [];
    if (orgRes.status === "fulfilled") {
      const org = unwrapData(orgRes.value);
      userLimit = org && org.trial_user_limit != null ? Number(org.trial_user_limit) : null;
    }
    renderLimitBadge();
    renderBanners();
    renderTable();
  }

  function renderLimitBadge() {
    const badge = document.getElementById("user-limit-badge");
    if (userLimit == null) {
      badge.hidden = true;
      return;
    }
    badge.hidden = false;
    badge.textContent = `${users.length}/${userLimit}`;
  }

  function renderBanners() {
    const el = document.getElementById("banners");
    if (userLimit == null) {
      el.innerHTML = "";
      return;
    }
    const atLimit = users.length >= userLimit;
    const nearLimit = users.length >= userLimit * 0.8;
    const tone = atLimit ? "rose" : nearLimit ? "amber" : "cyan";
    el.innerHTML = `
      <div class="mb-6 rounded-2xl border px-5 py-4 flex items-center justify-between gap-4 border-${tone}-500/30 bg-${tone}-500/8">
        <div class="flex items-center gap-3">
          <svg class="h-5 w-5 shrink-0 text-${tone}-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <p class="text-sm font-semibold text-${tone}-300">${atLimit ? "User limit reached — upgrade to add more members" : `Trial plan: ${users.length} of ${userLimit} users used`}</p>
            <p class="text-xs text-slate-500 mt-0.5">${atLimit ? "Your organization is on a trial plan. Contact your platform administrator to upgrade." : `${userLimit - users.length} more user${userLimit - users.length === 1 ? "" : "s"} available on your current plan.`}</p>
          </div>
        </div>
        ${atLimit ? '<button id="upgrade-btn" class="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition">Upgrade Plan</button>' : ""}
      </div>`;
    const upgradeBtn = document.getElementById("upgrade-btn");
    if (upgradeBtn) upgradeBtn.addEventListener("click", openPaywall);
  }

  function showCredsBanner(kind, creds) {
    const el = document.getElementById("banners");
    const wrap = document.createElement("div");
    if (kind === "new") {
      wrap.className = "mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-5";
      wrap.innerHTML = `
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <p class="font-semibold text-emerald-300">Account Created — Share these credentials with ${esc(creds.name)}</p>
          </div>
          <button class="close-banner text-slate-500 hover:text-slate-300 transition">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          ${[["Name", creds.name], ["Email / Username", creds.email], ["Password", creds.password], ["Role", creds.role]]
            .map(([label, value]) => `<div class="rounded-xl border border-emerald-500/20 bg-black/20 px-4 py-3"><p class="text-xs text-slate-500 uppercase tracking-wide mb-1">${label}</p><p class="font-mono text-sm font-bold text-emerald-300 break-all">${esc(value)}</p></div>`)
            .join("")}
        </div>
        <div class="mt-3 flex items-center gap-3">
          <p class="text-xs text-slate-500">Login URL: <span class="text-slate-400 font-mono">${esc(creds.login_url)}</span></p>
          <button class="copy-creds-btn ml-auto text-xs text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-1 hover:bg-emerald-500/15 transition">Copy all credentials</button>
        </div>`;
      wrap.querySelector(".copy-creds-btn").addEventListener("click", () => {
        const text = `WorkForce HRMS Login\n\nURL: ${creds.login_url}\nEmail: ${creds.email}\nPassword: ${creds.password}\nRole: ${creds.role}\n\nPlease change your password after first login.`;
        navigator.clipboard.writeText(text);
        pushToast("Credentials copied", "success");
      });
    } else {
      wrap.className = "mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-5";
      wrap.innerHTML = `
        <div class="flex items-start justify-between mb-3">
          <p class="font-semibold text-amber-300">Password Reset — Share new credentials</p>
          <button class="close-banner text-slate-500 hover:text-slate-300 transition">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-amber-500/20 bg-black/20 px-4 py-3"><p class="text-xs text-slate-500 uppercase tracking-wide mb-1">Email</p><p class="font-mono text-sm font-bold text-amber-300">${esc(creds.email)}</p></div>
          <div class="rounded-xl border border-amber-500/20 bg-black/20 px-4 py-3"><p class="text-xs text-slate-500 uppercase tracking-wide mb-1">New Password</p><p class="font-mono text-sm font-bold text-amber-300">${esc(creds.password)}</p></div>
        </div>`;
    }
    wrap.querySelector(".close-banner").addEventListener("click", () => wrap.remove());
    el.prepend(wrap);
  }

  function openPaywall() {
    const el = document.getElementById("paywall-modal");
    el.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" id="paywall-backdrop"></div>
        <div class="relative w-full max-w-md glass rounded-2xl p-8 shadow-2xl animate-fade-up text-center">
          <div class="mb-5 flex justify-center">
            <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/30">
              <svg class="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
          </div>
          <h2 class="text-xl font-bold text-slate-100 mb-2">Trial Limit Reached</h2>
          <p class="text-sm text-slate-400 mb-2">Your organization has reached the <span class="font-semibold text-amber-300">${userLimit}-user trial limit</span>.</p>
          <p class="text-sm text-slate-500 mb-6">To add more team members, upgrade your plan. Contact your platform administrator or choose a paid subscription.</p>
          <div class="grid gap-3">
            <div class="rounded-xl border border-violet-500/20 bg-violet-500/8 p-4 text-left"><div class="flex items-center justify-between mb-1"><p class="text-sm font-semibold text-violet-300">Starter Plan</p><p class="text-sm font-bold text-slate-200">$29<span class="text-xs text-slate-500">/mo</span></p></div><p class="text-xs text-slate-500">Up to 25 users · All core HR features</p></div>
            <div class="rounded-xl border border-indigo-500/20 bg-indigo-500/8 p-4 text-left"><div class="flex items-center justify-between mb-1"><p class="text-sm font-semibold text-indigo-300">Growth Plan</p><p class="text-sm font-bold text-slate-200">$79<span class="text-xs text-slate-500">/mo</span></p></div><p class="text-xs text-slate-500">Up to 100 users · Advanced analytics &amp; payroll</p></div>
            <div class="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-left"><div class="flex items-center justify-between mb-1"><p class="text-sm font-semibold text-amber-300">Enterprise</p><p class="text-sm font-bold text-slate-200">Custom</p></div><p class="text-xs text-slate-500">Unlimited users · Dedicated support &amp; SLA</p></div>
          </div>
          <div class="mt-6 flex gap-3">
            <button id="paywall-later" class="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-slate-400 hover:bg-white/5 transition">Maybe Later</button>
            <button id="paywall-contact" class="btn-primary flex-1 rounded-xl py-2.5 text-sm"><span>Contact Sales</span></button>
          </div>
        </div>
      </div>`;
    const close = () => (el.innerHTML = "");
    document.getElementById("paywall-backdrop").addEventListener("click", close);
    document.getElementById("paywall-later").addEventListener("click", close);
    document.getElementById("paywall-contact").addEventListener("click", () => {
      close();
      window.open("mailto:billing@workforce-hrms.com?subject=Plan Upgrade Request", "_blank");
    });
  }

  function renderTable() {
    const tbody = document.getElementById("users-tbody");
    const q = search.toLowerCase();
    const filtered = users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.roles || []).some((r) => r.toLowerCase().includes(q))
    );
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-12 text-slate-500">No users found. Create the first account above.</td></tr>';
      return;
    }
    tbody.innerHTML = "";
    filtered.forEach((u) => {
      const tr = document.createElement("tr");
      if (!u.is_active) tr.className = "opacity-50";
      const rolesHtml = (u.roles || [])
        .map((r) => `<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r] || "bg-slate-700/50 text-slate-400 border-slate-600/30"}">${esc(r)}</span>`)
        .join("");
      tr.innerHTML = `
        <td>
          <div class="flex items-center gap-3">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold">${esc(u.name.charAt(0).toUpperCase())}</div>
            <div><p class="font-medium text-slate-200">${esc(u.name)}</p><p class="text-xs text-slate-500">${esc(u.email)}</p></div>
          </div>
        </td>
        <td><div class="flex flex-wrap gap-1">${rolesHtml}</div></td>
        <td class="font-mono text-xs text-slate-400">${u.employee_code ? esc(u.employee_code) : "—"}</td>
        <td><span class="inline-flex items-center gap-1.5 text-xs font-medium ${u.is_active ? "text-emerald-400" : "text-rose-400"}"><span class="h-1.5 w-1.5 rounded-full ${u.is_active ? "bg-emerald-400" : "bg-rose-400"}"></span>${u.is_active ? "Active" : "Deactivated"}</span></td>
        <td class="text-xs text-slate-500">${u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
        <td>
          <div class="flex items-center gap-2">
            <button data-id="${u.id}" class="reset-pw-btn rounded-lg border border-amber-500/20 bg-amber-500/8 px-2.5 py-1 text-xs text-amber-400 hover:bg-amber-500/18 disabled:opacity-50 transition">Reset PW</button>
            <button data-id="${u.id}" data-active="${u.is_active ? "1" : "0"}" class="toggle-active-btn rounded-lg border px-2.5 py-1 text-xs disabled:opacity-50 transition ${u.is_active ? "border-rose-500/20 bg-rose-500/8 text-rose-400 hover:bg-rose-500/18" : "border-emerald-500/20 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/18"}">${u.is_active ? "Deactivate" : "Activate"}</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".reset-pw-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const u = users.find((x) => x.id === Number(btn.dataset.id));
        if (!confirm(`Reset password for ${u.name}?`)) return;
        btn.disabled = true;
        try {
          const r = await apiRequest(`/users/${btn.dataset.id}/reset-password`, { method: "POST" });
          showCredsBanner("reset", unwrapData(r));
        } catch (err) {
          pushToast(err.message || "Error", "error");
        } finally {
          btn.disabled = false;
        }
      })
    );
    tbody.querySelectorAll(".toggle-active-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const isActive = btn.dataset.active === "1";
        btn.disabled = true;
        try {
          await apiRequest(`/users/${btn.dataset.id}/${isActive ? "deactivate" : "activate"}`, { method: "POST" });
          const u = users.find((x) => x.id === Number(btn.dataset.id));
          if (u) u.is_active = !isActive;
          renderTable();
        } catch (err) {
          pushToast(err.message || "Error", "error");
          btn.disabled = false;
        }
      })
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();

    document.getElementById("user-search").addEventListener("input", (e) => {
      search = e.target.value;
      renderTable();
    });

    document.getElementById("create-account-btn").addEventListener("click", () => {
      if (userLimit !== null && users.length >= userLimit) {
        openPaywall();
        return;
      }
      const form = document.getElementById("invite-form");
      form.hidden = !form.hidden;
    });

    document.getElementById("invite-cancel-btn").addEventListener("click", () => {
      document.getElementById("invite-form").hidden = true;
    });

    document.getElementById("invite-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = document.getElementById("invite-save-btn");
      const spinner = document.getElementById("invite-save-spinner");
      const label = document.getElementById("invite-save-label");
      btn.disabled = true;
      spinner.hidden = false;
      label.textContent = "Creating…";
      try {
        const r = await apiRequest("/users/invite", {
          method: "POST",
          body: JSON.stringify({
            name: fd.get("name"),
            email: fd.get("email"),
            role: fd.get("role"),
            designation: fd.get("designation") || undefined,
          }),
        });
        showCredsBanner("new", unwrapData(r));
        document.getElementById("invite-form").hidden = true;
        e.target.reset();
        load();
      } catch (err) {
        pushToast(err.message || "Failed to create account", "error");
      } finally {
        btn.disabled = false;
        spinner.hidden = true;
        label.textContent = "Create Account & Show Credentials";
      }
    });
  });
})();
