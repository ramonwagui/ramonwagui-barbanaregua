import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Permite que o servidor leia variáveis de ambiente no runtime
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
