(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function downloadTemplate() {
    const template = [
      ["Employee Code", "Full Name", "Email", "Phone", "Hire Date", "Office ID", "Department ID", "Designation", "Employment Status"],
      ["EMP001", "John Doe", "john@example.com", "+1234567890", "2026-01-01", "", "", "Software Engineer", "active"],
    ];
    const csv = template.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee_import_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function renderResults(result) {
    document.getElementById("import-results").hidden = false;
    document.getElementById("result-imported").textContent = result.imported_count;

    const dupCard = document.getElementById("result-duplicates-card");
    dupCard.hidden = !(result.duplicate_count > 0);
    document.getElementById("result-duplicates").textContent = result.duplicate_count;

    const errCard = document.getElementById("result-errors-card");
    errCard.hidden = !(result.error_count > 0);
    document.getElementById("result-errors").textContent = result.error_count;

    const errorsSection = document.getElementById("errors-section");
    if (result.errors.length > 0) {
      errorsSection.hidden = false;
      document.getElementById("errors-list").innerHTML = result.errors
        .map((err) => `<p class="text-xs text-slate-400 bg-red-500/10 rounded-lg px-3 py-2">Row ${err.row}: ${esc(err.message)}</p>`)
        .join("");
    } else {
      errorsSection.hidden = true;
    }

    const dupSection = document.getElementById("duplicates-section");
    if (result.duplicates.length > 0) {
      dupSection.hidden = false;
      document.getElementById("duplicates-list").innerHTML = result.duplicates
        .map((dup) => `<p class="text-xs text-slate-400 bg-amber-500/10 rounded-lg px-3 py-2">Row ${dup.row} (${esc(dup.code)}): ${esc(dup.message)}</p>`)
        .join("");
    } else {
      dupSection.hidden = true;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("file-input");
    fileInput.addEventListener("change", () => {
      const label = document.getElementById("dropzone-label");
      label.textContent = fileInput.files[0] ? fileInput.files[0].name : "Click to upload or drag and drop";
    });

    document.getElementById("download-template-btn").addEventListener("click", downloadTemplate);

    document.getElementById("import-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorBox = document.getElementById("import-error");
      const successBox = document.getElementById("import-success");
      errorBox.hidden = true;
      successBox.hidden = true;
      document.getElementById("import-results").hidden = true;

      if (!fileInput.files[0]) {
        errorBox.hidden = false;
        document.getElementById("import-error-text").textContent = "Please select a file";
        return;
      }

      const form = e.target;
      const fd = new FormData();
      fd.append("file", fileInput.files[0]);
      fd.append("skip_duplicates", form.skip_duplicates.checked ? "true" : "false");
      fd.append("auto_send_credentials", form.auto_send_credentials.checked ? "true" : "false");

      const btn = document.getElementById("import-submit-btn");
      btn.disabled = true;
      btn.querySelector("span").textContent = "Importing…";
      try {
        const response = await fetch("/api/v1/employees/import", {
          method: "POST",
          headers: { "X-CSRFToken": getCsrfToken() },
          credentials: "same-origin",
          body: fd,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Import failed");
        renderResults(data.data);
        successBox.hidden = false;
        document.getElementById("import-success-text").textContent = `Successfully imported ${data.data.imported_count} employees`;
      } catch (err) {
        errorBox.hidden = false;
        document.getElementById("import-error-text").textContent = err.message || "An error occurred";
      } finally {
        btn.disabled = false;
        btn.querySelector("span").textContent = "Import Employees";
      }
    });
  });
})();
