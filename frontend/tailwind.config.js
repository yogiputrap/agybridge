/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "'JetBrains Mono'",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        // Semantic tokens resolve through CSS variables (see index.css) so the
        // same utility classes serve both the light and the dark theme.
        dark: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "rgb(var(--dk-600) / <alpha-value>)",
          700: "rgb(var(--dk-700) / <alpha-value>)",
          800: "rgb(var(--dk-800) / <alpha-value>)",
          850: "rgb(var(--dk-850) / <alpha-value>)",
          900: "rgb(var(--dk-900) / <alpha-value>)",
          950: "rgb(var(--dk-950) / <alpha-value>)",
        },
        gray: {
          100: "rgb(var(--g-100) / <alpha-value>)",
          200: "rgb(var(--g-200) / <alpha-value>)",
          300: "rgb(var(--g-300) / <alpha-value>)",
          400: "rgb(var(--g-400) / <alpha-value>)",
          500: "rgb(var(--g-500) / <alpha-value>)",
          600: "rgb(var(--g-600) / <alpha-value>)",
        },
        purple: {
          200: "rgb(var(--ac-200) / <alpha-value>)",
          300: "rgb(var(--ac-300) / <alpha-value>)",
          400: "rgb(var(--ac-400) / <alpha-value>)",
          500: "rgb(var(--ac-500) / <alpha-value>)",
          600: "rgb(var(--ac-600) / <alpha-value>)",
          700: "rgb(var(--ac-700) / <alpha-value>)",
          800: "rgb(var(--ac-800) / <alpha-value>)",
          900: "rgb(var(--ac-900) / <alpha-value>)",
        },
        ink: "rgb(var(--ink) / <alpha-value>)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        pill: "var(--shadow-pill)",
      },
      borderRadius: {
        "3xl": "1.75rem",
      },
    },
  },
  plugins: [],
};
