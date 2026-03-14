// ============================================================================
// HEALTH CHECK ROUTE
// ============================================================================
// Provides a simple health check endpoint for monitoring and deployment verification.
// Full path: /api/healthz (mounted at /api in app.ts)
//
// RESPONSE FORMAT:
// Returns: { status: "ok" }
// Status code: 200
// Content-Type: application/json
//
// VALIDATION:
// Uses HealthCheckResponse from @workspace/api-zod (generated from OpenAPI spec)
// This ensures the response matches the API contract even for simple endpoints
//
// USAGE:
// - Deployment health checks
// - Load balancer probes
// - Quick connectivity verification
// - Debugging: "Is the server running and responding?"
// ============================================================================

import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

console.log("[health] Health check route module loaded");

const router: IRouter = Router();

// GET /healthz - Health check endpoint
router.get("/healthz", (_req, res) => {
  console.log("[health.GET /healthz] Health check requested");
  
  // Construct response payload
  const payload = { status: "ok" };
  console.log("[health.GET /healthz] Response payload:", payload);
  
  // Validate against Zod schema (from OpenAPI spec)
  // This parse() call will throw if payload doesn't match schema
  console.log("[health.GET /healthz] Validating response with Zod schema");
  const data = HealthCheckResponse.parse(payload);
  console.log("[health.GET /healthz] ✓ Validation passed");
  
  // Send JSON response
  console.log("[health.GET /healthz] Sending 200 OK response");
  res.json(data);
});

console.log("[health] Health check route registered: GET /healthz");
export default router;
