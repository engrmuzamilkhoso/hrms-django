(function () {
  // Nav scroll shadow
  const nav = document.getElementById("landing-nav");
  function onScroll() {
    if (window.scrollY > 20) {
      nav.classList.add("bg-[#07081a]/90", "backdrop-blur-xl", "border-b", "border-white/8", "shadow-lg", "shadow-black/30");
      nav.classList.remove("bg-transparent");
    } else {
      nav.classList.remove("bg-[#07081a]/90", "backdrop-blur-xl", "border-b", "border-white/8", "shadow-lg", "shadow-black/30");
      nav.classList.add("bg-transparent");
    }
  }
  window.addEventListener("scroll", onScroll);

  // Mobile drawer toggle
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const drawer = document.getElementById("mobile-drawer");
  const iconOpen = document.getElementById("mobile-icon-open");
  const iconClose = document.getElementById("mobile-icon-close");
  mobileBtn.addEventListener("click", () => {
    const isOpen = !drawer.hidden;
    drawer.hidden = isOpen;
    iconOpen.hidden = !isOpen;
    iconClose.hidden = isOpen;
  });
  drawer.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      drawer.hidden = true;
      iconOpen.hidden = false;
      iconClose.hidden = true;
    })
  );

  // Module spotlight tabs
  const MODULES = [
    {
      heading: "Real-time Pulse of Your Organization",
      desc: "Your HR command center — live headcount, attendance rates, pending approvals, upcoming birthdays, recent hires, and department breakdown. Everything you need, the moment you log in.",
      bullets: ["Live attendance tracking", "Department headcount charts", "Pending actions widget", "Upcoming anniversary & birthday alerts"],
      mock: `
        <div class="space-y-3">
          <div class="grid grid-cols-3 gap-2">
            <div class="rounded-xl border border-white/6 bg-white/3 p-3 text-center"><div class="text-xl font-black text-violet-400">247</div><div class="text-[10px] text-slate-500 mt-0.5">Employees</div></div>
            <div class="rounded-xl border border-white/6 bg-white/3 p-3 text-center"><div class="text-xl font-black text-emerald-400">94%</div><div class="text-[10px] text-slate-500 mt-0.5">Present</div></div>
            <div class="rounded-xl border border-white/6 bg-white/3 p-3 text-center"><div class="text-xl font-black text-cyan-400">8</div><div class="text-[10px] text-slate-500 mt-0.5">Open Roles</div></div>
          </div>
          <div class="rounded-xl border border-white/6 bg-white/3 p-4">
            <p class="text-xs text-slate-400 mb-3 font-semibold">Attendance This Week</p>
            <div class="flex items-end gap-1.5 h-16">
              <div class="flex-1 rounded-sm bg-violet-500/40 hover:bg-violet-500/70 transition" style="height:70%"></div>
              <div class="flex-1 rounded-sm bg-violet-500/40 hover:bg-violet-500/70 transition" style="height:82%"></div>
              <div class="flex-1 rounded-sm bg-violet-500/40 hover:bg-violet-500/70 transition" style="height:88%"></div>
              <div class="flex-1 rounded-sm bg-violet-500/40 hover:bg-violet-500/70 transition" style="height:75%"></div>
              <div class="flex-1 rounded-sm bg-violet-500/40 hover:bg-violet-500/70 transition" style="height:90%"></div>
              <div class="flex-1 rounded-sm bg-violet-500/40 hover:bg-violet-500/70 transition" style="height:85%"></div>
              <div class="flex-1 rounded-sm bg-violet-500/40 hover:bg-violet-500/70 transition" style="height:78%"></div>
            </div>
            <div class="flex justify-between mt-1">
              <span class="text-[9px] text-slate-600">M</span><span class="text-[9px] text-slate-600">T</span><span class="text-[9px] text-slate-600">W</span><span class="text-[9px] text-slate-600">T</span><span class="text-[9px] text-slate-600">F</span><span class="text-[9px] text-slate-600">S</span><span class="text-[9px] text-slate-600">S</span>
            </div>
          </div>
        </div>`,
    },
    {
      heading: "Payroll Done in Minutes, Not Days",
      desc: "Define salary structures, components, and tax brackets once. Run payroll monthly with one click — calculate, lock, approve, and export to bank. Generate beautiful payslips instantly.",
      bullets: ["Configurable salary components", "Automatic tax computation", "One-click payslip generation", "Bank file export (CSV/PDF)"],
      mock: `
        <div class="space-y-3">
          <div class="rounded-xl border border-white/6 bg-white/3 p-4">
            <div class="flex items-center justify-between mb-3"><p class="text-xs font-semibold text-slate-300">June 2026 Payroll</p><span class="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Processed</span></div>
            <div class="flex justify-between py-1.5 text-xs border-b border-white/4 text-slate-400"><span>Base Salary</span><span>$142,000</span></div>
            <div class="flex justify-between py-1.5 text-xs border-b border-white/4 text-slate-400"><span>Bonuses</span><span>$8,400</span></div>
            <div class="flex justify-between py-1.5 text-xs border-b border-white/4 text-slate-400"><span>Deductions</span><span>-$12,200</span></div>
            <div class="flex justify-between py-1.5 text-xs font-bold text-emerald-400"><span>Net Payable</span><span>$138,200</span></div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button class="rounded-xl border border-violet-500/25 bg-violet-500/10 p-3 text-xs text-violet-300 font-semibold text-center">📄 Generate Payslips</button>
            <button class="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-300 font-semibold text-center">🏦 Bank Export</button>
          </div>
        </div>`,
    },
    {
      heading: "Zero-Friction Leave Management",
      desc: "Employees apply, managers approve — all in the system. Leave balances auto-update. Attendance records integrate with payroll. Holiday calendars, delegation, and shift swaps included.",
      bullets: ["Employee self-service leave portal", "Manager approval workflows", "Auto-balance deduction", "Attendance-payroll integration"],
      mock: `
        <div class="space-y-3">
          <div class="rounded-xl border border-white/6 bg-white/3 p-4">
            <p class="text-xs text-slate-400 font-semibold mb-3">Leave Balances — Sarah K.</p>
            <div class="mb-2.5"><div class="flex justify-between text-[11px] mb-1"><span class="text-slate-300">Annual Leave</span><span class="text-slate-400">18 / 21 days</span></div><div class="h-1.5 rounded-full bg-white/5"><div class="h-1.5 rounded-full bg-violet-500" style="width:85.7%"></div></div></div>
            <div class="mb-2.5"><div class="flex justify-between text-[11px] mb-1"><span class="text-slate-300">Sick Leave</span><span class="text-slate-400">5 / 7 days</span></div><div class="h-1.5 rounded-full bg-white/5"><div class="h-1.5 rounded-full bg-amber-500" style="width:71.4%"></div></div></div>
            <div class="mb-2.5"><div class="flex justify-between text-[11px] mb-1"><span class="text-slate-300">Maternity</span><span class="text-slate-400">0 / 90 days</span></div><div class="h-1.5 rounded-full bg-white/5"><div class="h-1.5 rounded-full bg-rose-500" style="width:0%"></div></div></div>
          </div>
          <div class="rounded-xl border border-cyan-500/20 bg-cyan-500/8 p-3 flex items-center gap-3">
            <span class="text-lg">✅</span>
            <div><p class="text-xs text-cyan-300 font-semibold">Leave Approved</p><p class="text-[11px] text-slate-400">Jul 14–16 · Annual Leave · 3 days</p></div>
          </div>
        </div>`,
    },
    {
      heading: "Hire Faster with a Smart Pipeline",
      desc: "Post jobs, track candidates through your pipeline, schedule interviews, collaborate with interviewers, and extend offers — all without leaving the platform. AI resume scoring included.",
      bullets: ["Multi-stage pipeline boards", "Interview scheduling", "CV parsing & AI scoring", "Offer letter management"],
      mock: `
        <div class="space-y-2">
          <div class="rounded-xl border border-white/6 bg-white/3 p-3 flex items-center justify-between"><div><p class="text-sm font-semibold text-slate-200">Aisha M.</p><p class="text-xs text-slate-500">Senior Engineer</p></div><span class="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold border-slate-500/30 bg-slate-500/8 text-slate-300">Applied</span></div>
          <div class="rounded-xl border border-white/6 bg-white/3 p-3 flex items-center justify-between"><div><p class="text-sm font-semibold text-slate-200">Jake T.</p><p class="text-xs text-slate-500">Product Designer</p></div><span class="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold border-violet-500/30 bg-violet-500/8 text-violet-300">Interview</span></div>
          <div class="rounded-xl border border-white/6 bg-white/3 p-3 flex items-center justify-between"><div><p class="text-sm font-semibold text-slate-200">Priya S.</p><p class="text-xs text-slate-500">Data Analyst</p></div><span class="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold border-emerald-500/30 bg-emerald-500/8 text-emerald-300">Offer</span></div>
          <div class="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3"><p class="text-xs text-amber-300 font-semibold">🤖 AI Resume Match</p><p class="text-[11px] text-slate-400 mt-0.5">Priya S. — 94% match for Data Analyst role</p></div>
        </div>`,
    },
  ];

  function renderModule(index) {
    const m = MODULES[index];
    document.getElementById("module-heading").textContent = m.heading;
    document.getElementById("module-desc").textContent = m.desc;
    document.getElementById("module-bullets").innerHTML = m.bullets
      .map(
        (b) => `
      <li class="flex items-center gap-3 text-sm text-slate-300">
        <span class="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 text-violet-400">
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
        </span>
        ${b}
      </li>`
      )
      .join("");
    document.getElementById("module-mock").innerHTML = m.mock;

    document.querySelectorAll(".module-tab-btn").forEach((btn) => {
      const active = Number(btn.dataset.module) === index;
      btn.classList.toggle("bg-violet-600", active);
      btn.classList.toggle("text-white", active);
      btn.classList.toggle("shadow-lg", active);
      btn.classList.toggle("shadow-violet-500/25", active);
      btn.classList.toggle("border", !active);
      btn.classList.toggle("border-white/8", !active);
      btn.classList.toggle("text-slate-400", !active);
    });
  }

  document.getElementById("module-tab-bar").addEventListener("click", (e) => {
    const btn = e.target.closest(".module-tab-btn");
    if (btn) renderModule(Number(btn.dataset.module));
  });

  document.addEventListener("DOMContentLoaded", () => renderModule(0));
})();
