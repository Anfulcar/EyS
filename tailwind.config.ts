import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      colors: {
        brand: { 50: "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca", 900: "#312e81" },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;
