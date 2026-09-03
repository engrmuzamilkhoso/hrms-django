/**
 * Port of components/SearchSelect.tsx - a searchable single-select combobox
 * replacing native <select> for large option lists (managers, designations,
 * departments, leave policies, employees, ...). Progressively enhances
 * markup rendered by templates/partials/_search_select.html: reads the
 * options list from an embedded JSON <script> tag, keeps a hidden <input>
 * in sync for normal form submission, and reproduces the same
 * open/filter/click-outside/select behavior as the React original.
 */
(function () {
  function init(root) {
    const optionsEl = root.querySelector(".js-ss-options");
    let options = JSON.parse(optionsEl.textContent || "[]");
    const hiddenInput = root.querySelector(".js-ss-input");
    const trigger = root.querySelector(".js-ss-trigger");
    const triggerLabel = root.querySelector(".js-ss-trigger-label");
    const chevron = root.querySelector(".js-ss-chevron");
    const panel = root.querySelector(".js-ss-panel");
    const searchInput = root.querySelector(".js-ss-search");
    const list = root.querySelector(".js-ss-list");
    const placeholder = root.dataset.placeholder || "Select…";

    function findOption(value) {
      return options.find((o) => String(o.value) === String(value));
    }

    function renderTrigger() {
      const selected = findOption(hiddenInput.value);
      triggerLabel.innerHTML = "";
      const main = document.createElement("span");
      if (selected) {
        main.textContent = selected.label;
      } else {
        main.textContent = placeholder;
        main.classList.add("text-slate-400");
      }
      triggerLabel.appendChild(main);
      if (selected && selected.sub) {
        const sub = document.createElement("span");
        sub.className = "text-[11px] text-slate-500 leading-tight";
        sub.textContent = selected.sub;
        triggerLabel.appendChild(sub);
      }
    }

    function renderList(query) {
      const q = (query || "").toLowerCase();
      const filtered = q
        ? options.filter(
            (o) =>
              o.label.toLowerCase().includes(q) ||
              (o.sub || "").toLowerCase().includes(q)
          )
        : options;

      list.innerHTML = "";
      if (filtered.length === 0) {
        const li = document.createElement("li");
        li.className = "px-3 py-2.5 text-xs text-slate-400 text-center";
        li.textContent = "No results";
        list.appendChild(li);
        return;
      }

      filtered.forEach((opt) => {
        const isActive = String(opt.value) === String(hiddenInput.value);
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `flex w-full items-center justify-between px-3 py-2.5 text-sm transition ${
          isActive
            ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 font-medium"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/6 hover:text-slate-900 dark:hover:text-white"
        }`;

        const labelWrap = document.createElement("span");
        labelWrap.className = "flex flex-col items-start text-left";
        const mainLabel = document.createElement("span");
        mainLabel.textContent = opt.label;
        labelWrap.appendChild(mainLabel);
        if (opt.sub) {
          const subLabel = document.createElement("span");
          subLabel.className = "text-[11px] text-slate-400 leading-tight";
          subLabel.textContent = opt.sub;
          labelWrap.appendChild(subLabel);
        }
        btn.appendChild(labelWrap);

        if (isActive) {
          btn.insertAdjacentHTML(
            "beforeend",
            '<svg class="h-3.5 w-3.5 text-violet-500 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
          );
        }

        btn.addEventListener("click", () => select(opt.value));
        li.appendChild(btn);
        list.appendChild(li);
      });
    }

    function select(value) {
      hiddenInput.value = value;
      hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      renderTrigger();
      close();
    }

    function open() {
      panel.hidden = false;
      chevron.classList.add("rotate-180");
      searchInput.value = "";
      renderList("");
      setTimeout(() => searchInput.focus(), 0);
    }

    function close() {
      panel.hidden = true;
      chevron.classList.remove("rotate-180");
    }

    function isOpen() {
      return !panel.hidden;
    }

    trigger.addEventListener("click", () => {
      if (trigger.disabled) return;
      isOpen() ? close() : open();
    });

    searchInput.addEventListener("input", () => renderList(searchInput.value));

    document.addEventListener("mousedown", (e) => {
      if (!root.contains(e.target)) close();
    });

    renderTrigger();
    close();

    root._searchSelect = {
      setOptions(newOptions) {
        options = newOptions || [];
        renderTrigger();
        if (isOpen()) renderList(searchInput.value);
      },
      setValue(value) {
        hiddenInput.value = value == null ? "" : String(value);
        renderTrigger();
      },
      getValue() {
        return hiddenInput.value;
      },
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".js-search-select").forEach(init);
  });

  window.reinitSearchSelects = function (container) {
    (container || document).querySelectorAll(".js-search-select").forEach(init);
  };

  window.searchSelect = function (idOrEl) {
    const el = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
    return el ? el._searchSelect : null;
  };
})();
