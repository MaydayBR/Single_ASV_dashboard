// ============================================================================
// VITE CONFIGURATION - Replit Design Artifact
// ============================================================================
// This Vite config is tailored for Replit's design artifact system.
// Key Replit requirements:
// 1. PORT env var (set by .replit-artifact/artifact.toml) - defines server port
// 2. BASE_PATH env var (set by artifact.toml) - URL prefix for this artifact
//    Example: BASE_PATH="/__mockup" means app serves at /__mockup/*
// 3. Cartographer plugin (Replit-only) - enables component tracking/discovery
// 4. Runtime error overlay - shows errors in a Replit-friendly modal
//
// Why hard-fail on missing env vars:
// Replit injects PORT and BASE_PATH automatically. If they're missing, it means
// the artifact config is broken or you're running outside Replit without setting
// them manually. Hard-failing prevents subtle path/routing bugs.
// ============================================================================

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

// ─── Environment Validation ─────────────────────────────────────────────────
// PORT: Required by Replit; determines which port this artifact listens on
console.log("[vite.config] Validating environment variables");
const rawPort = process.env.PORT;
console.log("[vite.config] PORT env var:", rawPort);

if (!rawPort) {
  console.error("[vite.config] FATAL: PORT environment variable missing");
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
console.log("[vite.config] Parsed PORT as number:", port);

if (Number.isNaN(port) || port <= 0) {
  console.error("[vite.config] FATAL: Invalid PORT value:", rawPort);
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// BASE_PATH: Required by Replit; defines URL prefix (e.g. "/__mockup")
// This allows multiple artifacts to coexist in the same Repl without conflicts
const basePath = process.env.BASE_PATH;
console.log("[vite.config] BASE_PATH env var:", basePath);

if (!basePath) {
  console.error("[vite.config] FATAL: BASE_PATH environment variable missing");
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

console.log("[vite.config] Environment validation complete:", { port, basePath });

// ─── Vite Configuration ─────────────────────────────────────────────────────
console.log("[vite.config] Building Vite configuration");
console.log("[vite.config] Node environment:", process.env.NODE_ENV);
console.log("[vite.config] REPL_ID present:", process.env.REPL_ID !== undefined);

export default defineConfig({
  // Base path determines the URL prefix for all assets
  // Example: basePath="/__mockup" means all routes are under /__mockup/*
  base: basePath,
  
  plugins: [
    // CUSTOM PLUGIN: mockupPreviewPlugin - discovers mockups and generates import registry
    // This is the magic that makes /__mockup/preview/<ComponentName> work
    mockupPreviewPlugin(),
    
    // CORE: React fast refresh and JSX transformation
    react(),
    
    // STYLING: Tailwind CSS v4 with Vite plugin
    tailwindcss(),
    
    // REPLIT: Runtime error overlay - shows friendly error modals in Replit
    runtimeErrorOverlay(),
    
    // REPLIT CONDITIONAL: Cartographer plugin only loads in dev mode on Replit
    // Cartographer enables component tracking/discovery in the Replit IDE
    // Condition: NODE_ENV !== "production" AND running on Replit (REPL_ID exists)
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) => {
            console.log("[vite.config] Loading Replit Cartographer plugin");
            return m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            });
          }),
        ]
      : []),
  ],
  
  // Path alias: "@" points to "src/" for cleaner imports
  // Example: import { foo } from "@/components/foo" instead of "../../components/foo"
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  
  // Root directory for this Vite project (artifacts/mockup-sandbox)
  root: path.resolve(import.meta.dirname),
  
  // Build output configuration
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true, // Clear dist/ before each build
  },
  
  // Development server configuration
  // host: "0.0.0.0" allows external connections (required for Replit)
  // allowedHosts: true permits all Host headers (required for Replit's proxy)
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,        // Prevent access outside allowed dirs
      deny: ["**/.*"],     // Block access to dotfiles
    },
  },
  
  // Preview server configuration (for "pnpm run preview" after build)
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

console.log("[vite.config] Vite configuration built successfully:", {
  base: basePath,
  port,
  pluginCount: "5 + conditional cartographer",
});
