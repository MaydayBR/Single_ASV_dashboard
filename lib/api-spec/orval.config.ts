// ============================================================================
// ORVAL CODEGEN CONFIGURATION
// ============================================================================
// This config drives OpenAPI-to-TypeScript code generation for the workspace.
//
// WHAT IS ORVAL?
// Orval reads an OpenAPI spec (openapi.yaml) and generates:
// 1. React Query hooks (for frontend) - output to lib/api-client-react
// 2. Zod schemas (for backend validation) - output to lib/api-zod
//
// WHY TWO OUTPUTS?
// - Frontend needs React Query hooks for data fetching + caching
// - Backend needs Zod schemas for request/response validation
// Both are generated from the same OpenAPI source of truth
//
// SINGLE SOURCE OF TRUTH:
// lib/api-spec/openapi.yaml defines all API contracts.
// When you add/modify endpoints:
// 1. Edit openapi.yaml
// 2. Run: pnpm --filter @workspace/api-spec run codegen
// 3. Two packages regenerate: api-client-react and api-zod
// 4. Use generated hooks in frontend, schemas in backend
//
// TITLE TRANSFORMER:
// Forces API title to "Api" so generated files are consistently named api.ts
// This allows workspace code to import from predictable paths.
// ============================================================================

import { defineConfig, InputTransformerFn } from "orval";
import path from "path";

console.log("[orval.config] Orval configuration loading");

// Resolve output directories for generated code
const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

console.log("[orval.config] Workspace root:", root);
console.log("[orval.config] React client output:", apiClientReactSrc);
console.log("[orval.config] Zod schemas output:", apiZodSrc);

// ─── Title Transformer ──────────────────────────────────────────────────────
// Forces API title to "Api" for consistent output filenames
// Without this, generated files would be named based on openapi.yaml's info.title,
// which could change and break imports
const titleTransformer: InputTransformerFn = (config) => {
  console.log("[orval.config.titleTransformer] Forcing API title to 'Api'");
  config.info ??= {};
  config.info.title = "Api";
  return config;
};

// ─── Orval Configuration ────────────────────────────────────────────────────
console.log("[orval.config] Building Orval configuration with 2 targets");

export default defineConfig({
  // ═══════════════════════════════════════════════════════════════════════════
  // TARGET 1: React Query Client (Frontend)
  // ═══════════════════════════════════════════════════════════════════════════
  // Generates React Query hooks for data fetching in the frontend
  // Output: lib/api-client-react/src/generated/**
  //
  // Generated files:
  // - api.ts: Main export with hooks (useHealthCheck, etc.)
  // - api.schemas.ts: Type definitions
  //
  // Usage in frontend:
  // import { useHealthCheck } from "@workspace/api-client-react"
  "api-client-react": {
    input: {
      target: "./openapi.yaml",              // OpenAPI spec source
      override: {
        transformer: titleTransformer,       // Force title="Api"
      },
    },
    output: {
      workspace: apiClientReactSrc,          // lib/api-client-react/src
      target: "generated",                   // Output to src/generated/
      client: "react-query",                 // Generate React Query hooks
      mode: "split",                         // Split into multiple files
      baseUrl: "/api",                       // Prefix all request URLs with /api
      clean: true,                           // Clean generated/ before regenerating
      prettier: true,                        // Format generated code
      override: {
        fetch: {
          includeHttpResponseReturnType: false, // Don't expose raw Response types
        },
        mutator: {
          // Use our custom fetch wrapper instead of global fetch
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",               // All hooks call customFetch()
        },
      },
    },
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TARGET 2: Zod Schemas (Backend Validation)
  // ═══════════════════════════════════════════════════════════════════════════
  // Generates Zod validation schemas for request/response validation in backend
  // Output: lib/api-zod/src/generated/**
  //
  // Generated files:
  // - api.ts: Main export with schemas (HealthCheckResponse, etc.)
  // - types/index.ts: Type definitions
  //
  // Usage in backend:
  // import { HealthCheckResponse } from "@workspace/api-zod"
  // const validated = HealthCheckResponse.parse(data)
  zod: {
    input: {
      target: "./openapi.yaml",              // Same spec as client
      override: {
        transformer: titleTransformer,       // Force title="Api"
      },
    },
    output: {
      workspace: apiZodSrc,                  // lib/api-zod/src
      client: "zod",                         // Generate Zod schemas
      target: "generated",                   // Output to src/generated/
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",                         // Split into multiple files
      clean: true,                           // Clean generated/ before regenerating
      prettier: true,                        // Format generated code
      override: {
        zod: {
          // Coercion: Convert query/param strings to correct types
          // Example: "?limit=10" (string) -> 10 (number)
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
          },
        },
        useDates: true,  // Convert ISO date strings to Date objects
      },
    },
  },
});

console.log("[orval.config] Configuration complete");
