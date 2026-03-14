// ============================================================================
// API SERVER PRODUCTION BUILD SCRIPT
// ============================================================================
// Bundles the Express API server into a single CJS file for production deployment.
//
// WHY BUNDLE?
// 1. Faster cold starts (fewer file I/O operations)
// 2. Simpler deployment (one file vs thousands)
// 3. Dead code elimination (smaller bundle size)
// 4. Minification (smaller network transfer in serverless)
//
// BUNDLING STRATEGY:
// Uses a selective allowlist approach:
// - BUNDLED (allowlist): Common server deps that bundle reliably
// - EXTERNAL (not in allowlist): Native modules, problematic packages, workspace deps
//
// WHY ALLOWLIST (not bundle everything)?
// Some packages don't bundle well:
// - Native addons (e.g. bcrypt, sharp)
// - Packages with dynamic requires
// - Packages that expect to be in node_modules
//
// The allowlist includes known-good packages that reduce syscalls significantly
// without bundling compatibility issues.
//
// WORKSPACE DEPENDENCIES:
// Any workspace: package (e.g. @workspace/db) is automatically externalized
// and expected to be available at runtime in node_modules.
//
// OUTPUT:
// dist/index.cjs - Single bundled file, CommonJS format, minified
// ============================================================================

import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm, readFile } from "fs/promises";

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("[build] API server build script starting");
console.log("[build] Build directory:", __dirname);

// ─── Bundle Allowlist ───────────────────────────────────────────────────────
// Dependencies in this list will be bundled into dist/index.cjs
// All other dependencies (not in this list, and not workspace:) are externalized
//
// HOW TO UPDATE:
// - Add to allowlist: packages that bundle cleanly and are heavily used
// - Keep external: native modules, dynamic require() users, problematic packages
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",               // PostgreSQL client - bundles reliably
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",              // Validation library - critical for API
  "zod-validation-error",
];

console.log("[build] Bundle allowlist:", allowlist.length, "packages");
console.log("[build] Allowlisted packages:", allowlist);

// ─── Build Function ─────────────────────────────────────────────────────────
async function buildAll() {
  console.log("[build] Starting production build process");
  
  // Clean dist directory
  const distDir = path.resolve(__dirname, "dist");
  console.log("[build] Cleaning output directory:", distDir);
  await rm(distDir, { recursive: true, force: true });

  console.log("[build] Reading package.json to determine external dependencies");
  const pkgPath = path.resolve(__dirname, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  
  // Collect all dependencies (dependencies + devDependencies)
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  console.log("[build] Total dependencies found:", allDeps.length);
  
  // Compute external dependencies:
  // EXTERNAL = (all deps) - (allowlist) - (workspace: packages)
  //
  // Logic:
  // - If in allowlist: BUNDLE (not external)
  // - If starts with "workspace:": EXTERNAL (but will be in node_modules at runtime)
  // - Otherwise: EXTERNAL (expect in node_modules)
  const externals = allDeps.filter(
    (dep) =>
      !allowlist.includes(dep) &&                         // Not in bundle allowlist
      !(pkg.dependencies?.[dep]?.startsWith("workspace:")), // Not a workspace package
  );
  
  console.log("[build] Computed externals:", externals.length, "packages");
  console.log("[build] External packages:", externals);
  console.log("[build] Bundled packages (allowlist):", allowlist.length);

  // Build with esbuild
  console.log("[build] Running esbuild");
  console.log("[build] Entry point:", path.resolve(__dirname, "src/index.ts"));
  console.log("[build] Output file:", path.resolve(distDir, "index.cjs"));
  console.log("[build] Platform: node");
  console.log("[build] Format: CommonJS (cjs)");
  console.log("[build] Minify: true");
  
  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",      // Target Node.js runtime
    bundle: true,          // Bundle all imports (except externals)
    format: "cjs",         // CommonJS output format
    outfile: path.resolve(distDir, "index.cjs"),
    define: {
      "process.env.NODE_ENV": '"production"', // Set NODE_ENV at build time
    },
    minify: true,          // Minify for smaller bundle size
    external: externals,   // Don't bundle these (expect in node_modules)
    logLevel: "info",      // Show build progress
  });
  
  console.log("[build] ✓ Build completed successfully");
  console.log("[build] Output:", path.resolve(distDir, "index.cjs"));
}

// ─── Main Execution ─────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════════════");
console.log("  API Server Production Build");
console.log("═══════════════════════════════════════════════════════════");

buildAll().catch((err) => {
  console.error("[build] ✗ Build failed:");
  console.error(err);
  process.exit(1);
});
