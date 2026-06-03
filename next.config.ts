import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // better-sqlite3 ships a .node binary; keep it external so Next doesn't try
  // to bundle it into the standalone server.
  serverExternalPackages: ["better-sqlite3", "mongoose"],
  // Electron loads http://127.0.0.1:<port> while next dev serves at localhost.
  // Without this, HMR over /_next/webpack-hmr is blocked as cross-origin.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
