import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: {
      APP_URL: "https://localhost:3100",
      DATABASE_URL: "file::memory:",
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "fake-vapid-public",
      VAPID_PRIVATE_KEY: "fake-vapid-private",
      VAPID_SUBJECT: "mailto:test@example.com",
      CRON_SECRET: "fake-cron-secret-for-tests-only-000000",
    },
  },
});
