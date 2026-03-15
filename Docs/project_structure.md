# Project Structure — FleetCommand
**pnpm monorepo · TypeScript 5 composite projects**

> This document mirrors the layout established by Replit (see `replit.md` and `pnpm-workspace.yaml`) and extends it with the FleetCommand-specific modules added during implementation. Do not introduce packages or folders that conflict with this layout.

---

## Root Directory

```
Single_ASV_dashboard/
│
├── artifacts/                        # Deployable applications
│   ├── api-server/                   # Express 5 API server  (port 8080)
│   └── mockup-sandbox/               # Vite + React UI       (port 8081)
│
├── lib/                              # Shared workspace libraries
│   ├── api-spec/                     # OpenAPI spec + Orval codegen config
│   ├── api-client-react/             # Generated: TanStack Query hooks
│   ├── api-zod/                      # Generated: Zod validation schemas
│   ├── db/                           # Drizzle ORM + PostgreSQL
│   └── types/                        # ★ NEW: canonical FleetCommand types
│
├── scripts/                          # Utility scripts (codegen, data prep)
│
├── Docs/                             # Project documentation
│   ├── Implementation.md             # Stage-by-stage implementation plan
│   ├── project_structure.md          # This file
│   ├── UI_UX_doc.md                  # Design system & UX flows
│   ├── arch.md                       # Four-layer architecture reference
│   ├── Potential_info.md             # Data source preparedness notes
│   ├── understanding_replit_broad.md # Workspace overview
│   └── understanding_replit_deep.md  # Workspace deep dive
│
├── PRD.md                            # Product Requirements Document
├── replit.md                         # Replit workspace documentation
├── pnpm-workspace.yaml               # pnpm workspace definition
├── tsconfig.json                     # Root TypeScript project references
├── tsconfig.base.json                # Shared TS compiler options
└── package.json                      # Root package (scripts only)
```

---

## Package Details

### `artifacts/api-server`

Express 5 backend. Handles future explanation synthesis endpoints and data relay.

```
artifacts/api-server/
├── src/
│   ├── index.ts                      # Entry point; mounts router
│   ├── router.ts                     # Route definitions
│   ├── routes/
│   │   ├── healthz.ts                # GET /api/healthz
│   │   └── explain.ts                # ★ POST /api/explain  (Stage 3)
│   └── services/
│       └── explanationService.ts     # ★ Server-side synthesizer (Stage 3)
├── package.json
└── tsconfig.json
```

**Run:** `pnpm --filter @workspace/api-server run dev`

---

### `artifacts/mockup-sandbox`

The Presentation Layer. All new FleetCommand UI work lives here.

```
artifacts/mockup-sandbox/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── package.json
├── tsconfig.json
│
└── src/
    ├── main.tsx                      # Vite entry point
    ├── App.tsx                       # Root component; preview routing
    │
    ├── components/
    │   └── mockups/
    │       └── fleet-command/
    │           ├── FleetCommand.tsx  # ★ Main layout: three-panel shell
    │           ├── MissionMap.tsx    # ★ Map panel (Stage 2)
    │           ├── EventTimeline.tsx # ★ Timeline panel (Stage 2)
    │           └── FleetCommander.tsx# ★ Explanation panel (Stage 2)
    │
    ├── data/
    │   └── mockMissionState.ts       # ★ Realistic mock normalized data (Stage 1)
    │
    ├── adapters/                     # ★ Ingestion adapters (Stage 1 stubs / Stage 4)
    │   ├── index.ts                  # Adapter factory + interface contract
    │   ├── websocketAdapter.ts       # Live WebSocket → normalizeRawFeed
    │   ├── restAdapter.ts            # REST polling → normalizeRawFeed
    │   └── replayAdapter.ts          # Timestamped log → normalizeRawFeed
    │
    ├── ingestion/                    # ★ Replay player (Stage 4)
    │   └── replay.ts                 # ReplayPlayer class (play/pause/seek/step)
    │
    ├── explanation/                  # ★ Client-side synthesizer (Stage 3)
    │   ├── synthesize.ts             # synthesizeExplanation(state, event?)
    │   └── prioritize.ts             # prioritizeAlerts(alerts[])
    │
    └── lib/
        └── utils.ts                  # Shared UI utilities (cn, etc.)
```

