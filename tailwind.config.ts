import type { Config } from "tailwindcss";

const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Tailwind v3-style safelist — we force it through TS with a cast
  safelist: [
    "pt-[70px]",
    "pb-[70px]",
    "bottom-[54px]",
    "bg-gradient-to-br",
    "from-blue-500",
    "via-blue-600",
    "to-indigo-500",
    "max-w-[75%]",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} as unknown as Config;

export default config;
