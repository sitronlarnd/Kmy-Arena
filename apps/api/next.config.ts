import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@kmy/shared", "@kmy/ai", "@kmy/realtime"],
  poweredByHeader: false,
};

export default config;
