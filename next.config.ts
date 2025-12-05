// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "goezpdzmrmkgumninuln.supabase.co",
        pathname: "/**",
      },
    ],
    localPatterns: [
      { pathname: "/api/groups/storage", search: "?path=**" },
      { pathname: "/api/photos/avatars", search: "?path=**" },
    ],
  },
};

export default nextConfig;
