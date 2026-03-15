# Implementation Plan — FleetCommand
**Saronic Hackathon · Track #1: UI — Visualizing Autonomous Decisions**

---

## Feature Analysis

### Identified Features

| # | Feature | Layer | Priority |
|---|---------|-------|----------|
| 1 | `normalizeRawFeed` + canonical types | Adaptive Normalization | Must-Have |
| 2 | Mission Map — ownship position, heading, health indicator | Presentation | Must-Have |
| 3 | Mission Map — planned route vs actual path overlay | Presentation | Must-Have |
| 4 | Mission Map — waypoints, mission polygon, search pattern | Presentation | Must-Have |
| 5 | Mission Map — nearby contacts with CPA/TCPA overlay | Presentation | Must-Have |
| 6 | Mission Map — hazard/boundary zones | Presentation | Must-Have |
| 7 | Event Timeline — filtered, severity-coded, chronological | Presentation | Must-Have |
| 8 | Event Timeline — click-through triggers Fleet Commander explanation | Presentation | Must-Have |
| 9 | Event Timeline — expandable detail cards | Presentation | Must-Have |
| 10 | Fleet Commander panel — Situation/Reason/Confidence/Recommendation | Presentation | Must-Have |
| 11 | Fleet Commander — Captain avatar UI | Presentation | Must-Have |
| 12 | Fleet Commander — event-aware dynamic updates | Presentation | Must-Have |
| 13 | Explanation synthesizer — merges contacts, ownship state, alerts into operator text | Explanation | Must-Have |
| 14 | Realistic mock maritime data (ownship, contacts, events, waypoints) | All | Must-Have |
| 15 | Comms status as first-class UI event (staleness, degraded banners) | Presentation | Should-Have |
| 16 | Missing-field tolerance in all adapters and components | Adaptive | Should-Have |
| 17 | Replay abstraction (pause/seek/step-through) | Ingestion | Should-Have |
| 18 | AIS context overlay on map | Presentation | Should-Have |
| 19 | COLREGS encounter type labels in explanations | Explanation | Should-Have |
| 20 | Real live map tile layer (NOAA ENCs or MapLibre/Leaflet) | Presentation | Nice-to-Have |
| 21 | Video/camera feed panel | Presentation | Nice-to-Have |
| 22 | Weather/environmental overlay | Presentation | Nice-to-Have |
| 23 | Replay controller UI | Presentation | Nice-to-Have |
| 24 | 3D AR/spatial view (Three.js + bathymetry) | Presentation | Nice-to-Have |
| 25 | Multi-vessel support via same normalization layer | All | Nice-to-Have |

---

### Feature Categorization

**Must-Have (MVP)**
- Main mission map: ownship, planned/actual path, waypoints, mission polygon, contacts with CPA/TCPA, hazard zones
- Event timeline/alert feed: filtered, severity-coded, interactive, click-through to explanation
- Fleet Commander panel: Situation → Reason → Confidence → Recommendation, Captain avatar
- `normalizeRawFeed(raw: unknown) → NormalizedMissionState` + canonical types
- Explanation synthesizer: converts normalized signals into operator-ready text
- Realistic mock maritime data for all panels

**Should-Have**
- Comms staleness / degraded-mode banner
- Missing-field tolerance and graceful degradation in all adapters
- Replay abstraction (same UI for live vs. playback)
- AIS-derived traffic context on map
- COLREGS encounter-type labels (crossing, overtaking, head-on, give-way/stand-on)

**Nice-to-Have**
- Real map tiles with NOAA ENC data
- Video / EO-IR sensor feed panel
- Weather / tide / current overlays
- Interactive replay controller

---

## Tech Stack

The existing workspace is already scaffolded. The stack is fixed; this section documents each piece and links its official docs.

