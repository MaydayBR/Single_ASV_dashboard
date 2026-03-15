# UI/UX Design Document — FleetCommand
**Saronic Hackathon · Track #1: UI — Visualizing Autonomous Decisions**

> Every design decision in this document serves a single operational goal: help the operator answer the five mission questions as fast as possible, with as little cognitive overhead as possible.
>
> 1. What is the vessel doing right now?
> 2. Why is it doing that?
> 3. What risk/constraint is driving that behavior?
> 4. What will it likely do next?
> 5. Does the operator need to care yet?

---

## Design Philosophy

**Calm, trustworthy, mission-ready.**

FleetCommand should feel like a professional maritime operations console, not a consumer app. The visual language prioritizes:

- **Signal over noise** — Only information that helps the operator act is shown. Everything else is hidden until requested.
- **Urgency legibility** — The operator should be able to assess the situation within two seconds of looking at any panel.
- **Evidence-backed confidence** — Every explanation references observable data. The UI never says something without being able to show why.
- **Calm hierarchy** — Quiet by default, loud only when it needs to be. Critical alerts dominate; informational states recede.

---

## Layout

### Three-Panel Shell

```
┌──────────────────────────────────────────────────────────────────┐
│  COMMS STATUS BANNER (persistent, top — hidden when comms OK)    │
├───────────────────────────┬──────────────────────────────────────┤
│                           │                                      │
│      MISSION MAP          │       FLEET COMMANDER                │
│      (left / center)      │       (right panel)                  │
│      ~55% width           │       ~45% width                     │
│                           │                                      │
│                           ├──────────────────────────────────────┤
│                           │                                      │
│                           │       EVENT TIMELINE                 │
│                           │       (bottom right)                 │
│                           │       ~45% width, scrollable         │
│                           │                                      │
└───────────────────────────┴──────────────────────────────────────┘
```

- **Minimum supported resolution:** 1280 × 800
- **Target resolution:** 1440 × 900 (laptop), 1920 × 1080 (ops center display)
- The map is the largest panel because spatial context is the primary operator reference.
- Fleet Commander and Timeline share the right column, stacked vertically. Fleet Commander leads; Timeline is the memory layer beneath it.
- The Comms Status Banner is zero-height when comms are healthy. It expands only when degraded.

### Panel Proportions (CSS Grid)

```css
/* Approximate grid — tune in implementation */
grid-template-columns: 55fr 45fr;
grid-template-rows: auto 1fr 1fr;
/* Row 1: comms banner (auto-height) */
/* Row 2: map + Fleet Commander (equal weight) */
/* Row 3: map continues + Event Timeline */
```

---

## Color System

### Semantic Color Palette

All colors are defined as CSS custom properties to enable future dark/light mode or theming.

```css
:root {
  /* Background layers */
  --color-bg-base:        #0a0e14;   /* Near-black — main app background */
  --color-bg-panel:       #111827;   /* Panel surfaces */
  --color-bg-panel-alt:   #1a2235;   /* Alternating rows, hover states */
  --color-bg-overlay:     rgba(17, 24, 37, 0.92); /* Map overlays, modals */

  /* Borders */
  --color-border:         #1f2d40;   /* Subtle panel dividers */
  --color-border-accent:  #2d4263;   /* Active/focused panels */

  /* Typography */
  --color-text-primary:   #e8edf5;   /* Primary readable text */
  --color-text-secondary: #8899b0;   /* Supporting / metadata text */
  --color-text-muted:     #4a5568;   /* Placeholder / disabled */

  /* Severity — Alert / Event colors */
  --color-info:           #3b82f6;   /* Blue — informational */
  --color-info-bg:        rgba(59, 130, 246, 0.10);
  --color-warning:        #f59e0b;   /* Amber — attention required */
  --color-warning-bg:     rgba(245, 158, 11, 0.10);
  --color-critical:       #ef4444;   /* Red — immediate action possible */
  --color-critical-bg:    rgba(239, 68, 68, 0.12);

  /* Ownship / Mission */
  --color-ownship:        #22d3ee;   /* Cyan — ownship marker, route */
  --color-route-planned:  #6366f1;   /* Indigo — planned path (dashed) */
  --color-route-actual:   #22d3ee;   /* Cyan — actual track */
  --color-waypoint:       #a78bfa;   /* Violet — waypoints */
  --color-mission-area:   rgba(99, 102, 241, 0.15); /* Mission polygon fill */

  /* Contacts */
  --color-contact-low:    #22c55e;   /* Green — low risk */
  --color-contact-med:    #f59e0b;   /* Amber — medium risk */
  --color-contact-high:   #ef4444;   /* Red — high risk */

  /* Confidence levels */
  --color-conf-high:      #22c55e;
  --color-conf-med:       #f59e0b;
  --color-conf-low:       #ef4444;

  /* Comms status */
  --color-comms-up:       #22c55e;
  --color-comms-degraded: #f59e0b;
  --color-comms-down:     #ef4444;

  /* Recommendation urgency */
  --color-rec-monitor:    #3b82f6;
  --color-rec-inspect:    #f59e0b;
  --color-rec-prepare:    #f97316;
  --color-rec-act:        #ef4444;
}
```

