import type { Config } from "tailwindcss";

/**
 * Same token system as greyform.org — one design language across the studio.
 * Colors are RGB triplets on :root so opacity modifiers keep working.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        raised: "rgb(var(--raised) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "fluid-xs": "clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)",
        "fluid-sm": "clamp(0.875rem, 0.8rem + 0.375vw, 1rem)",
        "fluid-base": "clamp(1rem, 0.9rem + 0.5vw, 1.125rem)",
        "fluid-lg": "clamp(1.125rem, 1rem + 0.625vw, 1.375rem)",
        "fluid-xl": "clamp(1.375rem, 1.2rem + 0.875vw, 1.75rem)",
        "fluid-2xl": "clamp(1.75rem, 1.5rem + 1.25vw, 2.5rem)",
        "fluid-3xl": "clamp(2.25rem, 1.85rem + 2vw, 3.5rem)",
        "fluid-4xl": "clamp(3rem, 2.25rem + 3.75vw, 5.5rem)",
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};
export default config;
