import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.myntra.com",
      },
      {
        protocol: "https",
        hostname: "**.ajio.com",
      },
    ],
  },
};

export default nextConfig;
