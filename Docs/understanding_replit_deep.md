# Understanding Replit Workspace - Deep Technical Dive

## Introduction

This document provides a detailed technical analysis of the Replit workspace structure, runtime behavior, code generation pipelines, and how everything integrates with FleetCommand's four-layer architecture. Read `understanding_replit_broad.md` first for a high-level overview.

---

## Table of Contents

1. [Frontend Artifact Deep Dive](#frontend-artifact-deep-dive)
2. [Backend Artifact Deep Dive](#backend-artifact-deep-dive)
3. [Shared Libraries Deep Dive](#shared-libraries-deep-dive)
4. [TypeScript Build System](#typescript-build-system)
5. [OpenAPI Code Generation Pipeline](#openapi-code-generation-pipeline)
6. [FleetCommand Architecture Mapping](#fleetcommand-architecture-mapping)
7. [Maritime Data Integration Strategy](#maritime-data-integration-strategy)

---

## Frontend Artifact Deep Dive

### Package: `artifacts/mockup-sandbox`

**Purpose:** Replit design artifact providing component preview infrastructure and hosting the FleetCommand UI mockup.

### Runtime Flow: Request to Render

```
1. Browser requests: /__mockup/preview/fleet-command/FleetCommand
2. Replit routes request to port 8081 (per .replit-artifact/artifact.toml)
3. Vite dev server handles request
4. index.html loads -> src/main.tsx executes
5. main.tsx renders <App />
6. App.tsx:
   a. getPreviewPath() parses URL -> extracts "fleet-command/FleetCommand"
   b. Looks up "./components/mockups/fleet-command/FleetCommand.tsx" in registry
   c. Dynamically imports the module
   d. Resolves component export (default, Preview, or named)
   e. Renders <PreviewRenderer> with loaded component
7. FleetCommand component renders with inline mock data
```

**Key insight:** The preview system is completely dynamic. No manual registry updates needed when adding new mockup files.

### File-by-File Breakdown

#### `.replit-artifact/artifact.toml`
Replit configuration defining:
- **kind:** "design" (marks this as a UI artifact)
- **previewPath:** `/__mockup` (URL prefix for this artifact)
- **localPort:** 8081 (internal port)
- **Environment:** `PORT=8081`, `BASE_PATH=/__mockup`
- **Dev command:** `pnpm --filter @workspace/mockup-sandbox run dev`

**Why BASE_PATH matters:** Vite uses this to prefix all asset URLs. Without it, assets would 404 because Replit's router expects all paths under `/__mockup/`.

#### `vite.config.ts`
Vite configuration with Replit-specific requirements:
- **Hard-fails without PORT/BASE_PATH** - ensures correct routing
- **Plugins:**
  - `mockupPreviewPlugin()` - component discovery (see below)
  - `react()` - Fast refresh + JSX transform
  - `tailwindcss()` - Tailwind v4 integration
  - `runtimeErrorOverlay()` - Replit error UI
  - `cartographer()` - Replit component tracking (dev only, when REPL_ID exists)
- **Path alias:** `@` -> `src/` (cleaner imports)
- **Server config:** `host: 0.0.0.0` (external access), `allowedHosts: true` (Replit proxy)

**Why allowedHosts: true?** Replit's proxy adds custom Host headers. Without this, Vite would reject requests.

#### `mockupPreviewPlugin.ts`
Custom Vite plugin that auto-discovers mockup components.

**Discovery logic:**
1. Scans `src/components/mockups/**/*.tsx` using fast-glob
2. Excludes files/folders starting with `_` (private convention)
3. Generates `src/.generated/mockup-components.ts` with import registry
4. Watches for file add/remove events (chokidar)
5. Auto-rescans on 404s (handles race conditions)

**Generated output example:**
```typescript
export const modules = {
  "./components/mockups/fleet-command/FleetCommand.tsx": () => import("../components/mockups/fleet-command/FleetCommand.tsx"),
  // ... more entries
};
```

**File watching:**
- Uses chokidar with `awaitWriteFinish` (prevents partial-write triggers)
- `add` event: checks if file is valid preview target, then refreshes
- `unlink` event: always refreshes (component removed from registry)

**404 auto-rescan middleware:**
- Intercepts response completion
- If status=404 AND path contains `/components/mockups/` or `/.generated/`, triggers refresh
- Handles race where component exists but registry hasn't regenerated yet

**Refresh queue:**
- Prevents concurrent refreshes (could cause file write conflicts)
- If refresh is in-flight, queues another refresh to run after
- Ensures no file-add events are missed during slow discovery

#### `src/main.tsx`
Minimal React bootstrap:
1. Finds `#root` DOM element
2. Creates React root
3. Renders `<App />`

**Why so simple?** All routing logic is in App.tsx. This file just mounts React.

#### `src/App.tsx`
Preview router with dynamic component loading.

**Routing logic:**
```typescript
function getPreviewPath(): string | null {
  const basePath = getBasePath();           // Get BASE_URL (e.g. "/__mockup")
  const pathname = window.location.pathname; // e.g. "/__mockup/preview/foo/Bar"
  
  // Strip basePath to get local route
  const local = pathname.startsWith(basePath) 
    ? pathname.slice(basePath.length) 
    : pathname;                              // -> "/preview/foo/Bar"
  
  // Match /preview/<componentPath>
  const match = local.match(/^\/preview\/(.+)$/);
  return match ? match[1] : null;           // -> "foo/Bar"
}
```

**Component resolution priority:**
1. `mod.default` - standard default export
2. `mod.Preview` - explicit Preview export (convention)
3. `mod[name]` - named export matching file name
4. Last function in module - fallback heuristic

**Why multiple strategies?** Different developers export components differently. This ensures previews work regardless of export style.

**Error handling:**
- Component not in registry: shows "No component found" error
- Module load fails: shows import error with stack trace
- No valid component export: shows "No exported React component found" error

#### `src/components/mockups/fleet-command/FleetCommand.tsx`
The actual FleetCommand UI implementation.

**Component structure:**
```
FleetCommand (root)
├─ TopHeader (mission name, alert counts)
├─ Three-panel grid:
│  ├─ MissionMap (panel 1)
│  │  ├─ SVG map with layers
│  │  └─ Contact list below map
│  ├─ EventTimeline (panel 2)
│  └─ FleetCommanderPanel (panel 3)
└─ StatusBar (telemetry strip)
```

**State management:**
- `selectedEventId` - which event in timeline is selected
- `selectedContactId` - which contact on map is highlighted

**State synchronization:**
- Selecting event with `relatedContactId` highlights that contact on map
- Selecting contact directly clears event selection
- Episode resolution: `selectedEventId` -> `decisionsByEvent[id]` -> Fleet Commander panel

**Type definitions:**
Currently defined inline (lines 1-102). These represent the **normalized data contract** and should eventually move to a shared package when building the Adaptive Layer.

**Mock data:**
Inline constants (lines 104-380):
- `mockOwnship` - vessel state
- `mockContacts` - 3 contacts with varying risk
- `mockMission` - 8-waypoint search mission
- `mockEvents` - 7 timeline events
- `mockComms` - RF link status
- `decisionsByEvent` - pre-written explanations per event

**Map projection:**
Uses simple linear interpolation (NOT a proper map projection):
- Assumes small area where Earth curvature is negligible
- Maps lat/lon linearly to SVG x/y coordinates
- Good enough for ~10-20nm areas
- For larger areas or high precision, use Leaflet/Mapbox

**Visual design:**
- Dark theme (#0d1526 background)
- Cyan accent (#38bdf8) for ownship/autonomy elements
- Risk-based colors (red=critical, amber=elevated, green=nominal)
- Monospace fonts for operational aesthetic
- Subtle gridlines and range rings for spatial reference

---

## Backend Artifact Deep Dive

### Package: `artifacts/api-server`

**Purpose:** Express 5 API server for FleetCommand backend operations.

### Startup Flow

```
1. NODE starts: node src/index.ts (or tsx src/index.ts in dev)
2. index.ts imports app from "./app"
   → Triggers app.ts execution
   → Express middleware stack configured
   → Routes imported and mounted
3. index.ts validates PORT env var
4. app.listen(port) starts HTTP server
5. Server ready, logs "Server listening on port {port}"
```

**Critical detail:** `lib/db/src/index.ts` has import-time side effects. Any route that imports `@workspace/db` triggers database pool creation immediately.

### File-by-File Breakdown

#### `src/index.ts`
Server entry point:
1. Imports `app` (triggers Express setup)
2. Validates `PORT` env var (Replit sets this to 8080)
3. Calls `app.listen(port)`
4. Logs startup message

**Why hard-fail on PORT?** Replit injects PORT automatically. If missing, the artifact config is broken. Failing early prevents obscure runtime issues.

#### `src/app.ts`
Express middleware configuration:

**Middleware stack (order matters):**
1. **Request logging** - logs method, path, body size, headers, duration
2. **CORS** - allows cross-origin (necessary for frontend at different port)
3. **JSON parser** - parses `application/json` bodies
4. **URL-encoded parser** - parses `application/x-www-form-urlencoded` bodies
5. **Routes** - mounted at `/api` prefix

**Why /api prefix?** Keeps API routes namespaced separately from other artifacts. Full path becomes `/api/healthz`, `/api/telemetry`, etc.

**Request logging details:**
- Captures start time before middleware chain
- Listens for `res.on("finish")` to calculate duration
- Logs request: method, path, query, body size, content-type, user-agent
- Logs response: status, duration, content-type
- Formatted with box drawing characters for readability

#### `src/routes/health.ts`
Simple health check endpoint:
- **Route:** `GET /healthz` (full path: `/api/healthz`)
- **Response:** `{ status: "ok" }`
- **Validation:** Uses `HealthCheckResponse` Zod schema (from `@workspace/api-zod`)

**Why validate health check?** Ensures even simple endpoints match the OpenAPI contract. Catches schema drift early.

#### `build.ts`
Production bundler using esbuild.

**Bundling strategy:**
- **Allowlist approach:** Only bundle packages known to bundle cleanly
- **External everything else:** Expect in node_modules at runtime

**Why allowlist?**
- Some packages use dynamic require() - break when bundled
- Some packages have native addons - can't be bundled
- Some packages assume they're in node_modules - break when inlined
- Allowlist = "safe to bundle, and worth bundling for perf"

**Allowlist includes:**
- `express`, `cors` - web framework
- `drizzle-orm`, `pg`, `zod` - data layer
- Common libs: `axios`, `date-fns`, `uuid`, `nanoid`

**External automatically:**
- Any package not in allowlist
- Any `workspace:` package (e.g. `@workspace/db`)

**Output:**
- `dist/index.cjs` - Single bundled CommonJS file
- Minified for production
- `NODE_ENV` defined as "production" at build time

---

## Shared Libraries Deep Dive

### Package: `lib/db`

**Critical:** This package has **side effects on import**.

**Import-time flow:**
```typescript
// When ANY code does: import { db } from "@workspace/db"
1. lib/db/src/index.ts executes immediately
2. Checks process.env.DATABASE_URL (throws if missing)
3. Creates new pg.Pool(DATABASE_URL)
4. Creates drizzle(pool, { schema })
5. Exports pool and db singletons
```

**Why side effects?**
- Ensures only ONE connection pool per process (singleton pattern)
- Validates DATABASE_URL early (fail fast on startup, not first query)
- All imports get the same pool instance automatically

**Pool event logging:**
- `connect` - new connection established
- `error` - unexpected pool error (e.g. connection lost)
- `remove` - connection removed from pool

**Schema organization:**
- `src/schema/index.ts` - barrel export (currently empty scaffold)
- `src/schema/<modelname>.ts` - individual table definitions (none exist yet)
- `drizzle.config.ts` - Drizzle Kit config for migrations

**When you add maritime data models:**
1. Create `src/schema/ownship.ts` with Drizzle table definition
2. Export from `src/schema/index.ts`
3. Run `pnpm --filter @workspace/db run push` (syncs to PostgreSQL)
4. Import types: `import { ownshipTable } from "@workspace/db"`
5. Query: `await db.select().from(ownshipTable)`

### Package: `lib/api-spec`

**Purpose:** Single source of truth for API contracts using OpenAPI 3.1.

**Key files:**
- `openapi.yaml` - hand-written API specification
- `orval.config.ts` - code generation configuration

**Current spec:**
- Single endpoint: `GET /api/healthz`
- Returns: `{ status: "ok" }`
- Schema name: `HealthCheckResponse`

**Codegen targets:**
Orval generates TWO outputs from this ONE spec:
1. **api-client-react:** React Query hooks + TypeScript types
2. **api-zod:** Zod validation schemas + TypeScript types

**Why two targets?**
- Frontend needs: data fetching + caching (React Query)
- Backend needs: request/response validation (Zod)
- Same contracts, different usage patterns

### Package: `lib/api-client-react`

**Generated vs hand-written:**
- **Hand-written:**
  - `src/index.ts` - barrel export
  - `src/custom-fetch.ts` - shared fetch wrapper (ALL requests flow through this)
- **Generated (DO NOT EDIT):**
  - `src/generated/api.ts` - React Query hooks
  - `src/generated/api.schemas.ts` - TypeScript types

**custom-fetch.ts deep dive:**

This is the most important infrastructure file for future maritime data integration.

**What it does:**
- Wraps native `fetch()` with consistent error handling
- Auto-detects Content-Type and sets headers
- Parses responses based on Content-Type or explicit `responseType` option
- Throws typed errors (`ApiError` for HTTP errors, `ResponseParseError` for parse errors)
- Cross-runtime compatible (browser + React Native)

**Response parsing logic:**
```
If response.ok === false (4xx, 5xx):
  → parseErrorBody() - lenient, tries JSON but falls back to text
  → throw ApiError with parsed error data

If response.ok === true (2xx, 3xx):
  → parseSuccessBody() based on responseType:
    - "json": parseJsonBody() - strict, throws ResponseParseError on failure
    - "text": response.text()
    - "blob": response.blob()
    - "auto": infers from Content-Type header
  → return parsed result
```

**Key features:**
- **BOM stripping:** Some servers incorrectly include UTF-8 BOM in JSON
- **Empty body handling:** Returns `null` for empty responses (not an error)
- **Smart JSON detection:** If Content-Type missing, checks if body starts with `{` or `[`
- **Error message extraction:** Tries multiple formats (RFC 7807, generic message/error)

**Debugging:**
All requests/responses are logged here with extensive detail:
- Request: method, URL, headers, responseType
- Response: status, ok, Content-Type, parsed body type
- Errors: full error details with body preview

**Future maritime data:**
When FleetCommand consumes real APIs:
1. Define endpoints in `openapi.yaml` (e.g. `GET /api/telemetry/ownship`)
2. Run codegen (generates hooks like `useOwnshipTelemetry()`)
3. All requests automatically use `customFetch()`
4. All logging here applies automatically
5. Consistent error handling across all endpoints

### Package: `lib/api-zod`

**Generated vs hand-written:**
- **Hand-written:**
  - `src/index.ts` - barrel export
- **Generated (DO NOT EDIT):**
  - `src/generated/api.ts` - main schema exports
  - `src/generated/types/**` - individual schema files

**Usage in backend:**
```typescript
import { HealthCheckResponse } from "@workspace/api-zod";

router.get("/healthz", (req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});
```

**Why validate responses?**
- Catches breaking changes early (response doesn't match OpenAPI contract)
- Type-safe (TypeScript + runtime validation)
- Self-documenting (schema IS the documentation)

**Coercion:**
Orval config enables coercion for query params:
- `?limit=10` (string) -> coerced to `10` (number)
- `?active=true` (string) -> coerced to `true` (boolean)

This handles the reality that HTTP query/path params are always strings.

---

## TypeScript Build System

### Composite Projects Setup

The workspace uses **TypeScript project references** for type checking.

**Package types:**

1. **Library packages** (composite: true):
   - `lib/db`
   - `lib/api-client-react`
   - `lib/api-zod`
   - Each extends `tsconfig.base.json`
   - Each listed in root `tsconfig.json` references

2. **Artifact packages** (composite: false):
   - `artifacts/api-server`
   - `artifacts/mockup-sandbox`
   - Use standard `tsc --noEmit` for type checking
   - NOT listed in root project references

**Why the difference?**
- Libraries are imported by artifacts -> need declaration files (.d.ts)
- Artifacts are executables -> just need type checking, no .d.ts emission
- Project references ensure libs are built before artifacts import them

### Typecheck Flow

```bash
pnpm run typecheck
```

**What happens:**
1. Root script runs: `tsc --build --emitDeclarationOnly`
2. TypeScript reads `tsconfig.json` project references
3. Builds dependency graph: lib packages first
4. For each lib: generates .d.ts files in src/ (composite output)
5. Root script then runs recursive typecheck: `pnpm -r run typecheck`
6. Each artifact package runs `tsc --noEmit` (uses lib .d.ts files)

**Important:** Always typecheck from root. Running `tsc` inside a single package will fail if dependencies haven't been built yet.

### Build Flow

```bash
pnpm run build
```

**What happens:**
1. Runs `pnpm run typecheck` first (ensures no type errors)
2. Runs `pnpm -r run build` (recursive, runs build in each package that has it)
3. Library packages: mostly no-op (already emitted .d.ts during typecheck)
4. Artifact packages: run their build scripts
   - `api-server`: runs `build.ts` (esbuild bundle)
   - `mockup-sandbox`: runs `vite build` (production bundle)

---

## OpenAPI Code Generation Pipeline

### The Pipeline

```
openapi.yaml (hand-written)
      ↓
   orval.config.ts
      ↓
   ┌──────────────┴──────────────┐
   ↓                              ↓
api-client-react/src/generated   api-zod/src/generated
(React Query hooks)              (Zod schemas)
   ↓                              ↓
Used in frontend                 Used in backend
```

### Step-by-Step Flow

1. **Edit openapi.yaml**
   - Add/modify endpoint definitions
   - Define request/response schemas
   - Example: Add `GET /api/telemetry/ownship` returning `OwnshipState`

2. **Run codegen**
   ```bash
   pnpm --filter @workspace/api-spec run codegen
   ```
   - Orval reads `orval.config.ts`
   - Parses `openapi.yaml`
   - Applies `titleTransformer` (forces title="Api")
   - Generates to two targets simultaneously

3. **Generated output**
   
   **In lib/api-client-react/src/generated/:**
   - `api.ts` - exports hooks and types
     - `useOwnshipTelemetry()` - React Query hook
     - `getOwnshipTelemetry()` - plain fetch function
     - `OwnshipState` - TypeScript type
   - All hooks call `customFetch()` under the hood
   
   **In lib/api-zod/src/generated/:**
   - `api.ts` - exports schemas and types
     - `OwnshipStateSchema` - Zod schema
     - `OwnshipState` - TypeScript type (inferred from schema)
   - `types/` folder - individual schema files

4. **Usage**
   
   **Frontend:**
   ```typescript
   import { useOwnshipTelemetry } from "@workspace/api-client-react";
   
   function MyComponent() {
     const { data, isLoading, error } = useOwnshipTelemetry();
     // data is fully typed as OwnshipState
   }
   ```
   
   **Backend:**
   ```typescript
   import { OwnshipStateSchema } from "@workspace/api-zod";
   
   router.get("/telemetry/ownship", async (req, res) => {
     const raw = await fetchOwnshipData();
     const validated = OwnshipStateSchema.parse(raw); // Runtime validation
     res.json(validated);
   });
   ```

### Orval Configuration Details

**api-client-react target:**
- **client:** "react-query" - generates hooks (useX, getX)
- **mode:** "split" - multiple files instead of one huge file
- **baseUrl:** "/api" - prepends to all request URLs
- **mutator:** Points to `custom-fetch.ts` - all hooks use customFetch()
- **clean:** true - deletes old generated files before regenerating

**zod target:**
- **client:** "zod" - generates Zod schemas
- **mode:** "split" - multiple files
- **useDates:** true - converts ISO date strings to Date objects
- **coerce:** Enables type coercion for query/path params

---

## FleetCommand Architecture Mapping

### Four Layers from Docs/arch.md

#### Layer 1: Ingestion Layer
**Status:** Not yet implemented

**Planned responsibilities:**
- Connect to maritime data sources (WebSocket, REST, files)
- Support both live streaming and replay modes
- Emit unified event stream regardless of source
- Preserve timestamps and ordering

**Implementation plan:**
- Create `lib/ingestion` package
- WebSocket client for live telemetry
- File reader for replay logs
- Unified event emitter interface
- React context/hooks for consuming events

#### Layer 2: Adaptive Normalization Layer
**Status:** Types exist, adapters not yet implemented

**Current state:**
- **Types defined:** In `FleetCommand.tsx` (lines 5-102)
  - `OwnshipState`, `Contact`, `MissionObject`, `AlertEvent`, `DecisionEpisode`, `CommsStatus`
- **Adapters:** Not yet implemented

**Implementation plan:**
1. Extract types from FleetCommand.tsx to `lib/types` package
2. Create `lib/adaptive` package with adapter interfaces
3. Implement `normalizeRawFeed(raw: unknown) -> NormalizedMissionState`
4. Define canonical JSON schemas for validation
5. Build adapters for expected Saronic message formats (per `Docs/Potential_info.md`)

**Adapter interface pattern:**
```typescript
interface TelemetryAdapter {
  canHandle(raw: unknown): boolean;
  normalize(raw: unknown): OwnshipState;
}
```

**Why adapters?**
If Saronic changes their schema, only adapters update. UI stays the same.

#### Layer 3: Explanation Layer
**Status:** Mockup data exists, generation logic not implemented

**Current state:**
- **Output type defined:** `DecisionEpisode` in FleetCommand.tsx
- **Mock explanations:** Hardcoded in `decisionsByEvent` object
- **Format:** Situation/Reason/Confidence/Recommendation/ExpectedNext/Evidence

**Implementation plan:**
1. Create `lib/explanation` package or API endpoint
2. Input: normalized state + alerts + mission context
3. Logic: synthesize operator-ready explanations
4. Output: DecisionEpisode matching the existing format
5. Fleet Commander panel queries this API instead of using hardcoded data

**Synthesis logic (future):**
- Merge signals from ownship state, contacts, alerts, mission geometry
- Apply rule-based or LLM-based explanation generation
- Format according to SAT model (Situation Awareness Transparency)
- Include evidence from observable facts (CPA, TCPA, bearing rates, etc.)

#### Layer 4: Presentation Layer
**Status:** Fully implemented in mockup form

**Current implementation:**
- `artifacts/mockup-sandbox/src/components/mockups/fleet-command/FleetCommand.tsx`
- Three panels: MissionMap, EventTimeline, FleetCommanderPanel
- Consumes normalized types (already defined)
- Currently uses inline mock data

**Integration readiness:**
- Component props already match normalized types
- State management ready for real data streams
- Visual design complete
- Just needs data source swap (mock -> real)

### Current State Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    NOT YET IMPLEMENTED                      │
│                                                             │
│  Maritime Data Sources → Ingestion → Adaptive → Explanation│
│                                                             │
└───────────────────────────────┬─────────────────────────────┘
                                ↓
                         (mock data gap)
                                ↓
                    ┌───────────────────────┐
                    │   IMPLEMENTED NOW     │
                    │                       │
                    │  Presentation Layer   │
                    │  (FleetCommand.tsx)   │
                    │  - MissionMap         │
                    │  - EventTimeline      │
                    │  - FleetCommanderPanel│
                    └───────────────────────┘
```

**Key insight:** The UI is ready. It just needs the upstream layers built and connected.

---

## Maritime Data Integration Strategy

### Phase 1: Type Extraction (Immediate)

**Goal:** Share types between UI and future backend

**Actions:**
1. Create `lib/types` package
2. Move interfaces from `FleetCommand.tsx` to `lib/types/src/index.ts`:
   - `OwnshipState`, `Contact`, `MissionObject`, `AlertEvent`, `DecisionEpisode`, `CommsStatus`
3. Export from `@workspace/types`
4. Update `FleetCommand.tsx` to import from `@workspace/types`
5. Update `artifacts/mockup-sandbox/package.json` to depend on `@workspace/types`

**Result:** Types now shared, no UI changes yet.

### Phase 2: OpenAPI Definition (Before Data Arrives)

**Goal:** Define API contracts in anticipation of real data

**Actions:**
1. Edit `lib/api-spec/openapi.yaml`
2. Add endpoints for maritime data:
   ```yaml
   /api/telemetry/ownship:
     get:
       summary: Get current ownship state
       responses:
         200:
           content:
             application/json:
               schema:
                 $ref: '#/components/schemas/OwnshipState'
   
   /api/mission/current:
     get:
       summary: Get active mission
       responses:
         200:
           content:
             application/json:
               schema:
                 $ref: '#/components/schemas/MissionObject'
   
   /api/contacts:
     get:
       summary: Get nearby contacts
       responses:
         200:
           content:
             application/json:
               schema:
                 type: array
                 items:
                   $ref: '#/components/schemas/Contact'
   
   /api/events:
     get:
       summary: Get recent alert events
       responses:
         200:
           content:
             application/json:
               schema:
                 type: array
                 items:
                   $ref: '#/components/schemas/AlertEvent'
   ```

3. Define schemas in openapi.yaml components section (copy from extracted types)
4. Run: `pnpm --filter @workspace/api-spec run codegen`

**Result:** Generated hooks ready (`useOwnshipTelemetry()`, etc.), but backend doesn't implement them yet.

### Phase 3: Backend Stub Routes (Before Data Arrives)

**Goal:** Create working endpoints that return mock data via API

**Actions:**
1. Create route files in `artifacts/api-server/src/routes/`:
   - `telemetry.ts` - ownship telemetry routes
   - `mission.ts` - mission data routes
   - `contacts.ts` - contact tracking routes
   - `events.ts` - alert event routes

2. Implement routes using Zod schemas for validation:
   ```typescript
   import { OwnshipStateSchema } from "@workspace/api-zod";
   
   router.get("/telemetry/ownship", (req, res) => {
     // For now, return mock data
     const mockData = { id: "ownship-1", name: "UVS-241 SIREN", ... };
     const validated = OwnshipStateSchema.parse(mockData);
     res.json(validated);
   });
   ```

3. Mount new routes in `src/routes/index.ts`

**Result:** API endpoints exist, UI can call them, but data is still mock (just moved to backend).

### Phase 4: Connect UI to API (Before Real Data)

**Goal:** Replace FleetCommand's inline mock data with API calls

**Actions:**
1. Update `FleetCommand.tsx` to use React Query hooks:
   ```typescript
   import { useOwnshipTelemetry, useContacts, useMissionCurrent, useEvents } from "@workspace/api-client-react";
   
   export function FleetCommand() {
     const { data: ownship } = useOwnshipTelemetry();
     const { data: contacts } = useContacts();
     const { data: mission } = useMissionCurrent();
     const { data: events } = useEvents();
     
     // Rest of component unchanged (props stay the same)
   }
   ```

2. Add loading/error states
3. Remove inline mock constants

**Result:** UI now fetches from backend, but backend still returns mock data. Architecture is correct, just waiting for real sources.

### Phase 5: Ingestion Layer (When Real Data Arrives)

**Goal:** Connect to actual Saronic maritime data sources

**Options for data sources (per Docs/Potential_info.md):**
- WebSocket streams (preferred for live telemetry)
- REST polling (fallback)
- Replay files (for testing/demo)
- Scenario packs (pre-recorded missions)

**Actions:**
1. Create `lib/ingestion` package
2. Implement WebSocket client:
   ```typescript
   class MaritimeDataClient {
     connect(url: string): void;
     on(event: string, callback: (data: unknown) => void): void;
     disconnect(): void;
   }
   ```

3. Emit events to...

### Phase 6: Adaptive Layer (When Real Data Arrives)

**Goal:** Normalize raw Saronic data into canonical types

**Actions:**
1. Create `lib/adaptive` package
2. Implement adapters for each Saronic message type:
   ```typescript
   export function adaptOwnshipTelemetry(raw: unknown): OwnshipState {
     // Parse Saronic's ownship message format
     // Map fields to our canonical OwnshipState
     // Handle missing/optional fields
     // Tag staleness if needed
     return { ... };
   }
   ```

3. Implement `normalizeRawFeed()` dispatcher:
   ```typescript
   export function normalizeRawFeed(raw: unknown): NormalizedMissionState {
     // Detect message type
     // Route to appropriate adapter
     // Return normalized result
   }
   ```

4. Update API routes to:
   - Subscribe to ingestion layer events
   - Normalize via adaptive layer
   - Cache/store normalized results
   - Serve to frontend via existing endpoints

**Result:** Real data flows through correct architecture. UI unchanged (still calls same API endpoints, gets same types).

### Phase 7: Explanation Layer (When Real Data Exists)

**Goal:** Generate dynamic explanations from real state

**Actions:**
1. Create explanation synthesis logic (rule-based or LLM)
2. Add API endpoint: `POST /api/explain`
   - Input: current state snapshot
   - Output: DecisionEpisode
3. Update Fleet Commander panel to:
   - Call explanation API when state changes or event selected
   - Show loading state while generating
   - Display returned episode

**Result:** Fleet Commander shows real-time explanations, not pre-written ones.

---

## Where to Plug in Real Maritime Data

### Decision Tree

**If you have: WebSocket stream (live telemetry)**
1. Create `lib/ingestion/src/websocket-client.ts`
2. Connect to Saronic WebSocket endpoint
3. On message received: normalize via adaptive layer
4. Update cached state in backend
5. Frontend polls or uses WebSocket subscription for updates

**If you have: REST endpoints (polling)**
1. Create polling logic in backend (setInterval or similar)
2. Fetch from Saronic REST API
3. Normalize via adaptive layer
4. Cache results in memory or database
5. Frontend fetches from your backend API (which proxies Saronic)

**If you have: Replay files (JSON, CSV, MCAP)**
1. Create file parser in `lib/ingestion`
2. Load file, emit events in timestamp order
3. Support pause/resume/seek controls
4. Normalize via adaptive layer (same as live)
5. UI works identically (doesn't know if data is live or replay)

**If you have: Database dumps (historical data)**
1. Import to PostgreSQL using Drizzle
2. Create API endpoints to query historical data
3. Frontend uses same hooks (queries backend DB instead of live stream)

### Concrete Integration Points

**File: `artifacts/api-server/src/routes/telemetry.ts` (create this)**
```typescript
import { Router } from "express";
import { OwnshipStateSchema } from "@workspace/api-zod";
import { adaptOwnshipTelemetry } from "@workspace/adaptive"; // Future

const router = Router();

// Cached state (in-memory for now, could use Redis/DB)
let cachedOwnshipState: OwnshipState | null = null;

// When ingestion layer gets new data, it updates cache:
// onRawTelemetry((raw) => {
//   cachedOwnshipState = adaptOwnshipTelemetry(raw);
// });

router.get("/ownship", (req, res) => {
  if (!cachedOwnshipState) {
    return res.status(503).json({ error: "No telemetry data available" });
  }
  
  const validated = OwnshipStateSchema.parse(cachedOwnshipState);
  res.json(validated);
});

export default router;
```

**File: `artifacts/mockup-sandbox/src/components/mockups/fleet-command/FleetCommand.tsx`**
```typescript
// BEFORE (current):
export function FleetCommand() {
  // Uses hardcoded mockOwnship, mockContacts, etc.
}

// AFTER (real data):
export function FleetCommand() {
  const { data: ownship, isLoading: ownshipLoading } = useOwnshipTelemetry();
  const { data: contacts, isLoading: contactsLoading } = useContacts();
  const { data: mission, isLoading: missionLoading } = useMissionCurrent();
  const { data: events, isLoading: eventsLoading } = useEvents();
  
  if (ownshipLoading || contactsLoading || missionLoading || eventsLoading) {
    return <LoadingSpinner />;
  }
  
  // Rest of component unchanged - MissionMap, EventTimeline, etc. receive same props
}
```

**No other UI changes needed.** The component already consumes the correct types.

---

## Advanced Topics

### WebSocket Integration Pattern

**Backend (ingestion + adaptive):**
```typescript
// lib/ingestion/src/maritime-websocket.ts
import WebSocket from "ws";
import { adaptOwnshipTelemetry } from "@workspace/adaptive";

const ws = new WebSocket("wss://saronic.example.com/telemetry");

ws.on("message", (data) => {
  const raw = JSON.parse(data.toString());
  
  // Normalize via adaptive layer
  const normalized = normalizeRawFeed(raw);
  
  // Update backend state cache
  updateCache(normalized);
  
  // Optionally: broadcast to connected frontend clients via Server-Sent Events
  broadcastToClients(normalized);
});
```

**Frontend (real-time updates):**
```typescript
// Option A: Polling (simple)
const { data } = useOwnshipTelemetry({
  refetchInterval: 1000, // Poll every 1 second
});

// Option B: WebSocket subscription (efficient)
import { useWebSocket } from "lib/hooks/use-websocket";

const { data } = useWebSocket("/api/stream/telemetry", (msg) => {
  return OwnshipStateSchema.parse(msg);
});
```

### Replay Mode Pattern

**Backend:**
```typescript
// Load replay file
const replayLog = await loadReplayFile("mission-2024-03-14.json");

// Emit events in time order, respecting timestamps
for (const event of replayLog.events) {
  const normalized = normalizeRawFeed(event.data);
  await sleep(event.deltaMs); // Wait real time delta
  updateCache(normalized);
  broadcastToClients(normalized);
}
```

**Frontend:**
UI doesn't need to know it's replay. It just receives state updates via the same hooks/subscriptions.

### Database Persistence Pattern

**When to use database:**
- Historical mission logs (for replay)
- Alert history (for trends/analysis)
- Mission planning objects (routes, areas)
- Contact track history (for pattern analysis)

**When NOT to use database:**
- Real-time telemetry (too fast, use in-memory cache + optional persist-on-interval)
- Streaming sensor data (use time-series DB or S3)

**Schema example:**
```typescript
// lib/db/src/schema/missions.ts
import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const missionsTable = pgTable("missions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  geometry: jsonb("geometry"), // Store route/polygon as JSON
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## Debugging Guide

### Frontend Debugging

**Console logs added:**
- `[main.tsx]` - React bootstrap
- `[App]` - routing decisions and preview path parsing
- `[PreviewRenderer]` - component loading and resolution
- `[mockupPreviewPlugin]` - discovery, watching, refresh cycles
- `[FleetCommand]` - state changes, event/contact selection, episode resolution
- `[MissionMap]` - rendering, projection, selection
- `[EventTimeline]` - rendering, event counts
- `[FleetCommanderPanel]` - episode rendering

**How to debug:**
1. Open browser console
2. Refresh page
3. Watch logs flow in chronological order
4. Click events/contacts and see state transitions logged

**Common issues:**
- Component not loading: Check `[PreviewRenderer]` logs for registry lookup
- Map elements mispositioned: Check `[MissionMap]` projection logs
- Episode not updating: Check `[FleetCommand]` episode resolution logs

### Backend Debugging

**Console logs added:**
- `[index]` - server startup, PORT validation, PID
- `[app]` - middleware installation, route mounting
- `[REQUEST]`/`[RESPONSE]` - every HTTP request with duration
- `[health]` - health check route hits
- `[db]` - database connection, pool events
- `[custom-fetch]` - all API client requests (when frontend calls backend)

**How to debug:**
1. Run: `pnpm --filter @workspace/api-server run dev`
2. Watch terminal output
3. Make request from frontend or curl
4. See full request/response flow logged

**Common issues:**
- DATABASE_URL missing: Check `[db]` logs for validation error
- Routes not found: Check `[app]` route mounting logs
- Slow requests: Check `[RESPONSE]` duration logs

### TypeScript Debugging

**Issue: "Cannot find module '@workspace/xyz'"**
- **Cause:** Dependency package not built yet (missing .d.ts)
- **Check:** `ls lib/xyz/src/*.d.ts` (should exist)
- **Fix:** `pnpm run typecheck` from root

**Issue: Generated types out of sync**
- **Cause:** openapi.yaml changed but codegen not run
- **Fix:** `pnpm --filter @workspace/api-spec run codegen`

**Issue: Drizzle schema changes not applied**
- **Cause:** Schema edited but not pushed to database
- **Fix:** `pnpm --filter @workspace/db run push`

---

## Performance Considerations

### Development Performance

**Fast refresh:**
- Vite HMR updates in <100ms typically
- React Fast Refresh preserves component state across edits
- mockupPreviewPlugin regenerates on file changes only (not every HMR)

**TypeScript performance:**
- Project references skip up-to-date packages (faster than full rebuild)
- `emitDeclarationOnly` means tsc only generates .d.ts (fast)
- Actual bundling (JS emit) is done by esbuild/Vite (much faster than tsc)

**Database query performance:**
- Connection pool reuses connections (no reconnect overhead)
- Drizzle generates efficient SQL
- Use `.limit()`, `.offset()` for pagination

### Production Performance

**API server bundle:**
- Single file: `dist/index.cjs` (~500KB minified typically)
- Bundled dependencies: faster require() (fewer syscalls)
- External dependencies: still in node_modules (native modules, problematic packages)

**Frontend bundle:**
- Vite production build with code splitting
- Dynamic imports for route-based chunks
- Tailwind CSS tree-shaking (only used utilities included)

**Database:**
- Indexes: Add to frequently queried columns (mission_id, timestamp, etc.)
- Pagination: Always use LIMIT/OFFSET for large result sets
- Prepared statements: Drizzle uses them automatically (safe from SQL injection)

---

## Security Considerations

### Supply Chain Defense

**pnpm-workspace.yaml:**
```yaml
minimumReleaseAge: 1440  # 1 day = 1440 minutes
```

**What this does:**
- Prevents installing npm packages published less than 1 day ago
- Defense against supply-chain attacks (malicious packages usually pulled within hours)
- **DO NOT DISABLE** unless urgent security fix required

### API Security (Future)

When adding real maritime data APIs:
- **Authentication:** Use JWT or session-based auth (express-session already in allowlist)
- **Rate limiting:** Use express-rate-limit (already in allowlist)
- **Input validation:** Always use Zod schemas from @workspace/api-zod
- **SQL injection:** Drizzle ORM prevents this automatically (parameterized queries)
- **CORS:** Tighten cors() config for production (don't allow all origins)

### Environment Secrets

**Current env vars:**
- `DATABASE_URL` - contains credentials (already secret)
- `PORT`, `BASE_PATH` - not sensitive

**Future secrets:**
- Saronic API keys: Use Replit Secrets, access via `process.env.SARONIC_API_KEY`
- Never commit secrets to git
- Never log secrets (custom-fetch.ts already redacts in future)

---

## Migration Checklist: Mock Data to Real Data

Use this checklist when transitioning from inline mock data to real maritime sources:

- [ ] **1. Extract Types**
  - [ ] Create `lib/types` package
  - [ ] Move interfaces from FleetCommand.tsx to lib/types
  - [ ] Update FleetCommand.tsx imports
  - [ ] Verify TypeScript builds

- [ ] **2. Define OpenAPI Contracts**
  - [ ] Edit `lib/api-spec/openapi.yaml` with telemetry endpoints
  - [ ] Add schemas for OwnshipState, Contact, MissionObject, AlertEvent
  - [ ] Run codegen: `pnpm --filter @workspace/api-spec run codegen`
  - [ ] Verify generated hooks exist in api-client-react

- [ ] **3. Implement Stub Backend Routes**
  - [ ] Create route files in api-server/src/routes/
  - [ ] Return mock data via API (not inline)
  - [ ] Use Zod schemas for validation
  - [ ] Test with curl/Postman

- [ ] **4. Connect Frontend to Backend**
  - [ ] Replace inline mock data with React Query hooks
  - [ ] Add loading/error states
  - [ ] Verify UI works with API-served mock data
  - [ ] Architecture now correct (just waiting for real sources)

- [ ] **5. Build Ingestion Layer**
  - [ ] Create `lib/ingestion` package
  - [ ] Implement WebSocket/REST/file ingestion
  - [ ] Support live and replay modes
  - [ ] Emit unified event stream

- [ ] **6. Build Adaptive Layer**
  - [ ] Create `lib/adaptive` package
  - [ ] Implement adapters for Saronic message formats
  - [ ] Implement `normalizeRawFeed()`
  - [ ] Handle missing fields, staleness, variable rates

- [ ] **7. Connect Ingestion → Adaptive → Backend**
  - [ ] Backend subscribes to ingestion events
  - [ ] Normalize all incoming data
  - [ ] Update API route implementations to serve real normalized data
  - [ ] Remove mock data from backend

- [ ] **8. Build Explanation Layer**
  - [ ] Create explanation synthesis logic
  - [ ] Add `/api/explain` endpoint
  - [ ] Generate DecisionEpisodes dynamically
  - [ ] Update Fleet Commander to query explanation API

- [ ] **9. Final Integration**
  - [ ] Test with real maritime data sources
  - [ ] Verify UI responds correctly to state changes
  - [ ] Test replay mode
  - [ ] Performance optimization
  - [ ] Add error handling for data gaps/staleness

---

## Comparison: Replit Docs vs Reality

### Documented vs Actual

| Documented (replit.md) | Actual Reality | Note |
|---|---|---|
| Health check at `/api/health` | Actually `/api/healthz` | Minor route name difference |
| All packages are composite | Only lib packages are composite | Artifacts use standard tsc |
| Root tsconfig references all packages | Only references lib packages | Artifacts excluded from project references |

These are minor discrepancies. The core architecture described in replit.md is accurate.

---

## Summary

### What You Have Now
- ✅ Complete UI mockup (FleetCommand Presentation Layer)
- ✅ API server scaffold with health check
- ✅ Database connection infrastructure
- ✅ OpenAPI-driven code generation system
- ✅ React Query client generation
- ✅ Zod schema generation
- ✅ TypeScript build system with project references
- ✅ Component preview system for rapid UI iteration

### What You Need to Build
- 🚧 Ingestion Layer (WebSocket/REST/file readers)
- 🚧 Adaptive Layer (normalizers and adapters)
- 🚧 Explanation Layer (dynamic DecisionEpisode generation)
- 🚧 Connect UI to backend APIs (replace inline mock data)

### The Bridge
The current mockup IS the destination UI. It defines the data contract (types) and visual design. The missing pieces are the backend layers that feed it real data.

**When maritime data arrives:**
1. Build ingestion + adaptive layers (normalize raw feeds)
2. Implement backend API routes (serve normalized data)
3. Swap FleetCommand from inline mock to React Query hooks
4. UI should work immediately (contract already correct)

The Replit workspace is structured to make this transition smooth. The hard part (UI design, type contracts, API scaffolding) is done. The remaining work is connecting data sources through the proper architectural layers.
