(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  const PIPELINE_STAGES = ["Applied", "CV Screening", "Phone Screen", "Technical Test", "Interview", "Offer", "Hired", "Rejected"];
  const STAGE_COLOR = {
    Applied: "border-slate-600", "CV Screening": "border-blue-600", "Phone Screen": "border-indigo-600",
    "Technical Test": "border-violet-600", Interview: "border-purple-600", Offer: "border-amber-600",
    Hired: "border-emerald-600", Rejected: "border-rose-600",
  };

  let jobs = [];
  let candidates = [];
  let selectedJobId = null;

  function switchTab(tab) {
    document.querySelectorAll("#rec-tab-bar .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
    if (tab === "pipeline") renderPipeline();
  }

  async function load() {
    try {
      const [j, c] = await Promise.all([apiRequest("/job-postings"), apiRequest("/candidates")]);
      jobs = unwrapData(j)?.data || [];
      candidates = unwrapData(c)?.data || [];
      if (!selectedJobId && jobs.length > 0) selectedJobId = jobs[0].id;
      renderJobs();
      renderCandidateJobSelect();
    } catch (err) {
      /* silent, matches original */
    }
  }

  function scoreBadge(score) {
    if (score == null) return "";
    const color = score >= 70 ? "bg-emerald-500/20 text-emerald-300" : score >= 40 ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300";
    return `<span class="rounded-full px-2 py-0.5 text-xs font-medium ${color}">${score}</span>`;
  }

  function renderJobs() {
    const list = document.getElementById("jobs-list");
    if (jobs.length === 0) {
      list.innerHTML = '<p class="text-sm text-slate-500">No job postings yet.</p>';
      return;
    }
    list.innerHTML = "";
    jobs.forEach((job) => {
      const jobCandidates = candidates.filter((c) => c.job_posting_id === job.id);
      const stageChips = PIPELINE_STAGES.slice(0, -2)
        .map((s) => {
          const count = jobCandidates.filter((c) => c.stage === s).length;
          return count > 0 ? `<span class="rounded bg-slate-800 px-1.5 py-0.5">${esc(s)}: ${count}</span>` : "";
        })
        .join("");
      const div = document.createElement("div");
      div.className = "rounded-xl border border-slate-800 bg-slate-900/60 p-5";
      div.innerHTML = `
        <div class="flex items-start justify-between">
          <div>
            <p class="font-semibold">${esc(job.title)}</p>
            <p class="mt-1 text-sm text-slate-400 line-clamp-2">${esc(job.job_description)}</p>
          </div>
          <div class="flex flex-col items-end gap-2 ml-4">
            <span class="rounded-full px-2 py-0.5 text-xs font-medium ${job.status === "open" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-400"}">${esc(job.status)}</span>
            <span class="form-label">${job.openings} opening${job.openings !== 1 ? "s" : ""}</span>
            <div class="flex gap-2">
              <button data-id="${job.id}" class="pipeline-link-btn text-xs text-cyan-400 hover:underline">Pipeline</button>
              <button data-id="${job.id}" data-status="${job.status}" class="toggle-status-btn text-xs text-slate-400 hover:underline">${job.status === "open" ? "Close" : "Reopen"}</button>
            </div>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>${jobCandidates.length} candidates</span>
          ${stageChips}
        </div>`;
      list.appendChild(div);
    });

    list.querySelectorAll(".pipeline-link-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        selectedJobId = Number(btn.dataset.id);
        switchTab("pipeline");
      })
    );
    list.querySelectorAll(".toggle-status-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const newStatus = btn.dataset.status === "open" ? "closed" : "open";
        try {
          await apiRequest(`/job-postings/${btn.dataset.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
          pushToast(`Job ${newStatus}`, "success");
          load();
        } catch (err) {
          pushToast(err.message || "Error", "error");
        }
      })
    );
  }

  function renderCandidateJobSelect() {
    const select = document.getElementById("candidate-job-select");
    const current = select.value;
    select.innerHTML = '<option value="">Select job</option>' + jobs.map((j) => `<option value="${j.id}">${esc(j.title)}</option>`).join("");
    select.value = current;
  }

  function renderPipeline() {
    const filterWrap = document.getElementById("pipeline-job-filter");
    const jobSelect = document.getElementById("pipeline-job-select");
    if (jobs.length > 0) {
      filterWrap.hidden = false;
      jobSelect.innerHTML = jobs.map((j) => `<option value="${j.id}">${esc(j.title)}</option>`).join("");
      jobSelect.value = selectedJobId;
    } else {
      filterWrap.hidden = true;
    }
    const jobCandidates = candidates.filter((c) => !selectedJobId || c.job_posting_id === selectedJobId);
    document.getElementById("pipeline-candidate-count").textContent = jobs.length > 0 ? `${jobCandidates.length} candidates` : "";

    const board = document.getElementById("pipeline-board");
    board.style.minWidth = `${PIPELINE_STAGES.length * 220}px`;
    board.innerHTML = "";
    PIPELINE_STAGES.forEach((stage) => {
      const stageCandidates = jobCandidates.filter((c) => c.stage === stage || (!c.stage && stage === "Applied"));
      const col = document.createElement("div");
      col.className = `w-52 flex-shrink-0 rounded-xl border-t-2 ${STAGE_COLOR[stage] || "border-slate-600"} border-x border-b border-slate-800 bg-slate-900/60`;
      const cards = stageCandidates
        .map((c) => {
          const moveButtons = PIPELINE_STAGES.filter((s) => s !== stage && s !== "Rejected")
            .map((s) => `<button data-id="${c.id}" data-stage="${esc(s)}" class="move-stage-btn text-[10px] text-slate-400 hover:text-cyan-400 transition">→${esc(s.split(" ")[0])}</button>`)
            .join("");
          return `
          <div class="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div class="flex items-start justify-between gap-1">
              <p class="text-xs font-medium leading-tight">${esc(c.full_name)}</p>
              ${scoreBadge(c.ai_score)}
            </div>
            <p class="mt-0.5 text-[10px] text-slate-500">${esc(c.email)}</p>
            ${c.source ? `<p class="text-[10px] text-slate-600 mt-0.5">${esc(c.source)}</p>` : ""}
            <div class="mt-2 flex flex-wrap gap-1">
              ${moveButtons}
              ${stage === "Offer" ? `<button data-id="${c.id}" class="accept-offer-btn text-[10px] text-emerald-400 font-semibold hover:underline">Convert→Emp</button>` : ""}
              <button data-id="${c.id}" data-stage="Rejected" class="move-stage-btn text-[10px] text-rose-400 hover:underline">Reject</button>
            </div>
          </div>`;
        })
        .join("");
      col.innerHTML = `
        <div class="px-3 py-2 border-b border-slate-800">
          <span class="text-xs font-semibold text-slate-300">${esc(stage)}</span>
          <span class="ml-2 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">${stageCandidates.length}</span>
        </div>
        <div class="p-2 space-y-2 min-h-[200px]">${cards || '<p class="text-center text-[11px] text-slate-700 pt-4">Empty</p>'}</div>`;
      board.appendChild(col);
    });

    board.querySelectorAll(".move-stage-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await apiRequest(`/candidates/${btn.dataset.id}/stage`, { method: "POST", body: JSON.stringify({ stage: btn.dataset.stage }) });
          pushToast(`Moved to ${btn.dataset.stage}`, "success");
          await load();
          renderPipeline();
        } catch (err) {
          pushToast(err.message || "Error", "error");
        }
      })
    );
    board.querySelectorAll(".accept-offer-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await apiRequest(`/candidates/${btn.dataset.id}/accept-offer`, { method: "POST" });
          pushToast("Converted to employee", "success");
          await load();
          renderPipeline();
        } catch (err) {
          pushToast(err.message || "Error", "error");
        }
      })
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();

    document.getElementById("rec-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn) switchTab(btn.dataset.tab);
    });

    document.getElementById("pipeline-job-select").addEventListener("change", (e) => {
      selectedJobId = Number(e.target.value);
      renderPipeline();
    });

    document.getElementById("job-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = document.getElementById("job-save-btn");
      const spinner = document.getElementById("job-save-spinner");
      const label = document.getElementById("job-save-label");
      btn.disabled = true;
      spinner.hidden = false;
      label.textContent = "Creating…";
      try {
        await apiRequest("/job-postings", {
          method: "POST",
          body: JSON.stringify({
            title: fd.get("title"),
            job_description: fd.get("job_description"),
            openings: Number(fd.get("openings") || 1),
            deadline: fd.get("deadline") || undefined,
          }),
        });
        pushToast("Job posting created", "success");
        e.target.reset();
        load();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
        spinner.hidden = true;
        label.textContent = "Create Job Posting";
      }
    });

    document.getElementById("candidate-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = document.getElementById("candidate-save-btn");
      const spinner = document.getElementById("candidate-save-spinner");
      const label = document.getElementById("candidate-save-label");
      btn.disabled = true;
      spinner.hidden = false;
      label.textContent = "Adding…";
      try {
        await apiRequest("/candidates", {
          method: "POST",
          body: JSON.stringify({
            job_posting_id: Number(fd.get("job_posting_id")),
            full_name: fd.get("full_name"),
            email: fd.get("email"),
            source: fd.get("source"),
          }),
        });
        pushToast("Candidate added", "success");
        e.target.reset();
        load();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      } finally {
        btn.disabled = false;
        spinner.hidden = true;
        label.textContent = "Add to Pipeline";
      }
    });
  });
})();
