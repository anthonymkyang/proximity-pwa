import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next/Image to optimize images coming from Supabase Storage
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  // Silence the dev warning about cross-origin requests to /_next/* when testing on LAN
  // Update the IP below if you use a different device/host on your network
  allowedDevOrigins: ["192.168.0.102", "localhost", "127.0.0.1"],
};

export default nextConfig;