**Run:** `pnpm --filter @workspace/mockup-sandbox run dev`

---

### `lib/types` ★ NEW

Canonical FleetCommand data model. The single source of truth for all types shared between the UI, API, and any future packages. **No package should redefine these types locally.**

```
lib/types/
├── package.json                      # name: "@workspace/types"
├── tsconfig.json                     # Composite project reference
└── src/
    ├── index.ts                      # Re-exports everything
    ├── canonical.ts                  # All canonical type definitions
    │                                 #   OwnshipState
    │                                 #   MissionObject
    │                                 #   Contact
    │                                 #   AlertEvent
    │                                 #   DecisionEpisode
    │                                 #   ExplanationCard
    │                                 #   VideoCameraMetadata
    │                                 #   CommsStatus
    │                                 #   VehicleTelemetry
    │                                 #   NormalizedMissionState (aggregate)
    └── normalize.ts                  # normalizeRawFeed(raw: unknown): NormalizedMissionState
```

---

### `lib/api-spec`

OpenAPI spec lives here. Orval reads it to generate `api-client-react` and `api-zod`.

```
lib/api-spec/
├── openapi.yaml                      # Single source-of-truth for API contract
├── orval.config.ts                   # Orval codegen config
├── package.json
└── tsconfig.json
```

---

### `lib/api-client-react` (generated)

TanStack Query hooks generated from `lib/api-spec`. Do not edit manually.

---

### `lib/api-zod` (generated)

Zod validation schemas generated from `lib/api-spec`. Do not edit manually.

---

### `lib/db`

Drizzle ORM schema and PostgreSQL connection. Used by `api-server` only.

```
lib/db/
├── src/
│   ├── index.ts
│   ├── schema.ts
│   └── client.ts
├── package.json
└── tsconfig.json
```

---

### `scripts`

Utility scripts: codegen runners, data preparation, scenario file generation.

```
scripts/
├── src/
│   └── generate-mock-scenario.ts     # ★ Outputs mockMissionState seed files
├── package.json
└── tsconfig.json
```

---

## Canonical Types Reference

All types defined in `lib/types/src/canonical.ts`. Reproduced here for quick reference.