### Color Usage Rules

- **Never use red for anything that is not a genuine threat or critical failure.** Overuse of red destroys urgency signaling.
- **Cyan (`--color-ownship`) is reserved exclusively for the ownship.** Contacts must never use cyan.
- **Background colors should always be darker than foreground.** The UI is dark-mode only (maritime ops environment).
- **Transparency overlays** on the map must allow chart features to remain readable.

---

## Typography

```css
/* Import from Google Fonts in index.html */
/* Display: JetBrains Mono (data labels, coordinates, timestamps) */
/* Body: Inter or DM Sans (operator text, explanations) */

--font-display: 'JetBrains Mono', monospace;  /* Tactical data, numbers */
--font-body:    'Inter', sans-serif;           /* Prose, explanations */

/* Scale */
--text-xs:   0.75rem;   /* 12px — timestamps, metadata */
--text-sm:   0.875rem;  /* 14px — event rows, secondary labels */
--text-base: 1rem;      /* 16px — primary body, explanation text */
--text-lg:   1.125rem;  /* 18px — panel headers */
--text-xl:   1.25rem;   /* 20px — Fleet Commander situation line */

/* Weight */
--font-normal:   400;
--font-medium:   500;
--font-semibold: 600;
--font-bold:     700;
```

**Rules:**
- All numeric data (coordinates, speed, heading, CPA, TCPA, timestamps) uses `--font-display` (monospace) for alignment and scannability.
- All prose (explanations, alert titles, recommendations) uses `--font-body`.
- Panel headers are `--text-lg`, `--font-semibold`, `--color-text-secondary` (subdued — panels should not compete with content).

---

## Component Specifications

### 1. Comms Status Banner

**Location:** Pinned top of layout.
**Default state:** Zero height, invisible (comms healthy).
**Active states:**

| State | Color | Content |
|---|---|---|
| `up` | Hidden | — |
| `degraded` | `--color-warning-bg` + amber left border | `⚠ COMMS DEGRADED · Last heard: {timestamp} · {link name} {latency}ms` |
| `down` | `--color-critical-bg` + red left border | `✕ COMMS LINK DOWN · Data may be stale · Last heard: {timestamp}` |

The stale-data warning must also cause map elements and telemetry values to show a grey "stale" overlay badge.

---

### 2. Mission Map Panel

**Library:** MapLibre GL JS (preferred) or Leaflet.
**Basemap:** Dark maritime tile layer (OpenFreeMap or similar). Must not distract from operational overlays.

#### Map Layers (in render order, bottom to top)

| Layer | Style | Notes |
|---|---|---|
| Basemap tiles | Dark maritime | OpenFreeMap dark, NOAA RNC, or custom |
| Hazard/restricted zones | Red fill `0.15` opacity, dashed red border | Must be clearly distinguishable but not dominating |
| Mission area polygon | `--color-mission-area` fill, indigo border | Semi-transparent; operator sees chart through it |
| Search pattern | Dashed violet lines | If `MissionObject.kind === "searchPattern"` |
| Planned route | Dashed indigo polyline `2px` | `--color-route-planned` |
| Actual track | Solid cyan polyline `2px` | `--color-route-actual` |
| Waypoints | Violet diamond markers with labels | `--color-waypoint`; show label on hover/zoom |
| Contacts | Directional arrow + circle markers | Color by `riskScore`; see below |
| CPA intercept line | Dashed red line | Visible when `cpaNm < 0.5` |
| Ownship | Cyan chevron / ship icon | Always on top; heading indicator |

