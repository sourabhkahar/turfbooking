import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the Docker multi-stage build (copies only production files)
  output: "standalone",

  // Allow images served from the backend /uploads route
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "5000",
        pathname: "/uploads/**",
      },
      {
        // Production API domain — set via NEXT_PUBLIC_API_URL
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_API_HOST || "localhost",
        pathname: "/uploads/**",
      },
    ],
  },

  // HTTP Security Headers applied to every response
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: http://localhost:5000 https:",
              "connect-src 'self' http://localhost:5000 https://api.razorpay.com",
              "frame-src https://api.razorpay.com",
              "font-src 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
