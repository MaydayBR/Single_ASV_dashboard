// ============================================================================
// EXPRESS APP CONFIGURATION
// ============================================================================
// Sets up Express middleware and routes.
// This module is imported by index.ts and should NOT start the server itself.
//
// MIDDLEWARE STACK (order matters):
// 1. CORS - allows cross-origin requests (necessary for frontend/backend separation)
// 2. JSON parser - parses application/json request bodies
// 3. URL-encoded parser - parses application/x-www-form-urlencoded bodies
// 4. Routes - all API routes mounted at /api prefix
//
// ROUTE MOUNTING:
// All routes in ./routes are mounted at /api, so:
// - ./routes/health.ts defines /healthz -> serves at /api/healthz
// - Future routes follow the same pattern
//
// REQUEST LOGGING:
// A logging middleware is added below to track all requests for debugging.
// ============================================================================

import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "./routes";

console.log("[app] Creating Express application");

const app: Express = express();

// ─── Request Logging Middleware ─────────────────────────────────────────────
// Logs all incoming requests with method, path, status, and duration
// Installed FIRST so it captures all requests before other middleware
console.log("[app] Installing request logging middleware");
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const { method, path, body, query } = req;
  
  console.log("┌─────────────────────────────────────────────────────────");
  console.log("│ [REQUEST] Incoming request");
  console.log("│   Method:", method);
  console.log("│   Path:", path);
  console.log("│   Query:", Object.keys(query).length > 0 ? query : "(none)");
  console.log("│   Body size:", JSON.stringify(body).length, "bytes");
  console.log("│   Content-Type:", req.get("content-type") ?? "(none)");
  console.log("│   User-Agent:", req.get("user-agent") ?? "(none)");
  
  // Capture response completion
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    console.log("│ [RESPONSE] Request completed");
    console.log("│   Status:", res.statusCode);
    console.log("│   Duration:", duration, "ms");
    console.log("│   Content-Type:", res.get("content-type") ?? "(none)");
    console.log("└─────────────────────────────────────────────────────────");
  });
  
  next();
});

// ─── CORS Middleware ────────────────────────────────────────────────────────
// Allows cross-origin requests from any origin (necessary for Replit multi-artifact setup)
console.log("[app] Installing CORS middleware");
app.use(cors());

// ─── Body Parsers ───────────────────────────────────────────────────────────
// Parse JSON and URL-encoded request bodies
console.log("[app] Installing body parsers (JSON, URL-encoded)");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Route Mounting ─────────────────────────────────────────────────────────
// All routes mounted at /api prefix
// Example: ./routes/health.ts defines /healthz -> accessible at /api/healthz
console.log("[app] Mounting API routes at /api");
app.use("/api", router);

console.log("[app] Express app configuration complete");
export default app;
