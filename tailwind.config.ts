import type { Config } from "tailwindcss";

const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  important: "#__next",
  // Tailwind v3-style safelist — we force it through TS with a cast
  safelist: [
    // Padding and positioning
    "pt-[70px]",
    "pb-[70px]",
    "bottom-[54px]",
    "bottom-[53px]",

    // Background gradients and text colors
    "bg-gradient-to-br",
    "from-blue-500",
    "via-blue-600",
    "to-indigo-500",
    "bg-card/95",
    "supports-backdrop-filter:bg-card/80",
    "bg-background/80",
    "bg-background/90",
    "bg-card",

    // Layout widths and grid configs
    "max-w-[75%]",
    "h-[100px]",
    "w-[100px]",
    "min-w-[100px]",
    "min-h-[100px]",
    "aspect-square",
    "size-[100px]",
    "h-20",
    "w-20",
    "grid-cols-3",
    "grid-cols-4",
    "gap-3",
    "gap-4",

    // Z-index utilities
    "z-20",
    "z-40",
    "z-50",
    "z-9999",
    "z-[90]",
    "z-[11000]",
    "z-[11001]",

    // Blur/backdrop utilities
    "backdrop-blur",
    "backdrop-blur-sm",

    // Rounded and borders
    "rounded-full",
    "rounded-md",

    // Text sizing utilities
    "text-xs",
    "text-sm",
    "text-[10px]",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} as unknown as Config;

export default config;
