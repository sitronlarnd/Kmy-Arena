// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/.expo/**",
      "**/web-build/**",
      "apps/mobile/android/**",
      "apps/mobile/ios/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Araç yapılandırmaları (metro.config.js vb.) Node CommonJS olarak çalışır.
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { require: "readonly", module: "writable", __dirname: "readonly", process: "readonly" },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