```ts
// Ownship state — primary vessel
type OwnshipState = {
  id: string
  timestamp: string
  lat?: number
  lon?: number
  headingDeg?: number
  speedKts?: number
  autonomyMode?: string
  missionPhase?: string
  health?: "ok" | "warning" | "critical"
}

// Mission geometry — waypoints, routes, areas, patterns
type MissionObject = {
  id: string
  kind: "waypoint" | "route" | "area" | "searchPattern"
  geometry: any            // GeoJSON-compatible
  label?: string
  status?: string
}

// Tracked contact (AIS or sensor)
type Contact = {
  id: string
  timestamp: string
  lat?: number
  lon?: number
  courseDeg?: number
  speedKts?: number
  source?: string          // "ais" | "radar" | "eo"
  type?: string            // vessel class or category
  riskScore?: number       // 0–1
  cpaNm?: number           // Closest Point of Approach (nautical miles)
  tcpaMin?: number         // Time to CPA (minutes)
}

// Alert / autonomy event
type AlertEvent = {
  id: string
  timestamp: string
  severity: "info" | "warning" | "critical"
  category: "autonomy" | "collision" | "mission" | "sensor" | "comms"
  title: string
  detail?: string
  recommendedAction?: string
  sourceData?: Record<string, unknown>
}

// Autonomy decision episode (hardcoded in mockup; synthesized in Stage 3)
type DecisionEpisode = {
  id: string
  timestamp: string
  action: string
  reason: string
  evidence: string[]
  confidence?: number      // 0–1
  projectedNextStep?: string
}

// Synthesized explanation card (output of explanation layer)
type ExplanationCard = {
  id: string
  timestamp: string
  whatChanged: string
  why: string
  evidence: string[]
  expectedNext: string
  confidence?: number      // 0–1
  relatedObjects?: string[] // IDs of related contacts, waypoints, etc.
}

// Video / EO-IR camera feed
type VideoCameraMetadata = {
  streamId: string
  ts: string
  kind: string             // "eo" | "ir" | "360"
  url?: string
  camera?: { name?: string; fovDeg?: number }
}

// Communications link health
type CommsStatus = {
  vehicleId: string
  ts: string
  links: Array<{
    name: string
    state: "up" | "degraded" | "down"
    latencyMs?: number
    packetLoss?: number
  }>
}

// Vehicle system telemetry
type VehicleTelemetry = {
  vehicleId: string
  ts: string
  batteryPct?: number
  propulsionState?: string
  powerDrawKw?: number
  cpuLoadPct?: number
  sensorHealth?: Record<string, "ok" | "warning" | "critical">
  subsystemHealth?: Record<string, "ok" | "warning" | "critical">
}

// Aggregate normalized mission state — single output of normalizeRawFeed
type NormalizedMissionState = {
  ownship: OwnshipState
  missionObjects: MissionObject[]
  contacts: Contact[]
  alerts: AlertEvent[]
  decisionEpisodes: DecisionEpisode[]
  commsStatus?: CommsStatus
  telemetry?: VehicleTelemetry
  videoFeeds?: VideoCameraMetadata[]
  lastUpdated: string
  isStale?: boolean
}
```

---

## File Naming Conventions

| Pattern | Convention |
|---|---|
| React components | `PascalCase.tsx` |
| Utility modules | `camelCase.ts` |
| Type definition files | `camelCase.ts` (no `.d.ts` for shared types) |
| Config files | `kebab-case.ts` or `camelCase.config.ts` |
| Mock data files | `mock*.ts` prefix |
| Adapter files | `*Adapter.ts` suffix |

---

## TypeScript Project References

The root `tsconfig.json` maintains composite project references. When adding `lib/types`, update it as follows:

```json
{
  "references": [
    { "path": "./lib/types" },
    { "path": "./lib/api-spec" },
    { "path": "./lib/api-client-react" },
    { "path": "./lib/api-zod" },
    { "path": "./lib/db" },
    { "path": "./artifacts/api-server" },
    { "path": "./artifacts/mockup-sandbox" },
    { "path": "./scripts" }
  ]
}
```

Each package's `tsconfig.json` should set `"composite": true` and reference `../../tsconfig.base.json`.

---

## Architecture Flow Diagram

```
Raw Data Sources                   Ingestion Layer
  WebSocket ──────────────────────► websocketAdapter.ts
  REST polling ───────────────────► restAdapter.ts         ─── emits raw payloads ──►
  Replay log ─────────────────────► replayAdapter.ts

Adaptive Normalization Layer
  normalizeRawFeed(raw: unknown)
  └── lib/types/src/normalize.ts   ─── NormalizedMissionState ──►

Explanation Layer
  synthesizeExplanation(state, event?)
  └── src/explanation/synthesize.ts ─── ExplanationCard ──►

Presentation Layer
  FleetCommand.tsx
  ├── MissionMap.tsx        ← OwnshipState, Contact[], MissionObject[]
  ├── EventTimeline.tsx     ← AlertEvent[]
  └── FleetCommander.tsx    ← ExplanationCard, CommsStatus
```

---

## Environment Variables

```bash
# api-server
DATABASE_URL=postgres://...       # Drizzle ORM connection
PORT=8080

# mockup-sandbox (Vite env)
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
VITE_MAP_TILE_URL=https://...     # Optional: real tile provider
```

Place environment files at `artifacts/api-server/.env` and `artifacts/mockup-sandbox/.env.local`. Never commit secrets.
