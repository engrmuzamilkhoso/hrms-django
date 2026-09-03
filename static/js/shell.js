/**
 * Small interactive glue for the platform/super-admin shell partials -
 * sidebar collapse toggle, account menu dropdown, and the sign-out overlay
 * transition. Ports the equivalent useState/useEffect wiring from
 * app/platform/layout.tsx (sidebarOpen, AccountMenu, loggingOut).
 */
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle");
  const main = document.getElementById("main-content");

  if (sidebar && toggleBtn && main) {
    toggleBtn.addEventListener("click", () => {
      const collapsed = sidebar.classList.toggle("w-16");
      sidebar.classList.toggle("w-60", !collapsed);
      main.classList.toggle("pl-16", collapsed);
      main.classList.toggle("pl-60", !collapsed);
      document.querySelectorAll(".sidebar-label").forEach((el) => {
        el.hidden = collapsed;
      });
    });
  }

  const menuTrigger = document.getElementById("account-menu-trigger");
  const menuPanel = document.getElementById("account-menu-panel");
  const menuRoot = document.getElementById("account-menu");
  if (menuTrigger && menuPanel && menuRoot) {
    menuTrigger.addEventListener("click", () => {
      menuPanel.hidden = !menuPanel.hidden;
    });
    document.addEventListener("mousedown", (e) => {
      if (!menuRoot.contains(e.target)) menuPanel.hidden = true;
    });
  }

  const logoutForm = document.getElementById("logout-form");
  const logoutOverlay = document.getElementById("logout-overlay");
  if (logoutForm && logoutOverlay) {
    logoutForm.addEventListener("submit", () => {
      logoutOverlay.style.display = "flex";
    });
  }
});
