import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Prisma binary engine and Socket.IO live outside the Next bundle.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // Peer testing uses 127.0.0.1 alongside localhost (KTD4).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
};

export default nextConfig;
