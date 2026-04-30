import type { Config } from "tailwindcss";

/** Дизайн-система Sakbol: медицинский премиум-палитра + типографика. */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./features/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        /** H1 — 32px */
        h1: ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em" }],
        /** H1 — 32px */
        display: ["2rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em" }],
        /** H2 — 24px */
        h2: ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.02em" }],
        /** H3 — 18px */
        h3: ["1.125rem", { lineHeight: "1.5rem", letterSpacing: "-0.01em" }],
        /** H4 — 16px */
        h4: ["1rem", { lineHeight: "1.375rem", letterSpacing: "-0.01em" }],
        /** Body — 15 regular */
        body: ["0.9375rem", { lineHeight: "1.5rem" }],
        /** Small — 13px */
        small: ["0.8125rem", { lineHeight: "1.125rem" }],
        /** Caption — 12 medium */
        caption: ["0.75rem", { lineHeight: "1rem" }],
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        manrope: ["var(--font-manrope)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "sakbol-scan": {
          "0%": { transform: "translateY(-120%)" },
          "100%": { transform: "translateY(420%)" },
        },
      },
      animation: {
        "sakbol-scan": "sakbol-scan 2.1s ease-in-out infinite",
      },
      backgroundImage: {
        /** Основной CTA: изумруд → коралл, без заливки всего экрана */
        "sakbol-cta":
          "linear-gradient(105deg, #004253 0%, #0d6b5c 52%, #cf5f52 100%)",
        "sakbol-cta-soft":
          "linear-gradient(105deg, #005b71 0%, #1a7a6a 45%, #e07a6f 100%)",
      },
      boxShadow: {
        surface: "0 6px 20px -10px rgba(15, 23, 42, 0.14), 0 2px 8px -4px rgba(15, 118, 110, 0.1)",
        "cta-coral": "0 10px 28px -6px rgba(207, 95, 82, 0.35), 0 4px 12px -4px rgba(0, 66, 83, 0.2)",
        "health-soft":
          "0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 10px 24px -8px rgba(15, 118, 110, 0.12)",
        "health-lift": "0 18px 40px -12px rgba(15, 23, 42, 0.12), 0 8px 16px -8px rgba(15, 118, 110, 0.08)",
      },
      borderRadius: {
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
      colors: {
        primary: "#0F766E",
        secondary: "#14B8A6",
        accent: "#22C55E",
        bg: "#F8FAFC",
        surface: "#FFFFFF",
        text: "#0F172A",
        health: {
          primary: "#0F766E",
          secondary: "#14B8A6",
          positive: "#22C55E",
          warning: "#F59E0B",
          danger: "#EF4444",
          bg: "#F8FAFC",
          surface: "#FFFFFF",
          text: "#0F172A",
          "text-secondary": "#64748B",
          border: "#E2E8F0",
        },
        emerald: {
          50: "#e8f5f3",
          100: "#c8ebe4",
          200: "#a3d9cd",
          300: "#7bc7b4",
          400: "#4da995",
          500: "#2d8f7a",
          600: "#00796b",
          700: "#00695c",
          800: "#00574b",
          900: "#00695C",
          950: "#00352e",
        },
        mint: {
          DEFAULT: "#B2DFDB",
          foreground: "#004d40",
        },
        amber: {
          300: "#ffd54f",
          400: "#ffca28",
          500: "#FFC107",
          600: "#ffb300",
          DEFAULT: "#FFC107",
        },
        coral: {
          DEFAULT: "#E86B5E",
          /** Акцент для CTA / hover */
          deep: "#c75a52",
          soft: "#F28B82",
          /** Лёгкий фон под коралловые блоки */
          mist: "#fde8e5",
        },
        sakbol: {
          primary: "#004253",
          primary2: "#005b71",
          muted: "#70787d",
          border: "#e7e8e9",
          air: "#d4e6e9",
          warnBg: "#ffdcc0",
          errorBg: "#ffdad6",
          errorText: "#93000a",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
