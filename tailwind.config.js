/** Ported verbatim from saas-hrms-frontend/tailwind.config.ts, content globs
 * updated to scan Django templates/static JS instead of Next.js app/components. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./templates/**/*.html", "./static/js/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      colors: {
        "white/3": "rgba(255,255,255,0.03)",
        "white/6": "rgba(255,255,255,0.06)",
        "white/7": "rgba(255,255,255,0.07)",
        violet: {
          50: "#eef4ff", 100: "#dce8ff", 200: "#b9d1ff", 300: "#8bb0ff",
          400: "#4c82ff", 500: "#1c62fd", 600: "#0156fc", 700: "#0045d1",
          800: "#0038a8", 900: "#002d85", 950: "#001c54",
        },
        indigo: {
          50: "#eaf1ff", 100: "#d1e0ff", 200: "#a8c5ff", 300: "#7aa8ff",
          400: "#4788ff", 500: "#1f66fa", 600: "#0046e0", 700: "#0038b3",
          800: "#002d8f", 900: "#002370", 950: "#001440",
        },
      },
      backgroundOpacity: {
        "3": "0.03",
        "6": "0.06",
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease forwards",
        "fade-in": "fadeIn 0.3s ease forwards",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(28,98,253,0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(28,98,253,0.6)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      boxShadow: {
        "glow-violet": "0 0 40px rgba(28,98,253,0.2)",
        "glow-cyan": "0 0 40px rgba(34,211,238,0.15)",
      },
    },
  },
  plugins: [],
};