#### Ownship Marker States

| `health` value | Visual |
|---|---|
| `"ok"` | Solid cyan fill |
| `"warning"` | Amber outline, pulsing ring |
| `"critical"` | Red fill, fast-pulsing ring |

#### Contact Marker States

| `riskScore` | Color | Label |
|---|---|---|
| `< 0.3` | Green | Low |
| `0.3 – 0.7` | Amber | Medium |
| `> 0.7` | Red | High |

Contact marker on click: highlights the marker, draws CPA intercept line if applicable, and triggers Fleet Commander to update with a contact-focused explanation.

#### Map Controls

- Zoom in/out (keyboard `+`/`-` and scroll wheel)
- Click-to-select contacts and waypoints
- "Re-center on ownship" button (always visible, bottom-left)
- Optional layer toggles (hazards, search pattern, AIS context) via icon buttons bottom-right

---

### 3. Event Timeline Panel

**Location:** Bottom-right panel, vertically scrollable, newest events at top.

#### Event Row Anatomy

```
┌─ severity bar (4px left border) ─────────────────────────────────┐
│  [icon] Event Title                                    HH:MM:SS  │
│         Category tag  ·  Optional secondary detail               │
└───────────────────────────────────────────────────────────────────┘
```

- **Severity bar:** 4px left border color = `--color-info / warning / critical`
- **Icon:** Small category icon (Lucide): autonomy / collision / mission / sensor / comms
- **Title:** Operator-friendly string (e.g. "Autonomy shifted to avoidance" not "MODE_CHANGE_TRANSIT_AVOIDANCE")
- **Timestamp:** Monospace, right-aligned, relative (e.g. "2m ago") that shows absolute on hover
- **Category tag:** Small badge, muted color, one of: `autonomy | collision | mission | sensor | comms`

#### Selected State

When an event row is clicked:
1. Row background changes to `--color-bg-panel-alt` with accent left border
2. Related map elements (contact, waypoint, zone) are highlighted
3. Fleet Commander updates to a targeted explanation for that event
4. A "back to current" affordance appears in Fleet Commander to return to live state

#### Event Row Expansion

Click the chevron / press Enter on a selected row to expand:
- Full timestamp (ISO 8601)
- Detailed description
- Linked contact or mission object ID
- `recommendedAction` if present
- Supporting evidence bullets

#### Filtering

Event types shown in timeline (in priority order — highest risk bubbles to top of visible area when new):

**Autonomy events:** mode change, route adjustment, heading change, speed change, avoidance start/end, hold-position, return-to-route, confidence drop

**Risk/contact events:** contact classified, CPA/TCPA threshold crossed, collision risk escalated, hazard proximity, contact cleared

**Mission events:** mission started/completed, waypoint arrived, mission-phase transition, route replanning, search pattern entered

**System events:** comms degraded/restored, sensor health change, alert created/cleared

**Excluded (never shown):** raw telemetry ticks, heartbeat pings, unchanged state republishes

---

### 4. Fleet Commander Panel

**Location:** Top-right panel.
**Role:** The operator's primary explanation surface. One active explanation at a time.

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  [Captain Avatar]   FLEET COMMANDER          [urgency badge]    │
│                     "Monitoring vessel behavior"                │
├─────────────────────────────────────────────────────────────────┤
│  SITUATION                                                      │
│  {whatChanged} — plain-language sentence                        │
├─────────────────────────────────────────────────────────────────┤
│  REASON                                                         │
│  {why} — causal explanation                                     │
├─────────────────────────────────────────────────────────────────┤
│  EVIDENCE                            CONFIDENCE   [High / Med / Low] │
│  • {evidence[0]}                                                │
│  • {evidence[1]}                                                │
│  • {evidence[2]}                                                │
├─────────────────────────────────────────────────────────────────┤
│  EXPECTED NEXT                                                  │
│  {expectedNext}                                                 │
├─────────────────────────────────────────────────────────────────┤
│  RECOMMENDATION                        [urgency color border]   │
│  {recommendation label}  ·  {brief explanation}                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Captain Avatar

