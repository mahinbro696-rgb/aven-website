import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const policy = [
      "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'", "font-src 'self'",
      "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://storage.googleapis.com https://res.cloudinary.com",
      "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://firebasestorage.googleapis.com https://aven-ba684.firebaseapp.com" + (process.env.NODE_ENV === "development" ? " ws://localhost:* ws://127.0.0.1:*" : ""),
      "frame-src https://aven-ba684.firebaseapp.com",
      "upgrade-insecure-requests",
    ].join("; ");
    return [
      { source: "/:path*", headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ] },
      { source: "/admin/:path*", headers: [
        { key: "Content-Security-Policy", value: policy },
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
      ] },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/aven-ba684.firebasestorage.app/o/**" },
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/aven-ba684.firebasestorage.app/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
  },
};
export default nextConfig;
