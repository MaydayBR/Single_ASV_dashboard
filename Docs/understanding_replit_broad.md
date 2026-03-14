# Understanding Replit Workspace - Broad Overview

## What Replit Created

Replit scaffolded a **pnpm monorepo** workspace for FleetCommand with:
- 2 deployable artifacts (UI mockup + API server)
- 4 shared library packages (API spec, DB, generated client, generated schemas)
- 1 scripts package for utilities
- Complete TypeScript build system with project references
- OpenAPI-driven code generation pipeline

The workspace is optimized for:
- Fast iteration (hot reload, file watching, component preview)
- Type safety across frontend/backend boundaries
- Single source of truth for API contracts (OpenAPI spec)
- Hackathon-friendly development (modular, clear separation of concerns)

---

## Package Layout

```
Single_ASV_dashboard/
├── artifacts/                    # Deployable applications
│   ├── api-server/               # Express 5 API server (port 8080, /api/*)
│   └── mockup-sandbox/           # Vite+React UI preview (port 8081, /__mockup/*)
│
├── lib/                          # Shared libraries
│   ├── api-spec/                 # OpenAPI spec + Orval codegen config
│   ├── api-client-react/         # Generated: React Query hooks
│   ├── api-zod/                  # Generated: Zod validation schemas
│   └── db/                       # Drizzle ORM + PostgreSQL connection
│
├── scripts/                      # Utility scripts
│
├── Docs/                         # Project documentation
├── .replit                       # Replit workspace config
├── replit.md                     # Workspace structure docs
├── pnpm-workspace.yaml           # pnpm workspace definition
└── tsconfig.json                 # Root TypeScript project references
```

---

## What Each Package Does

### **artifacts/api-server**
- **Purpose:** Express 5 backend API server
- **Routes:** Mounted at `/api` (currently only `/api/healthz` exists)
- **Dependencies:** Uses `@workspace/db` for database, `@workspace/api-zod` for validation
- **Runs on:** Port 8080
- **Access:** Routes available at `/api/*` when deployed

### **artifacts/mockup-sandbox**
- **Purpose:** Replit design artifact for UI component preview
- **Contains:** FleetCommand UI mockup (map + timeline + Fleet Commander)
- **Runs on:** Port 8081
- **Access:** Base at `/__mockup`, previews at `/__mockup/preview/<ComponentPath>`
- **Main mockup:** `src/components/mockups/fleet-command/FleetCommand.tsx`

### **lib/api-spec**
- **Purpose:** Single source of truth for API contracts
- **Key file:** `openapi.yaml` - hand-written OpenAPI 3.1 spec
- **Triggers:** Running codegen regenerates both api-client-react and api-zod

### **lib/api-client-react**
- **Purpose:** Generated React Query hooks for frontend
- **Generated from:** `lib/api-spec/openapi.yaml` via Orval
- **Hand-written:** `src/custom-fetch.ts` (shared fetch wrapper)
- **Generated:** `src/generated/**` (hooks, types)
- **Usage:** Import hooks like `useHealthCheck()` in React components

### **lib/api-zod**
- **Purpose:** Generated Zod schemas for backend validation
- **Generated from:** `lib/api-spec/openapi.yaml` via Orval
- **Hand-written:** `src/index.ts` (barrel export)
- **Generated:** `src/generated/**` (schemas, types)
- **Usage:** Import schemas like `HealthCheckResponse.parse(data)` in API routes

### **lib/db**
- **Purpose:** Database connection and ORM
- **Stack:** PostgreSQL + Drizzle ORM
- **Key file:** `src/index.ts` - creates connection pool on import (side effect)
- **Schema:** `src/schema/**` - table definitions (currently empty scaffold)
- **Usage:** Import `db` singleton for queries, import types for TypeScript

### **scripts**
- **Purpose:** Utility scripts for workspace maintenance
- **Run via:** `pnpm --filter @workspace/scripts run <scriptname>`
- **Currently:** Scaffold only (hello.ts demo script)

---

## Daily Commands

### Running the Application

```bash
# Run UI mockup/preview (FleetCommand interface)
pnpm --filter @workspace/mockup-sandbox run dev
# → Serves at http://localhost:8081/__mockup
# → FleetCommand preview: /__mockup/preview/fleet-command/FleetCommand

# Run API server (backend)
pnpm --filter @workspace/api-server run dev
# → Serves at http://localhost:8080
# → Health check: http://localhost:8080/api/healthz
```

### Building for Production

```bash
# Build everything (typecheck + all package builds)
pnpm run build

# Build specific package
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/mockup-sandbox run build
```

### Type Checking

