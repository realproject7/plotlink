import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.BUILD_STANDALONE === "true" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