| Technology | Role | Docs |
|---|---|---|
| **React 18** | UI components, hooks, context | [react.dev](https://react.dev/) |
| **TypeScript 5** | Type safety across all packages | [typescriptlang.org](https://www.typescriptlang.org/docs/) |
| **Vite** | Build tool + dev server for mockup-sandbox | [vitejs.dev](https://vitejs.dev/guide/) |
| **Tailwind CSS** | Utility-first styling | [tailwindcss.com/docs](https://tailwindcss.com/docs) |
| **pnpm workspaces** | Monorepo package management | [pnpm.io/workspaces](https://pnpm.io/workspaces) |
| **Express 5** | API server (api-server artifact) | [expressjs.com](https://expressjs.com/en/5x/api.html) |
| **Drizzle ORM** | Database layer (lib/db) | [orm.drizzle.team](https://orm.drizzle.team/docs/overview) |
| **Zod** | Runtime validation (lib/api-zod) | [zod.dev](https://zod.dev/) |
| **Orval** | OpenAPI codegen for React Query hooks | [orval.dev](https://orval.dev/) |
| **Leaflet / MapLibre GL** | Interactive map rendering | [leafletjs.com](https://leafletjs.com/reference.html) / [maplibre.org/maplibre-gl-js](https://maplibre.org/maplibre-gl-js/docs/) |
| **Lucide React** | Icon set | [lucide.dev](https://lucide.dev/guide/packages/lucide-react) |

**Run commands (as defined in workspace):**
```bash
# UI dev server (port 8081)
pnpm --filter @workspace/mockup-sandbox run dev

# API dev server (port 8080)
pnpm --filter @workspace/api-server run dev

# Type-check all packages from root
pnpm run typecheck
```

---

## Logging & Quick Debugging

A big part of vibe coding and hackathon speed is fixing bugs quickly. **Whenever code is generated or modified, include logging** so debugging is fast and easy:

- **Entry/exit** — Log when non-trivial functions or handlers run (e.g. `normalizeRawFeed` called, API route hit, adapter received message).
- **Key state** — Log important values (IDs, counts, selected item, error payloads). Avoid logging huge objects; log enough to reproduce.
- **Errors** — Always log caught errors with context (where, what input) before rethrowing or returning; use `console.error` or your logger.
- **Structured labels** — Use a consistent prefix or namespace (e.g. `[FleetCommand:Normalize]`, `[API:explain]`) so logs are easy to filter in the dev tools.

This makes it easy to trace flow and fix bugs without guessing.

---

## Implementation Stages

The four stages map to the four architecture phases in `Docs/arch.md`. Stage 1 is the foundation; later stages build on it sequentially.

---

### Stage 1 — Adaptive Normalization Layer (Foundation)
**Scope:** Extract inline types from `FleetCommand.tsx`, define the canonical data model in a shared location, and wire up the `normalizeRawFeed` function with mock data. The UI must never import raw types directly — only normalized ones.

**Estimated effort:** ~4–8 hours

**Deliverable:** A shared canonical type library consumed by the UI; mock data that looks like real normalized mission state; the normalization boundary that protects the UI from any upstream schema change.

#### Sub-steps
- [ ] **Extract canonical types to `lib/types`** — Move all type definitions currently inline in `FleetCommand.tsx` (`OwnshipState`, `MissionObject`, `Contact`, `AlertEvent`, `DecisionEpisode`, `VideoCameraMetadata`, `CommsStatus`, `VehicleTelemetry`, `ExplanationCard`) into a new shared package at `lib/types/src/index.ts`. Add `@workspace/types` to `pnpm-workspace.yaml` and wire TypeScript project references.

- [ ] **Implement `normalizeRawFeed` function** — Create `lib/types/src/normalize.ts`. The function signature must be `normalizeRawFeed(raw: unknown): NormalizedMissionState` where `NormalizedMissionState` aggregates all canonical types. Include guards for missing/partial fields, tolerate variable update rates, and mark stale data after a configurable TTL.

- [ ] **Build mock maritime data module** — Create `artifacts/mockup-sandbox/src/data/mockMissionState.ts` with a realistic coastal scenario: an ownship conducting a search pattern near a traffic separation scheme, 2–3 AIS contacts with varying CPA/TCPA, one alert in warning state, a set of waypoints, a mission polygon, and a comms-degraded event. Data must satisfy all canonical types without `any` casts.

- [ ] **Wire normalization into mockup-sandbox** — Replace all inline mock objects in `FleetCommand.tsx` with a single call to `normalizeRawFeed(mockRawFeed)`. Confirm the UI still renders without modification — this validates the schema firewall.

- [ ] **Add adapter stubs** — Create `artifacts/mockup-sandbox/src/adapters/` with stub adapters for WebSocket, REST, and replay-file sources. Each adapter should accept a raw payload and call `normalizeRawFeed`. Leave implementations as TODOs but define the interface contract now.

---

### Stage 2 — Presentation Layer (Core UI)
**Scope:** Refine all three panels (Mission Map, Event Timeline, Fleet Commander) to consume only normalized types and hardcoded explanation cards. No raw data anywhere in the JSX. Panels should feel complete and demo-ready.

**Dependencies:** Stage 1 complete (canonical types + mock data available)

**Estimated effort:** ~8–16 hours

**Deliverable:** A polished, fully functional UI that correctly answers all five operator questions using mock data. Every panel wired to normalized types.

#### Sub-steps
- [ ] **Mission Map — ownship + route rendering** — Integrate a map library (Leaflet or MapLibre GL). Render: ownship marker with heading indicator, planned route as a dashed polyline, actual track as a solid line, waypoints as labeled pins, mission polygon as a semi-transparent filled shape, search pattern if present. Marker style must reflect `OwnshipState.health` (ok / warning / critical).

- [ ] **Mission Map — contacts and hazards** — Render each `Contact` as an annotated marker showing heading arrow, speed, and risk score badge. Color-code by `riskScore` (green / amber / red). Draw CPA intercept line when `cpaNm < 0.5`. Render hazard/boundary zones as restricted-area overlays. Clicking a contact should surface its data in the Fleet Commander panel.

- [ ] **Event Timeline — event list with severity coding** — Build `EventTimeline` component. Render a scrollable feed of `AlertEvent` items newest-first, grouped by minute. Each row: severity color bar (info / warning / critical), operator-friendly title, relative time. Filter out low-value telemetry noise; expose only the event categories listed in the PRD (autonomy mode changes, route deviations, contact-risk spikes, mission-phase transitions, hazard proximity, comms degradation).

- [ ] **Event Timeline — click-through + Fleet Commander integration** — When an event is selected: highlight related map elements (contact, waypoint, or zone), scroll Fleet Commander to a targeted explanation for that event. Use a `selectedEvent` state shared via context or prop-drilling to coordinate panels.

- [ ] **Fleet Commander panel — explanation cards** — Build `FleetCommander` component. Render the current `ExplanationCard` in Situation → Reason → Confidence → Recommendation layout. Show Captain avatar (SVG or icon-based). Include confidence badge (Low / Medium / High) with appropriate color. Recommendation row must use urgency coloring (info / monitor / intervene / act).

- [ ] **Fleet Commander — event-aware dynamic updates** — Wire the `selectedEvent` state so that when the operator clicks a timeline event, the Fleet Commander explanation updates to focus on that event's context. Maintain a "current state" default explanation when no event is selected.

- [ ] **Comms status banner** — Add a persistent `CommsStatusBanner` at the top of the layout. Shows green/amber/red depending on `CommsStatus.links` state. When degraded or down: shows last-heard timestamp, stale-data warning, and a "COMMS DEGRADED" banner. This must be a first-class UI element, not an afterthought.

- [ ] **Full layout integration and responsive polish** — Integrate all three panels into the existing `FleetCommand.tsx` layout. Verify the three-panel (map / timeline / Fleet Commander) grid holds on common screen sizes (1280×800 minimum). Remove any remaining raw mock objects. Confirm `pnpm run typecheck` passes with zero errors.

---

### Stage 3 — Explanation Layer (Synthesizer)
**Scope:** Build the explanation synthesizer that converts normalized signals into operator-ready text at runtime — replacing hardcoded `DecisionEpisodes` with dynamically generated `ExplanationCard` objects. Optionally wire to the API server for LLM-augmented explanations.

**Dependencies:** Stage 2 complete (panels consume normalized types)

**Estimated effort:** ~6–12 hours

**Deliverable:** Fleet Commander explanations generated from live normalized state, not hardcoded strings. Explanations update automatically as ownship state, contacts, and alerts change.

#### Sub-steps
- [ ] **Implement rule-based explanation synthesizer** — Create `artifacts/mockup-sandbox/src/explanation/synthesize.ts`. Function signature: `synthesizeExplanation(state: NormalizedMissionState, selectedEvent?: AlertEvent): ExplanationCard`. Implement rules for: contact-risk escalation (CPA/TCPA threshold crossing), autonomy mode change, route deviation, comms degradation, mission-phase transition, hazard proximity. Each rule maps to a Situation/Reason/Evidence/ExpectedNext tuple. Reference COLREGS encounter types (crossing, overtaking, give-way, stand-on) in the evidence text.

- [ ] **Wire synthesizer into Fleet Commander panel** — Replace static `DecisionEpisode` hardcodes with a `useMemo` or `useEffect` hook that calls `synthesizeExplanation(missionState, selectedEvent)` whenever state or selection changes. Fleet Commander should re-render the explanation card reactively.

- [ ] **Prioritization logic** — Add a `prioritizeAlerts(alerts: AlertEvent[]): AlertEvent` function that returns the single most operationally important active alert. Fleet Commander default view should always lead with this highest-priority explanation. Include logic for: critical > warning > info; collision > comms > mission > autonomy > sensor.

- [ ] **API explanation endpoint (optional, if time allows)** — Add a `POST /api/explain` route to `artifacts/api-server`. Body: `NormalizedMissionState`. Response: `ExplanationCard`. Implement rule-based synthesis on the server side. Wire `lib/api-spec` OpenAPI definition, regenerate `lib/api-client-react` hooks, and swap the client-side synthesizer for the API call with a local fallback.

---

### Stage 4 — Polish, Ingestion Stubs & Optional Features
**Scope:** Tighten the UI, add comms/replay abstractions, and implement any nice-to-have features if time permits. This stage is explicitly hackathon-conditional.

**Dependencies:** Stage 3 complete (or at minimum Stage 2)

**Estimated effort:** ~4–8 hours (polish) + as much time as available for extras

**Deliverable:** Demo-ready UI with no rough edges, full type safety, and at least one or two of the nice-to-have features depending on available time.

#### Sub-steps
- [ ] **Replay abstraction** — Create `artifacts/mockup-sandbox/src/ingestion/replay.ts` with a `ReplayPlayer` class that accepts a timestamped event log, supports play/pause/seek/step, and emits normalized events at the correct rate. Wire to a simple replay controller UI component in the bottom bar.

- [ ] **Ingestion adapter layer (stubs → real)** — Complete the adapter stubs from Stage 1. Implement a `WebSocketAdapter` that accepts a WS URL and calls `normalizeRawFeed` on each message. Implement a `RestPollingAdapter` for periodic fetch. Both should emit into the same React state atom so the UI does not care about the source.

- [ ] **Real map tiles** — Swap the placeholder map layer for a real basemap (e.g. MapLibre GL with OpenFreeMap or NOAA RNC tile service). Add optional NOAA ENC overlay toggle. Add AIS context markers from a public AIS API if accessible.

- [ ] **Video/sensor feed panel** — Add an optional fourth panel or modal drawer. Render a `<video>` element or iframe placeholder wired to `VideoCameraMetadata.url`. Include camera name, mode (EO/IR), and FOV indicator.

- [ ] **UI/UX polish pass** — Audit all panels against `Docs/UI_UX_doc.md`: typography, spacing, color palette, animation, icon consistency. Add skeleton loaders for async data. Ensure Captain avatar and explanation cards have appropriate entry animations. Final accessibility pass: keyboard navigation, ARIA labels, contrast ratios.

- [ ] **End-to-end type safety audit** — Run `pnpm run typecheck` from root. Resolve any remaining type errors. Confirm no `any` usage outside the normalization boundary. Verify all canonical types are imported from `@workspace/types`, not re-declared locally.

---

## Resource Links

| Resource | URL |
|---|---|
| Saronic Hackathon context | Internal |
| NOAA ENC / chart tiles | https://charts.noaa.gov/ENCs/ENCs.shtml |
| NOAA Tides & Currents API | https://api.tidesandcurrents.noaa.gov/api/prod/ |
| OpenFreeMap tiles (MapLibre) | https://openfreemap.org/ |
| AIS public feed (AISHub) | https://www.aishub.net/api |
| MarineTraffic AIS API | https://www.marinetraffic.com/en/ais-api-services |
| COLREGS Rules of the Road | https://www.navcen.uscg.gov/international-regulations-for-preventing-collisions-at-sea |
| MapLibre GL JS docs | https://maplibre.org/maplibre-gl-js/docs/ |
| Leaflet docs | https://leafletjs.com/reference.html |
| React Query docs | https://tanstack.com/query/latest/docs |
| Zod docs | https://zod.dev/ |
| Drizzle ORM docs | https://orm.drizzle.team/docs/overview |
| pnpm workspaces docs | https://pnpm.io/workspaces |

---

## Stage Dependencies Summary

```
Stage 1 (Normalization)
    └── Stage 2 (Presentation) ←── demo-ready milestone
            └── Stage 3 (Explanation Synthesizer)
                    └── Stage 4 (Polish + Ingestion + Extras)
```

---

## Current State (Pre-Implementation)

- [x] Presentation Layer mockup exists in `artifacts/mockup-sandbox/src/components/mockups/fleet-command/FleetCommand.tsx`
- [x] Three-panel layout (map / timeline / Fleet Commander) rendered
- [x] Inline canonical types defined (not yet extracted to shared lib)
- [x] Hardcoded `DecisionEpisode` mock data in JSX
- [ ] No shared `@workspace/types` package yet
- [ ] No `normalizeRawFeed` function
- [ ] No explanation synthesizer
- [ ] No adapter layer
- [ ] No real map tile integration
