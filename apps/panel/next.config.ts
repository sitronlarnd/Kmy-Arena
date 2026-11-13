import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@kmy/shared", "@kmy/ai"],
  poweredByHeader: false,
};

export default config;
