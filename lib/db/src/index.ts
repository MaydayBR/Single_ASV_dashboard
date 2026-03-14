// ============================================================================
// DATABASE CONNECTION - PostgreSQL + Drizzle ORM
// ============================================================================
// This module initializes the database connection pool and Drizzle ORM client.
//
// IMPORTANT: This module has SIDE EFFECTS on import.
// When any file imports from "@workspace/db", this code runs immediately:
// 1. Validates DATABASE_URL env var
// 2. Creates PostgreSQL connection pool
// 3. Initializes Drizzle ORM client
//
// WHY SIDE EFFECTS:
// The DB connection is a shared singleton. By initializing on import, we ensure:
// - Only one pool is created per process
// - All code that imports this module gets the same pool instance
// - Connection validation happens early (fail fast if DATABASE_URL missing)
//
// ENVIRONMENT:
// - DATABASE_URL: Required, set by Replit when database is provisioned
//   Format: postgresql://user:password@host:port/database
//
// EXPORTS:
// - pool: pg.Pool instance (for raw queries if needed)
// - db: Drizzle ORM client (main query interface)
// - schema: All table definitions (re-exported from ./schema)
//
// FUTURE MARITIME DATA:
// When adding real maritime data models:
// 1. Define tables in src/schema/<modelname>.ts
// 2. Export from src/schema/index.ts
// 3. Run: pnpm --filter @workspace/db run push (to sync to database)
// 4. Import types here and use in API routes via db.select/insert/update
// ============================================================================

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

console.log("[db] Initializing database connection (side effect on import)");
console.log("[db] Node environment:", process.env.NODE_ENV);

// ─── Database URL Validation ────────────────────────────────────────────────
// DATABASE_URL is injected by Replit when a PostgreSQL database is provisioned
console.log("[db] Checking DATABASE_URL environment variable");
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("[db] FATAL: DATABASE_URL is not set");
  console.error("[db] Did you provision a database in Replit?");
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Redact password from logs (show only protocol, host, database name)
const redactedUrl = dbUrl.replace(/:[^:@]+@/, ":***@");
console.log("[db] ✓ DATABASE_URL present:", redactedUrl);

// ─── Connection Pool Creation ───────────────────────────────────────────────
// Create PostgreSQL connection pool
// Pool manages a set of reusable connections for better performance
console.log("[db] Creating PostgreSQL connection pool");
export const pool = new Pool({ connectionString: dbUrl });

// Log pool events for debugging connection issues
pool.on("connect", () => {
  console.log("[db.pool] ✓ New connection established to database");
});

pool.on("error", (err) => {
  console.error("[db.pool] ✗ Unexpected pool error:", err);
});

pool.on("remove", () => {
  console.log("[db.pool] Connection removed from pool");
});

console.log("[db] ✓ Connection pool created");

// ─── Drizzle ORM Initialization ─────────────────────────────────────────────
// Create Drizzle client with schema for type-safe queries
console.log("[db] Initializing Drizzle ORM client");
export const db = drizzle(pool, { schema });
console.log("[db] ✓ Drizzle client initialized");

// Re-export all schema definitions for convenience
// Usage: import { db, ExampleTable } from "@workspace/db"
export * from "./schema";

console.log("[db] Database module initialized successfully");
