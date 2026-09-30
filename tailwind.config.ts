import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* App tokens. The landing surface reads the --n-* custom properties
           in globals.css directly, so it needs no entries here. */
        "primary": "rgb(var(--primary) / <alpha-value>)",
        "on-primary": "rgb(var(--on-primary) / <alpha-value>)",
        "secondary": "rgb(var(--secondary) / <alpha-value>)",
        "on-secondary": "rgb(var(--on-secondary) / <alpha-value>)",
        "background": "rgb(var(--background) / <alpha-value>)",
        "surface": "rgb(var(--surface) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--surface-container-highest) / <alpha-value>)",
        "on-surface": "rgb(var(--on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--on-surface-variant) / <alpha-value>)",
        "outline-variant": "rgb(var(--outline-variant) / <alpha-value>)",
        "tertiary": "rgb(var(--tertiary) / <alpha-value>)",
        "on-tertiary": "rgb(var(--on-tertiary) / <alpha-value>)",
        /* Used by ~200 error states (text-error, bg-error-container, ...) that
           rendered colourless before these tokens existed. */
        "error": "rgb(var(--error) / <alpha-value>)",
        "on-error": "rgb(var(--on-error) / <alpha-value>)",
        "error-container": "rgb(var(--error-container) / <alpha-value>)",
        "on-error-container": "rgb(var(--on-error-container) / <alpha-value>)",
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "md": "0.75rem",
        "lg": "1rem",
        "xl": "1.5rem",
        "2xl": "2rem",
        "3xl": "2.5rem",
        "full": "9999px"
      },
      boxShadow: {
        /* `shadow-xs` is used across the landing surface. It is a Tailwind v4
           name, so under v3 it needs defining here or it compiles to nothing. */
        "xs": "0 1px 2px 0 rgb(0 0 0 / 0.06)",
      },
      fontFamily: {
        "sans": ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        "display": ["var(--font-albert)", "var(--font-dm-sans)", "system-ui", "sans-serif"],
        "mono": ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        "headline": ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        "body": ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
