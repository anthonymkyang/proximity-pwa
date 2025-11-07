import type { Config } from "tailwindcss";

const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  important: "#__next",
  safelist: [
    // Padding and positioning
    "pt-[70px]",
    "pb-[70px]",
    "bottom-[54px]",
    "bottom-[53px]",
    "bottom-2",
    "right-2",
    "left-2",
    "top-2",
    "absolute",
    "top-0",
    "left-0",
    "-top-0.5",
    "-left-0.5",
    "-top-1",
    "-left-1",

    // Background gradients and colors
    "bg-gradient-to-br",
    "from-blue-500",
    "via-blue-600",
    "to-indigo-500",
    "bg-card/95",
    "supports-backdrop-filter:bg-card/80",
    "bg-background/80",
    "bg-background/90",
    "bg-card",
    "bg-gradient-to-t",
    "from-black/60",
    "to-transparent",
    "bg-emerald-500",
    "bg-amber-400",
    "bg-gray-400",
    "bg-green-500",
    "bg-yellow-400",
    "bg-neutral-400",

    // Layout widths, heights, grid and aspect ratios
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
    "h-[calc(100vh-55px)]",
    "h-[calc(100svh-55px)]",
    "h-[calc(100dvh-55px)]",
    "min-h-[calc(100vh-55px)]",
    "min-h-[calc(100svh-55px)]",
    "min-h-[calc(100dvh-55px)]",
    "max-h-[calc(100vh-55px)]",
    "max-h-[calc(100svh-55px)]",
    "max-h-[calc(100dvh-55px)]",
    "aspect-[3/4]",

    // Object fit and position
    "object-cover",
    "object-center",

    // Z-index utilities
    "z-10",
    "z-20",
    "z-40",
    "z-50",
    "z-9999",
    "z-[90]",
    "z-[11000]",
    "z-[11001]",

    // Blur and backdrop
    "backdrop-blur",
    "backdrop-blur-sm",

    // Borders and rounding
    "rounded-full",
    "rounded-md",
    "ring-1",
    "ring-2",
    "ring-white",
    "ring-white/25",

    // Text sizing and overflow
    "text-xs",
    "text-sm",
    "text-[10px]",
    "overflow-visible",

    // Size utilities
    "w-1.5",
    "h-1.5",
    "w-2",
    "h-2",
    "w-2.5",
    "h-2.5",
    "size-2",
    "size-2.5",

    // Pointer events
    "pointer-events-none",
    "pointer-events-auto",

    // Translate utilities
    "translate-x-0",
    "translate-y-0",
    "-translate-x-0.5",
    "-translate-y-0.5",

    // Shadow and outline
    "shadow-none",
    "shadow",
    "shadow-md",
    "shadow-lg",
    "outline-none",
    "focus:outline-none",
    "focus:ring-0",
    "focus:ring-2",
    "focus:ring-white/25",

    // Dynamic patterns
    { pattern: /size-\[\d+(?:\.\d+)?px\]/ },
    { pattern: /-?top-\[\d+(?:\.\d+)?px\]/ },
    { pattern: /-?left-\[\d+(?:\.\d+)?px\]/ },
    { pattern: /-?right-\[\d+(?:\.\d+)?px\]/ },
    { pattern: /-?bottom-\[\d+(?:\.\d+)?px\]/ },
    { pattern: /-?translate-x-\[\d+(?:\.\d+)?px\]/ },
    { pattern: /-?translate-y-\[\d+(?:\.\d+)?px\]/ },
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} as unknown as Config;

export default config;