- A stylized maritime officer silhouette or icon (SVG). Minimal, not cartoonish.
- When the explanation represents a critical alert, the avatar border pulses in `--color-critical`.
- When comms are degraded, the avatar has a visual "comms degraded" indicator (e.g. signal icon with slash).
- The avatar reinforces the copilot metaphor: the system is *speaking to* the operator.

#### Section Rules

| Section | Max text length | Notes |
|---|---|---|
| Situation | 1–2 sentences | State the most important fact |
| Reason | 1–2 sentences | Causal, not technical |
| Evidence | 2–4 bullet points | Observable, data-backed facts |
| Expected Next | 1 sentence | Probability-hedged if uncertain |
| Recommendation | 1 label + 1 sentence | See urgency levels below |

#### Recommendation Urgency Levels

| Level | Color | Label | Example |
|---|---|---|---|
| Monitor | Blue (`--color-rec-monitor`) | MONITOR | "Situation is developing but no action needed yet." |
| Inspect | Amber (`--color-rec-inspect`) | INSPECT | "Review contact details. CPA is tightening." |
| Prepare | Orange (`--color-rec-prepare`) | PREPARE TO ACT | "Intervention may be needed within 5 minutes." |
| Act | Red (`--color-rec-act`) | ACT NOW | "Operator intervention recommended immediately." |

#### Confidence Badge

| Level | Color |
|---|---|
| High | `--color-conf-high` (green) |
| Medium | `--color-conf-med` (amber) |
| Low | `--color-conf-low` (red) |

#### Event-Selected Mode

When the operator selects a timeline event, Fleet Commander switches to "event-focused" mode:
- A breadcrumb shows: `← Live State  |  Explaining: "{event title}"`
- The explanation addresses that specific event (what happened, why it mattered, what was expected next)
- Clicking the breadcrumb returns to live current-state explanation

#### Tone Guidelines

Fleet Commander text must sound like a calm, experienced maritime co-pilot:

✓ **Good:** "Vessel altered course to starboard. A crossing contact at bearing 043° has CPA 0.18 nm and TCPA 7 min — within avoidance threshold. Autonomy engaged avoidance mode to increase separation."

✗ **Bad:** "COLLISION RISK DETECTED. VESSEL CHANGING COURSE. OPERATOR MUST RESPOND IMMEDIATELY."

✗ **Bad:** "Hey, looks like the boat is turning! There's another ship nearby that might be getting close."

---

## Interaction Model

### Operator Attention Flow

```
[Comms Banner] → immediate system health
      ↓
[Map] → spatial situation at a glance
      ↓
[Fleet Commander] → what is happening and why
      ↓
[Timeline] → click to reconstruct sequence of events
      ↓
[Fleet Commander updates] → focused explanation of selected event
```

### Click / Selection Behaviors

| Action | Map Response | Fleet Commander Response | Timeline Response |
|---|---|---|---|
| Click contact on map | Highlight contact, draw CPA line | Update to contact-focused explanation | Scroll to most recent contact event |
| Click event in timeline | Highlight linked map elements | Update to event-focused explanation | Expand selected row |
| Click waypoint on map | Highlight waypoint | Update with waypoint/mission context | Scroll to nearest mission event |
| Click "Live State" breadcrumb | Return to normal state | Return to current-state explanation | Deselect all |

### Keyboard Navigation

| Key | Action |
|---|---|
| `↑ / ↓` | Navigate timeline events |
| `Enter` | Select / expand focused event |
| `Escape` | Return to live state / close expansion |
| `+ / -` | Map zoom |
| `C` | Re-center map on ownship |

---

## Animation & Motion

- **Comms banner:** Slide down from zero height with `200ms ease-out`
- **Fleet Commander explanation swap:** Cross-fade text with `150ms ease`; do not hard-cut
- **New timeline event insertion:** Slide-in from top with `150ms ease-out`
- **Contact risk escalation:** Marker color transition `400ms ease`; critical marker gets a single 600ms pulse ring
- **Ownship health change:** Pulsing ring starts/stops with `200ms ease`
- **Panel hover states:** `100ms ease` background transition

Avoid animations that interfere with information readability. Motion should reinforce state change, not decorate.

---

## Accessibility

