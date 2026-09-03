/**
 * Port of lib/context/ThemeContext.tsx + components/ThemeToggle.tsx.
 * The blocking pre-paint class toggle (avoids FOUC) lives inline in
 * templates/base.html, mirroring the inline <script> in app/layout.tsx:17.
 */
function currentTheme() {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function setTheme(theme) {
  const html = document.documentElement;
  if (theme === "light") {
    html.classList.add("light");
  } else {
    html.classList.remove("light");
  }
  try {
    localStorage.setItem("hrms_theme", theme);
  } catch (e) {}
  document.querySelectorAll("[data-theme-toggle]").forEach(updateToggleIcon);
}

function toggleTheme() {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
}

function updateToggleIcon(btn) {
  const isDark = currentTheme() === "dark";
  btn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
  const sun = btn.querySelector("[data-icon-sun]");
  const moon = btn.querySelector("[data-icon-moon]");
  if (sun) sun.hidden = !isDark;
  if (moon) moon.hidden = isDark;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
    updateToggleIcon(btn);
    btn.addEventListener("click", toggleTheme);
  });
});
