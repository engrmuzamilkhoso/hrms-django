/**
 * Port of components/ToastProvider.tsx - same 3.5s auto-dismiss stack,
 * same icon glyphs and colors per type.
 */
const TOAST_ICONS = { success: "✓", error: "✕", info: "ℹ" };
const TOAST_COLORS = {
  success: { bg: "#0f172a", border: "#22c55e40", icon: "#22c55e" },
  error: { bg: "#0f172a", border: "#ef444440", icon: "#ef4444" },
  info: { bg: "#0f172a", border: "#1c62fd40", icon: "#1c62fd" },
};

function pushToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const c = TOAST_COLORS[type] || TOAST_COLORS.info;

  const el = document.createElement("div");
  el.style.cssText = `background:${c.bg};border:1px solid ${c.border};color:#f1f5f9;border-radius:10px;padding:10px 16px;font-size:13.5px;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.35);display:flex;align-items:center;gap:10px;min-width:220px;max-width:360px;pointer-events:auto;animation:toast-in 0.22s ease;`;

  const icon = document.createElement("span");
  icon.style.cssText = `color:${c.icon};font-weight:700;font-size:15px;line-height:1;`;
  icon.textContent = TOAST_ICONS[type] || TOAST_ICONS.info;

  const text = document.createElement("span");
  text.textContent = message;

  el.appendChild(icon);
  el.appendChild(text);
  container.appendChild(el);

  setTimeout(() => el.remove(), 3500);
}

window.pushToast = pushToast;
