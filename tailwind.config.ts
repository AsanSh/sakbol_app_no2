import type { Config } from "tailwindcss";

/** Минимальный конфиг: только нужные `content` + бренд-цвета (mint/coral и т.д.). */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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
      colors: {
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
          DEFAULT: "#F28B82",
          soft: "#F28B82",
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
