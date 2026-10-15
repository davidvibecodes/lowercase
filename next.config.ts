import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The Prisma binary engine and Socket.IO live outside the Next bundle.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // Peer testing uses 127.0.0.1 alongside localhost (KTD4).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // SQLite writes (dev.db, -wal, -shm) must not trigger dev rebuilds: each one
  // refreshes every open page and can abort an in-flight navigation.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/*.db", "**/*.db-journal", "**/*.db-wal", "**/*.db-shm", "**/test-results/**", "**/playwright-report/**"],
      };
    }
    return config;
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
};

export default nextConfig;
