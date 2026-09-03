/**
 * Pixel-precise port of app/platform/notifications/page.tsx.
 */
(function () {
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  let notifications = [];
  let prefs = [];

  function switchTab(tab) {
    document.querySelectorAll("#notif-tab-bar .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }

  async function loadNotifications() {
    try {
      const r = await apiRequest("/notifications?per_page=100");
      notifications = unwrapData(r)?.data || [];
    } catch (err) {
      /* silent, matches source */
    }
    renderInbox();
  }

  async function loadPrefs() {
    try {
      const r = await apiRequest("/notification-preferences?per_page=100");
      prefs = unwrapData(r)?.data || [];
    } catch (err) {
      /* silent, matches source */
    }
    renderPrefs();
  }

  function renderInbox() {
    const unreadCount = notifications.filter((n) => n.status === "unread").length;
    document.getElementById("notif-summary").textContent = `${notifications.length} notifications · ${unreadCount} unread`;
    const badge = document.getElementById("notif-unread-badge");
    badge.hidden = unreadCount === 0;
    badge.textContent = unreadCount;
    document.getElementById("notif-mark-all-btn").hidden = unreadCount === 0;

    const list = document.getElementById("notif-list");
    if (notifications.length === 0) {
      list.innerHTML = '<p class="text-sm text-slate-500">No notifications.</p>';
      return;
    }
    list.innerHTML = "";
    notifications.forEach((n) => {
      const unread = n.status === "unread";
      const row = document.createElement("div");
      row.className = `rounded-lg border p-4 transition ${unread ? "border-cyan-800 bg-cyan-950/20" : "border-slate-800 bg-slate-900/40 opacity-70"}`;
      row.innerHTML = `
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <p class="font-medium text-sm ${unread ? "text-white" : "text-slate-300"}">${esc(n.title)}</p>
            <p class="mt-0.5 text-sm text-slate-400">${esc(n.body)}</p>
            ${n.created_at ? `<p class="mt-1 text-xs text-slate-600">${new Date(n.created_at).toLocaleString()}</p>` : ""}
          </div>
          <div class="flex items-center gap-2 ml-3">
            ${unread ? '<span class="h-2 w-2 rounded-full bg-cyan-400"></span>' : ""}
            ${unread ? `<button data-id="${n.id}" class="mark-read-btn text-xs text-slate-400 hover:text-slate-200">✓</button>` : ""}
          </div>
        </div>`;
      list.appendChild(row);
    });
    list.querySelectorAll(".mark-read-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await apiRequest(`/notifications/${btn.dataset.id}/read`, { method: "POST" });
          loadNotifications();
        } catch (err) {
          /* silent */
        }
      })
    );
  }

  function renderPrefs() {
    const wrap = document.getElementById("pref-list-wrap");
    if (prefs.length === 0) {
      wrap.innerHTML = '<p class="text-sm text-slate-500">No preferences configured yet.</p>';
      return;
    }
    wrap.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="border-b border-slate-800 text-left text-xs text-slate-400"><th class="pb-2 pr-4">Event</th><th class="pb-2 pr-3 text-center">In-App</th><th class="pb-2 pr-3 text-center">Email</th><th class="pb-2 pr-3 text-center">SMS</th><th class="pb-2 pr-3 text-center">WhatsApp</th><th class="pb-2 text-center">Digest</th></tr></thead>
          <tbody>
            ${prefs
              .map(
                (p) => `
              <tr class="border-b border-slate-800/50">
                <td class="py-2 pr-4 text-xs text-slate-300">${esc(p.event_key)}</td>
                ${[p.in_app_enabled, p.email_enabled, p.sms_enabled, p.whatsapp_enabled, p.digest_mode]
                  .map((v) => `<td class="py-2 pr-3 text-center">${v ? '<span class="text-emerald-400">✓</span>' : '<span class="text-slate-700">—</span>'}</td>`)
                  .join("")}
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadNotifications();
    loadPrefs();

    document.getElementById("notif-tab-bar").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab-btn");
      if (btn) switchTab(btn.dataset.tab);
    });

    document.getElementById("notif-mark-all-btn").addEventListener("click", async () => {
      const unread = notifications.filter((n) => n.status === "unread");
      await Promise.allSettled(unread.map((n) => apiRequest(`/notifications/${n.id}/read`, { method: "POST" })));
      pushToast(`${unread.length} marked as read`, "success");
      loadNotifications();
    });

    document.getElementById("pref-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await apiRequest("/notification-preferences", {
          method: "POST",
          body: JSON.stringify({
            event_key: fd.get("event_key"),
            in_app_enabled: fd.get("in_app_enabled") === "on",
            email_enabled: fd.get("email_enabled") === "on",
            sms_enabled: fd.get("sms_enabled") === "on",
            whatsapp_enabled: fd.get("whatsapp_enabled") === "on",
            digest_mode: fd.get("digest_mode") === "on",
          }),
        });
        pushToast("Preference saved", "success");
        loadPrefs();
        e.target.reset();
      } catch (err) {
        pushToast(err.message || "Error", "error");
      }
    });
  });
})();
