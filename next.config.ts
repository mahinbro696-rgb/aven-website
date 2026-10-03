import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/aven-ba684.firebasestorage.app/o/**" },
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/aven-ba684.firebasestorage.app/**" },
    ],
  },
};
export default nextConfig;
