import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      colors: {
        // Ministerio de Turismo de la República Dominicana (colours taken from the logo)
        brand: { 50: "#eef4fb", 100: "#d7e5f6", 200: "#aecbec", 500: "#1f62b3", 600: "#0b4a92", 700: "#083b75", 900: "#062a54" },
        mitur: { blue: "#0b4a92", yellow: "#f5c400", orange: "#f39019", red: "#d81e1e", green: "#2e9e44" },
      },
      keyframes: {
        navprogress: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(300%)" } },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
