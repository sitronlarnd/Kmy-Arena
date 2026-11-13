import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@kmy/shared"],
  poweredByHeader: false,
};

export default config;