```bash
# Typecheck entire workspace (uses TypeScript project references)
pnpm run typecheck

# This runs: tsc --build --emitDeclarationOnly
# Builds dependency graph: libs first, then artifacts
```

### OpenAPI Code Generation

```bash
# Regenerate React hooks and Zod schemas from openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# This updates:
# - lib/api-client-react/src/generated/**
# - lib/api-zod/src/generated/**
```

### Database Operations

```bash
# Push schema changes to database (dev/Replit)
pnpm --filter @workspace/db run push

# Generate migration (production)
pnpm --filter @workspace/db run generate

# Force push (when schema drift detected)
pnpm --filter @workspace/db run push-force
```

---

## How This Becomes FleetCommand

### Current State
Right now the workspace has:
- ✅ **Presentation Layer:** FleetCommand UI mockup exists in `artifacts/mockup-sandbox`
- ✅ **Infrastructure:** API server scaffold, DB connection, API contract system ready
- 🚧 **Data layers:** Ingestion, Adaptive, and Explanation layers not yet implemented
- 🚧 **Mock data:** FleetCommand uses inline mock data (not connected to backend)

### FleetCommand Architecture (from Docs/arch.md)

The PRD and architecture docs define **4 layers**:

1. **Ingestion Layer** (future)
   - Connects to maritime data sources (WebSocket, REST, replay files)
   - Handles live streaming and recorded replay modes
   - Emits unified event stream regardless of source

2. **Adaptive Normalization Layer** (future)
   - Implements `normalizeRawFeed(raw: unknown) -> NormalizedMissionState`
   - Converts raw Saronic schemas into stable canonical types
   - Insulates UI from upstream schema changes
   - **Will use:** Type definitions currently in FleetCommand.tsx (extract to lib/types)

3. **Explanation Layer** (future)
   - Synthesizes normalized signals into operator-ready explanations
   - Generates DecisionEpisodes (Situation/Reason/Confidence/Recommendation)
   - **Will use:** API endpoints for explanation generation
   - **Current mockup:** DecisionEpisodes are hardcoded in FleetCommand.tsx

4. **Presentation Layer** (exists now)
   - **Already implemented:** FleetCommand mockup in `artifacts/mockup-sandbox`
   - Three panels: Mission Map, Event Timeline, Fleet Commander
   - Consumes normalized types (OwnshipState, Contact, AlertEvent, etc.)
   - **Current limitation:** Uses inline mock data instead of real normalized feeds

### Integration Path (When Maritime Data Arrives)

1. **Define real data models**
   - Extract types from FleetCommand.tsx to `lib/types` (or similar)
   - Define OpenAPI endpoints in `lib/api-spec/openapi.yaml` for telemetry, mission data, alerts
   - Run codegen to generate hooks and schemas

2. **Build Adaptive Layer**
   - Create adapter functions for raw maritime feeds
   - Implement `normalizeRawFeed()` using extracted canonical types
   - Route all raw data through normalization before UI

3. **Build Explanation Layer**
   - Create API endpoints that generate DecisionEpisodes dynamically
   - Replace hardcoded `decisionsByEvent` with API calls
   - Use normalized data as input to explanation synthesis

4. **Connect Presentation Layer**
   - Replace FleetCommand's inline mock data with React Query hooks
   - Keep component props/structure the same (data contract already correct)
   - Add data streaming/update logic via hooks or WebSocket subscriptions

5. **Result**
   - UI stays the same visually
   - Data flows through proper architecture layers
   - Schema changes only require adapter updates, not UI changes

---

## Replit-Specific Features

### Artifact System
Replit uses "artifacts" to run multiple services in one workspace:
- Each artifact has its own `.replit-artifact/artifact.toml` config
- Defines port, URL path, and dev command
- Artifacts run independently but can communicate

**Current artifacts:**
- `api-server`: Backend API at `/api` (port 8080)
- `mockup-sandbox`: UI preview at `/__mockup` (port 8081)

### Component Preview
The mockup artifact includes a **dynamic component discovery system**:
- `mockupPreviewPlugin.ts` scans `src/components/mockups/**/*.tsx`
- Generates `src/.generated/mockup-components.ts` (import registry)
- `App.tsx` routes preview URLs to dynamically loaded components
- **URL pattern:** `/__mockup/preview/<ComponentPath>`

**Example:**
- File: `src/components/mockups/fleet-command/FleetCommand.tsx`
- URL: `/__mockup/preview/fleet-command/FleetCommand`

### Environment Variables
Replit injects environment variables automatically:
- `PORT` - which port to listen on
- `BASE_PATH` - URL prefix for the artifact (e.g. `/__mockup`)
- `DATABASE_URL` - PostgreSQL connection string (when DB provisioned)
- `REPL_ID` - unique Replit workspace identifier

