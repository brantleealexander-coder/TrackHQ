import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // `--brand-rgb` is set per-tenant on <html> by src/app/layout.tsx.
        // Shades are derived via color-mix so customers configure a single
        // hex in tenant_config.business.brand_color.
        brand: {
          50:  "color-mix(in srgb, rgb(var(--brand-rgb)) 8%,  white)",
          100: "color-mix(in srgb, rgb(var(--brand-rgb)) 15%, white)",
          200: "color-mix(in srgb, rgb(var(--brand-rgb)) 30%, white)",
          300: "color-mix(in srgb, rgb(var(--brand-rgb)) 50%, white)",
          400: "color-mix(in srgb, rgb(var(--brand-rgb)) 75%, white)",
          500: "rgb(var(--brand-rgb))",
          600: "color-mix(in srgb, rgb(var(--brand-rgb)) 85%, black)",
          700: "color-mix(in srgb, rgb(var(--brand-rgb)) 70%, black)",
          800: "color-mix(in srgb, rgb(var(--brand-rgb)) 55%, black)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
