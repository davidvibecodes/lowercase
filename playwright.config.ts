import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * E2E runs against a production build served by its own process on port 3100
 * with a reseeded e2e.db (U16). Specs share that database, so they run serially.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "node node_modules/tsx/dist/cli.mjs scripts/e2e-server.ts",
    url: `http://127.0.0.1:${PORT}/login`,
    env: { NODE_ENV: "production", PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

export const E2E_PORT = PORT;
