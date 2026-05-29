import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Força renderização dinâmica — necessário pois todas as páginas acessam o banco
  // Evita que o Next.js tente pré-renderizar páginas com DB durante o build
  experimental: {
    dynamicIO: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
