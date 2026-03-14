## Recommended Workflow Architecture

Four layers:

1. Ingestion Layer
2. Adaptive Normalization Layer
3. Explanation Layer
4. Presentation Layer

---

## 1. Ingestion Layer

The ingestion layer should support **both streaming updates and recorded replays**. This is a core architectural requirement, not an implementation detail.

Your app may receive data through:
- WebSocket event streams
- REST polling
- JSON files
- replay logs
- CSV or MCAP-like exports
- sample telemetry bundles

The ingestion layer should abstract all of these into a common event pipeline so that the rest of the app does not care whether data is live or replayed.

### Responsibilities
- Connect to live sources such as WebSockets or REST endpoints
- Load offline scenario packs, telemetry bundles, or replay files
- Preserve timestamps and ordering
- Support pause, resume, seek, and step-through for replayed data
- Emit a unified stream of raw messages into the normalization layer

### Design principle
Everything downstream should operate as if it is consuming a time-ordered event stream. Live mode and replay mode should differ only in the source of those events, not in the UI logic.

---

## 2. Adaptive Normalization Layer

The adaptive normalization layer converts whatever raw schema Saronic provides into your own stable internal data model.

Because the incoming message shape is unknown, the UI should never depend directly on raw Saronic payloads. Instead, define canonical schemas for each data category and build adapters that map raw inputs into those canonical forms.

This gives you:
- stable UI types
- schema isolation
- easier testing
- faster adaptation on demo day if the provided data format changes

### Core canonical types

```ts
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
```

```ts
type MissionObject = {
  id: string
  kind: "waypoint" | "route" | "area" | "searchPattern"
  geometry: any
  label?: string
  status?: string
}
```

```ts
type Contact = {
  id: string
  timestamp: string
  lat?: number
  lon?: number
  courseDeg?: number
  speedKts?: number
  source?: string
  type?: string
  riskScore?: number
  cpaNm?: number
  tcpaMin?: number
}
```

```ts
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
```

```ts
type DecisionEpisode = {
  id: string
  timestamp: string
  action: string
  reason: string
  evidence: string[]
  confidence?: number
  projectedNextStep?: string
}
```

```ts
type VideoCameraMetadata = {
  streamId: string
  ts: string
  kind: string
  url?: string
  camera?: {
    name?: string
    fovDeg?: number
  }
}
```

```ts
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
```

```ts
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
```

### Responsibilities
- Parse unknown raw payloads
- Map them into canonical internal objects
- Handle missing or partial fields
- Tolerate variable update rates
- Tag stale data when updates stop arriving
- Normalize both live and replayed inputs identically

### Design principle
The normalization layer is the schema firewall between Saronic’s raw data and your UI.

---

## 3. Explanation Layer

Even after normalization, telemetry, alerts, planner states, and contact streams may still be too raw for an operator-facing interface. The explanation layer should convert normalized signals into clear, operator-ready explanations.

This layer should synthesize:
- what changed
- why it changed
- 2–4 observable facts
- what is expected next

### Example

Raw signals:
- nearby contact detected
- low CPA
- starboard course change
- autonomy mode changed from transit to avoidance

Synthesized explanation:
- **What changed:** Autonomy altered course to starboard.
- **Why:** To increase separation from crossing traffic.
- **Evidence:** CPA 0.18 nm, TCPA 7 min, contact bearing 043°, crossing risk rising.
- **Expected next:** Resume route after safe passing distance is restored.

### SAT-aligned explanation model

A strong way to structure this layer is around **Situation Awareness-based Agent Transparency (SAT)**.

#### Perception
What objects, constraints, or conditions are present?
- nearby contacts
- restricted lanes or hazards
- weather or sea-state constraints
- degraded comms
- mission geometry

#### Comprehension
What does the autonomy assess as important or risky?
- collision risk rising
- crossing situation developing
- route no longer advisable
- comms degraded
- mission objective temporarily blocked

#### Projection
What does the autonomy plan to do next?
- alter course to starboard and pass astern
- hold station until comms recover
- resume transit after conflict clears
- continue search pattern unless a threshold is crossed

### Maritime-specific legibility

In maritime settings, explanations become much more understandable if risk is mapped onto familiar navigation constructs:
- encounter type: crossing, overtaking, head-on
- CPA and TCPA
- give-way / stand-on logic
- route, lane, or restricted-area constraints

That gives operators explanations in operational language instead of model language.

### Recommended synthesized format

```ts
type ExplanationCard = {
  id: string
  timestamp: string
  whatChanged: string
  why: string
  evidence: string[]
  expectedNext: string
  confidence?: number
  relatedObjects?: string[]
}
```

### Responsibilities
- Merge signals from contacts, ownship state, alerts, planner state, and comms
- Generate concise operator-readable narratives
- Avoid exposing raw internal model state unless it directly helps the operator
- Prioritize clarity, trust, and future expectation

### Design principle
The explanation layer is what turns autonomy data into operator understanding.

---

## 4. Presentation Layer

The presentation layer should consume only normalized objects and synthesized explanations to update the UI of the application.

### Design principle
The UI should present stable, operator-oriented concepts, not raw transport messages.

---