// ============================================================================
// API SERVER ENTRY POINT
// ============================================================================
// This is the main entry point for the Express API server.
// Flow: Validates PORT env var -> imports app -> starts HTTP listener
//
// ENVIRONMENT REQUIREMENTS:
// - PORT: Required, set by Replit (typically 8080 for api-server artifact)
//
// ARTIFACT CONTEXT:
// This server is the "api-server" artifact in .replit config.
// Routes are mounted at /api (see app.ts), so full paths are /api/*
// Example: /api/healthz returns health check status
//
// STARTUP FLOW:
// 1. Validate PORT env var (fail fast if missing/invalid)
// 2. Import app (triggers Express setup and middleware loading)
// 3. Start HTTP listener on the configured port
// 4. Log success message when ready
// ============================================================================

import app from "./app";

console.log("[index] API server starting");
console.log("[index] Process ID:", process.pid);
console.log("[index] Node version:", process.version);
console.log("[index] NODE_ENV:", process.env.NODE_ENV);
console.log("[index] Platform:", process.platform);

// ─── Port Validation ────────────────────────────────────────────────────────
// Replit injects PORT automatically. If missing, config is broken.
console.log("[index] Validating PORT environment variable");
const rawPort = process.env["PORT"];
console.log("[index] PORT (raw):", rawPort);

if (!rawPort) {
  console.error("[index] FATAL: PORT environment variable is missing");
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
console.log("[index] PORT (parsed):", port);

if (Number.isNaN(port) || port <= 0) {
  console.error("[index] FATAL: Invalid PORT value:", rawPort);
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

console.log("[index] ✓ PORT validation complete:", port);

// ─── Start HTTP Server ──────────────────────────────────────────────────────
console.log("[index] Starting Express HTTP listener on port", port);
app.listen(port, () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`✓ API Server ready and listening on port ${port}`);
  console.log(`  Routes mounted at: /api/*`);
  console.log(`  Health check: /api/healthz`);
  console.log(`  Process ID: ${process.pid}`);
  console.log("═══════════════════════════════════════════════════════════");
});
