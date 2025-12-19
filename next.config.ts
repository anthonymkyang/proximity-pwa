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
  async headers() {
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "no-store, no-cache, must-revalidate, proxy-revalidate",
            },
            {
              key: "Pragma",
              value: "no-cache",
            },
            {
              key: "Expires",
              value: "0",
            },
          ],
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
