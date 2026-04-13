import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./constants/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        /** Brand Emerald — checklist: `bg-emerald-900` → #00695C */
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
      },
    },
  },
  plugins: [],
};
export default config;
