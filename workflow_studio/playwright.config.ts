import { defineConfig } from "@playwright/test";

/** Node-free process.env access (no @types/node dependency). */
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

// Default target: one hermetic server on :9112 serving BOTH /api/wf/* and the
// built SPA at /studio (FastAPI static mount). Set WORKFLOW_STUDIO_E2E_BASE to
// point the specs at an already-running server instead (dev server :5173).
const baseURL = env.WORKFLOW_STUDIO_E2E_BASE ?? "http://127.0.0.1:9112/studio";

// Playwright's webServer readiness probe and API request contexts honor
// http_proxy env vars, which breaks localhost on machines with a local proxy.
// Bypass the proxy for the hermetic server (browsers already get
// --no-proxy-server via launchOptions below).
const processRef = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
if (processRef?.env) {
  const existing = processRef.env.NO_PROXY ?? processRef.env.no_proxy ?? "";
  const merged = existing
    ? `${existing},127.0.0.1,localhost`
    : "127.0.0.1,localhost";
  processRef.env.NO_PROXY = merged;
  processRef.env.no_proxy = merged;
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    // Use the system Chrome to avoid downloading browser binaries.
    channel: "chrome",
    baseURL,
    trace: "retain-on-failure",
    viewport: { width: 1680, height: 1000 },
    // Local proxy setups break localhost connections; bypass it entirely.
    launchOptions: { args: ["--no-proxy-server"] },
  },
  webServer: env.WORKFLOW_STUDIO_E2E_BASE
    ? undefined
    : {
        // Build the SPA first, then boot one server for API + SPA. uv run
        // --no-sync reuses the existing inference_server venv (never uv sync).
        // A unique WORKFLOW_STUDIO_DB per run keeps the suite hermetic.
        command:
          "pnpm build && cd ../inference_server && WORKFLOW_STUDIO_DB=/tmp/wf-e2e-$RANDOM.db PORT=9112 uv run --no-sync uvicorn inference_server.app:app --host 127.0.0.1 --port 9112",
        url: "http://127.0.0.1:9112/api/wf/list",
        reuseExistingServer: false,
        timeout: 180_000,
      },
  outputDir: "./test-results",
});