| Standard | Requirement |
|---|---|
| Color contrast | WCAG AA minimum (4.5:1 for normal text, 3:1 for large) |
| Severity communication | Never rely on color alone — also use icons and text labels |
| Focus indicators | Visible focus ring on all interactive elements |
| ARIA roles | `role="log"` on Event Timeline, `role="status"` on Comms Banner, `aria-live="polite"` on Fleet Commander |
| Keyboard | All click interactions accessible via keyboard |
| Font size | Minimum 12px for any visible text |

---

## Responsive Behavior

| Breakpoint | Layout |
|---|---|
| ≥ 1280px | Three-panel layout as described above |
| 1024–1279px | Map takes full height left; Fleet Commander and Timeline stack right with reduced width |
| < 1024px | Tabs: Map / Timeline / Fleet Commander (single-panel mobile fallback) |

The hackathon primary target is desktop (1280px+). The mobile fallback is a nice-to-have.

---

## Component Library Organization

```
src/components/
└── mockups/
    └── fleet-command/
        ├── FleetCommand.tsx          # Shell layout
        ├── MissionMap.tsx            # Map panel + all map layers
        ├── EventTimeline.tsx         # Timeline feed + event rows
        ├── FleetCommander.tsx        # Explanation panel + avatar
        └── ui/                       # Sub-components
            ├── CommsStatusBanner.tsx
            ├── ExplanationCard.tsx
            ├── EventRow.tsx
            ├── ContactMarker.tsx
            ├── OwnshipMarker.tsx
            ├── SeverityBadge.tsx
            ├── ConfidenceBadge.tsx
            ├── RecommendationBadge.tsx
            └── CaptainAvatar.tsx
```

---

## Wireframe Reference — Fleet Commander Panel States

### State A: Live / Default (no selection)

```
[Avatar] FLEET COMMANDER                   [MONITOR]
──────────────────────────────────────────────────
SITUATION
Vessel conducting search pattern, leg 3 of 6.
──────────────────────────────────────────────────
REASON
Route execution is nominal. No active contacts 
above risk threshold.
──────────────────────────────────────────────────
EVIDENCE                          CONFIDENCE [High]
• Heading 043° ± 2° (on-track)
• Speed 8.2 kts (planned 8.0 kts)
• Nearest contact CPA 1.4 nm (below threshold)
──────────────────────────────────────────────────
EXPECTED NEXT
Complete current leg in ~4 min, turn to 133° 
to begin leg 4.
──────────────────────────────────────────────────
RECOMMENDATION                            [MONITOR]
Monitor only. Vessel is on plan.
```

### State B: Active Alert (contact risk)

```
[Avatar] FLEET COMMANDER                   [INSPECT]
──────────────────────────────────────────────────
SITUATION
Vessel altered course to starboard at 14:22:08.
──────────────────────────────────────────────────
REASON
Crossing contact (AIS MMSI 123456) approaching 
on port bow with tightening CPA.
──────────────────────────────────────────────────
EVIDENCE                          CONFIDENCE  [Med]
• Contact CPA 0.18 nm (below 0.5 nm threshold)
• TCPA 7 min and closing
• Contact bearing 043°, crossing situation (COLREGS Rule 15)
• Autonomy shifted: TRANSIT → AVOIDANCE
──────────────────────────────────────────────────
EXPECTED NEXT
Maintain altered course until safe passing distance 
restored, then resume route.
──────────────────────────────────────────────────
RECOMMENDATION                           [INSPECT]
Monitor contact closely. If CPA continues to 
tighten below 0.1 nm, prepare to intervene.
```

---

## Design Anti-Patterns to Avoid

| Anti-Pattern | Why | What to Do Instead |
|---|---|---|
| Raw field names in UI text | Destroys operator trust | Always use operator-friendly labels |
| Status displayed without timestamp | Stale data looks like fresh | Show "as of {timestamp}" on all key values |
| Uniform alert coloring | Urgency signal lost | Use color + icon + label for severity |
| Explanations without evidence | Operator can't verify | Always show 2–4 observable data points |
| Animations on critical content | Distracts from information | Reserve animation for state-change moments only |
| All-caps labels for non-critical states | Desensitizes to urgency | Reserve all-caps for critical states |
| Map covering entire screen by default | No context panels visible | Always show all three panels simultaneously |
