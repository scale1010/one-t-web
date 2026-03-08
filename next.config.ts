import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare compatibility
  output: 'standalone',
  
  // Optional: Configure images if you use next/image
  images: {
    // Cloudflare supports remote images, configure domains as needed
    remotePatterns: [],
  },
};

export default nextConfig;
