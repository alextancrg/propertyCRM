import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1e3a8a",
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          500: "#3b5bdb",
          600: "#2f4cc0",
          700: "#243ca0",
          800: "#1e3a8a",
          900: "#172b6b",
        },
        accent: "#f59e0b",
        ink: "#0f172a",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.12)",
        lift: "0 2px 6px -2px rgb(15 23 42 / 0.08), 0 20px 40px -20px rgb(15 23 42 / 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