These are configured in `.replit-artifact/artifact.toml` for each artifact.

### Post-Merge Hook
`.replit` defines a post-merge script (`scripts/post-merge.sh`) that runs after git merges:
1. Install dependencies: `pnpm install`
2. Push database schema: `pnpm --filter @workspace/db run push`

This keeps dependencies and database schema in sync with the codebase automatically.

---

## Key Files Reference

### Configuration
- **`.replit`** - Replit workspace config (artifacts, deployment, workflows)
- **`pnpm-workspace.yaml`** - Package membership + dependency catalog
- **`tsconfig.json`** - Root TypeScript project references
- **`tsconfig.base.json`** - Shared TypeScript compiler options

### Frontend Entry Points
- **`artifacts/mockup-sandbox/index.html`** - HTML entry
- **`artifacts/mockup-sandbox/src/main.tsx`** - React bootstrap
- **`artifacts/mockup-sandbox/src/App.tsx`** - Preview router
- **`artifacts/mockup-sandbox/mockupPreviewPlugin.ts`** - Component discovery

### Backend Entry Points
- **`artifacts/api-server/src/index.ts`** - HTTP server startup
- **`artifacts/api-server/src/app.ts`** - Express middleware setup
- **`artifacts/api-server/src/routes/health.ts`** - Health check route

### Shared Infrastructure
- **`lib/db/src/index.ts`** - Database connection (side effect on import)
- **`lib/api-client-react/src/custom-fetch.ts`** - Shared fetch wrapper
- **`lib/api-spec/openapi.yaml`** - API contract source of truth

---

## Quick Start (On Replit)

1. **Install dependencies:** `pnpm install` (runs automatically on clone)
2. **Provision database:** Use Replit's database provisioning (sets DATABASE_URL)
3. **Run dev servers:**
   - Click "Run" button in Replit (starts all artifacts)
   - Or manually: `pnpm --filter @workspace/mockup-sandbox run dev` (UI)
   - Or manually: `pnpm --filter @workspace/api-server run dev` (API)
4. **View FleetCommand:** Navigate to `/__mockup/preview/fleet-command/FleetCommand`

---

## Next Steps

### When You Get Real Maritime Data
1. Extract FleetCommand types to shared package
2. Define OpenAPI endpoints for telemetry, mission data, contacts, alerts
3. Run codegen to generate hooks and schemas
4. Build Adaptive Layer adapters to normalize raw feeds
5. Connect FleetCommand to use React Query hooks instead of inline mock data
6. The UI should work without changes (data contract already matches)

### Adding New API Endpoints
1. Edit `lib/api-spec/openapi.yaml`
2. Run: `pnpm --filter @workspace/api-spec run codegen`
3. Implement backend route in `artifacts/api-server/src/routes/`
4. Use generated Zod schema for validation
5. Use generated React hook in frontend

### Adding Database Models
1. Create table definition in `lib/db/src/schema/<modelname>.ts`
2. Export from `lib/db/src/schema/index.ts`
3. Run: `pnpm --filter @workspace/db run push` (dev)
4. Use `db.select/insert/update` in API routes

---

## Common Issues & Solutions

### "PORT environment variable is required"
- **Cause:** Running outside Replit without setting PORT manually
- **Solution:** `export PORT=8080` (or 8081 for mockup) before running dev

### "DATABASE_URL must be set"
- **Cause:** Database not provisioned in Replit
- **Solution:** Use Replit's database provisioning feature

### TypeScript errors when importing across packages
- **Cause:** Dependent packages not built yet (missing .d.ts files)
- **Solution:** Run `pnpm run typecheck` from workspace root (builds all packages)

### Component preview 404s
- **Cause:** Component not discovered by mockupPreviewPlugin
- **Solution:** 
  - Ensure file is in `src/components/mockups/**/*.tsx`
  - Check file/folder doesn't start with `_` (excluded by convention)
  - Restart dev server (triggers rescan)

### Changes to openapi.yaml not reflected in code
- **Cause:** Forgot to run codegen after editing spec
- **Solution:** `pnpm --filter @workspace/api-spec run codegen`

---

## Documentation References

- **`replit.md`** - Technical workspace structure and package details
- **`PRD.md`** - Product requirements and FleetCommand feature scope
- **`Docs/arch.md`** - Four-layer architecture (Ingestion→Adaptive→Explanation→Presentation)
- **`Docs/Potential_info.md`** - Expected maritime data sources and formats
- **`Docs/understanding_replit_deep.md`** - Detailed technical deep-dive (see companion doc)
