import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf"],
  experimental: {
    middlewareClientMaxBodySize: "64mb",
  },
};

export default nextConfig;
