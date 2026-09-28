import path from "node:path";
import { defineConfig } from "vitest/config";

const TEST_DB = process.env.TEST_DATABASE_URL ?? "postgresql://srp:srp@localhost:5432/srp_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DB,
      APP_URL: "http://localhost:3000",
      FIELD_ENCRYPTION_KEY: "dGVzdC1vbmx5LWtleS0zMi1ieXRlcy1sb25nLTAwMDA=",
      HASH_SECRET: "test-only-hash-secret-0123456789abcdef",
      CRON_SECRET: "test-only-cron-secret-0123456789",
      PLATFORM_OWNER_EMAILS: "owner@synergy.test",
      AI_PROVIDER: "MOCK",
      DEV_LOGIN_ENABLED: "false",
    },
  },
});
