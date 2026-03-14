import { useState, useRef, useEffect } from "react";

// ─── Normalized Data Model (UI Contract) ────────────────────────────────────

export interface LatLon {
  lat: number;
  lon: number;
}

export interface OwnshipState {
  id: string;
  name: string;
  position: LatLon;
  headingDeg: number;       // 0–360, true north
  speedKts: number;
  depthM: number | null;    // null for surface
  modeLabel: string;        // e.g. "AUTONOMOUS – SEARCH PATTERN"
  missionPhase: string;     // e.g. "Search Leg 3 of 7"
  fuelPct: number;          // 0–100
  batteryPct: number | null;
  updatedAt: Date;
}

export type ContactType = "surface" | "subsurface" | "air" | "unknown";
export type RiskLevel = "critical" | "elevated" | "nominal" | "none";

export interface Contact {
  id: string;
  label: string;
  type: ContactType;
  position: LatLon;
  headingDeg: number;
  speedKts: number;
  riskLevel: RiskLevel;
  closestPointOfApproachNm: number;
  timeToClosestApproachMin: number;
  classification: string;
  updatedAt: Date;
}

export type WaypointStatus = "completed" | "active" | "upcoming";

export interface Waypoint {
  id: string;
  sequence: number;
  position: LatLon;
  label: string;
  status: WaypointStatus;
}

export interface MissionObject {
  id: string;
  missionName: string;
  missionType: string;       // e.g. "Search and Survey"
  plannedRoute: LatLon[];    // ordered waypoints defining planned track
  actualTrack: LatLon[];     // recorded actual positions
  waypoints: Waypoint[];
  searchPolygon: LatLon[] | null;
  hazardZones: { id: string; label: string; polygon: LatLon[]; severity: RiskLevel }[];
  startedAt: Date;
  estimatedEndAt: Date;
}

export type AlertSeverity = "critical" | "warning" | "info" | "nominal";

export interface AlertEvent {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  category: string;          // e.g. "Contact Risk", "Route Deviation", "Comms"
  title: string;             // short operator-facing label
  detail: string;            // one-sentence elaboration
  relatedContactId?: string;
  relatedWaypointId?: string;
  isAcknowledged: boolean;
}

export interface EvidencePoint {
  label: string;
  value: string;
}

export interface DecisionEpisode {
  id: string;
  triggerEventId: string | null;
  situation: string;         // what is happening right now
  reason: string;            // why the vessel is doing this
  confidence: number;        // 0–100
  confidenceLabel: string;   // "High" | "Moderate" | "Low"
  recommendation: string;    // what the operator should consider
  expectedNextStep: string;
  evidence: EvidencePoint[];
  generatedAt: Date;
}

export interface CommsStatus {
  linkLabel: string;          // e.g. "RF Primary"
  isStale: boolean;
  lastContactAt: Date;
  staleSec: number;
  degraded: boolean;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const now = new Date();
const mins = (n: number) => new Date(now.getTime() - n * 60_000);

export const mockOwnship: OwnshipState = {
  id: "ownship-1",
  name: "UVS-241 SIREN",
  position: { lat: 36.84, lon: -75.96 },
  headingDeg: 47,
  speedKts: 4.2,
  depthM: null,
  modeLabel: "AUTONOMOUS – SEARCH PATTERN",
  missionPhase: "Search Leg 3 of 7",
  fuelPct: 61,
  batteryPct: 74,
  updatedAt: mins(1),
};

export const mockContacts: Contact[] = [
  {
    id: "c1",
    label: "TGT-01",
    type: "surface",
    position: { lat: 36.87, lon: -75.91 },
    headingDeg: 220,
    speedKts: 12.4,
    riskLevel: "critical",
    closestPointOfApproachNm: 0.18,
    timeToClosestApproachMin: 6,
    classification: "Fast Mover – Possible Intercept",
    updatedAt: mins(2),
  },
  {
    id: "c2",
    label: "TGT-02",
    type: "surface",
    position: { lat: 36.80, lon: -75.89 },
    headingDeg: 10,
    speedKts: 5.1,
    riskLevel: "elevated",
    closestPointOfApproachNm: 0.65,
    timeToClosestApproachMin: 22,
    classification: "Fishing Vessel",
    updatedAt: mins(4),
  },
  {
    id: "c3",
    label: "TGT-03",
    type: "unknown",
    position: { lat: 36.82, lon: -76.01 },
    headingDeg: 90,
    speedKts: 0.3,
    riskLevel: "nominal",
    closestPointOfApproachNm: 1.8,
    timeToClosestApproachMin: 85,
    classification: "Stationary / Unknown",
    updatedAt: mins(9),
  },
];

export const mockMission: MissionObject = {
  id: "msn-24",
  missionName: "Op CLEAN SLATE – Sector 4",
  missionType: "Search and Survey",
  plannedRoute: [
    { lat: 36.80, lon: -76.02 },
    { lat: 36.84, lon: -75.96 },
    { lat: 36.87, lon: -75.93 },
    { lat: 36.89, lon: -75.88 },
    { lat: 36.86, lon: -75.83 },
    { lat: 36.82, lon: -75.83 },
    { lat: 36.79, lon: -75.88 },
    { lat: 36.80, lon: -76.02 },
  ],
  actualTrack: [
    { lat: 36.80, lon: -76.02 },
    { lat: 36.81, lon: -75.99 },
    { lat: 36.83, lon: -75.97 },
    { lat: 36.84, lon: -75.96 },
  ],
  waypoints: [
    { id: "wp1", sequence: 1, position: { lat: 36.80, lon: -76.02 }, label: "WP-1 START", status: "completed" },
    { id: "wp2", sequence: 2, position: { lat: 36.84, lon: -75.96 }, label: "WP-2", status: "active" },
    { id: "wp3", sequence: 3, position: { lat: 36.87, lon: -75.93 }, label: "WP-3", status: "upcoming" },
    { id: "wp4", sequence: 4, position: { lat: 36.89, lon: -75.88 }, label: "WP-4", status: "upcoming" },
    { id: "wp5", sequence: 5, position: { lat: 36.86, lon: -75.83 }, label: "WP-5", status: "upcoming" },
    { id: "wp6", sequence: 6, position: { lat: 36.82, lon: -75.83 }, label: "WP-6", status: "upcoming" },
    { id: "wp7", sequence: 7, position: { lat: 36.79, lon: -75.88 }, label: "WP-7", status: "upcoming" },
    { id: "wp8", sequence: 8, position: { lat: 36.80, lon: -76.02 }, label: "WP-8 END", status: "upcoming" },
  ],
  searchPolygon: [
    { lat: 36.79, lon: -76.04 },
    { lat: 36.90, lon: -76.04 },
    { lat: 36.90, lon: -75.81 },
    { lat: 36.79, lon: -75.81 },
  ],
  hazardZones: [
    {
      id: "hz1",
      label: "Restricted — Cabling",
      severity: "warning",
      polygon: [
        { lat: 36.85, lon: -75.99 },
        { lat: 36.86, lon: -75.96 },
        { lat: 36.84, lon: -75.95 },
        { lat: 36.83, lon: -75.98 },
      ],
    },
  ],
  startedAt: new Date(now.getTime() - 3 * 60 * 60_000),
  estimatedEndAt: new Date(now.getTime() + 5 * 60 * 60_000),
};

export const mockEvents: AlertEvent[] = [
  {
    id: "ev1",
    timestamp: mins(2),
    severity: "critical",
    category: "Contact Risk",
    title: "CPA breach — TGT-01 closing fast",
    detail: "TGT-01 on intercept bearing 220°T, CPA 0.18 nm in ~6 min. Rule-of-road precedence unclear.",
    relatedContactId: "c1",
    isAcknowledged: false,
  },
  {
    id: "ev2",
    timestamp: mins(5),
    severity: "warning",
    category: "Route",
    title: "Minor deviation — currents pushing port",
    detail: "Ownship tracking 3° left of planned track. Correction maneuver initiated.",
    isAcknowledged: false,
  },
  {
    id: "ev3",
    timestamp: mins(9),
    severity: "warning",
    category: "Comms",
    title: "RF link degraded — 9 min since last ping",
    detail: "Last RF contact at 14:47Z. Acoustic backup active. No data loss yet.",
    isAcknowledged: true,
  },
  {
    id: "ev4",
    timestamp: mins(14),
    severity: "info",
    category: "Mission",
    title: "WP-2 approach — entering leg 3",
    detail: "Ownship within 0.3 nm of WP-2. Transitioning to Search Leg 3.",
    relatedWaypointId: "wp2",
    isAcknowledged: true,
  },
  {
    id: "ev5",
    timestamp: mins(21),
    severity: "info",
    category: "Contact",
    title: "New contact — TGT-03 detected",
    detail: "Stationary surface contact bearing 265°T at 1.8 nm. Classification: Unknown.",
    relatedContactId: "c3",
    isAcknowledged: true,
  },
  {
    id: "ev6",
    timestamp: mins(38),
    severity: "info",
    category: "Mission",
    title: "Hazard zone proximity — restricted cabling area",
    detail: "Ownship within 0.5 nm of cabling restriction zone. Auto-deconfliction active.",
    isAcknowledged: true,
  },
  {
    id: "ev7",
    timestamp: mins(47),
    severity: "nominal",
    category: "System",
    title: "Telemetry nominal — all sensors green",
    detail: "Sonar, INS, and GPS within spec. System health 98%.",
    isAcknowledged: true,
  },
];

export const mockComms: CommsStatus = {
  linkLabel: "RF Primary",
  isStale: true,
  lastContactAt: mins(9),
  staleSec: 9 * 60,
  degraded: true,
};

const decisionsByEvent: Record<string, DecisionEpisode> = {
  default: {
    id: "de0",
    triggerEventId: null,
    situation:
      "UVS-241 SIREN is executing Search Leg 3 of 7 at 4.2 kts on heading 047°T. A fast-closing surface contact (TGT-01) has triggered a CPA breach alert. RF comms are degraded; acoustic backup is active.",
    reason:
      "Autonomous collision avoidance logic is actively monitoring TGT-01 and has flagged a potential Rule 16 give-way obligation. The vessel is evaluating an early course alteration to starboard to open the CPA margin above the 0.5 nm safety threshold.",
    confidence: 82,
    confidenceLabel: "High",
    recommendation:
      "Monitor TGT-01 behavior over the next 3 minutes. If CPA does not improve, consider issuing a manual course override to 090°T to create additional separation. No immediate intervention required.",
    expectedNextStep:
      "Autonomous starboard correction of ~15° initiated within 60 sec if TGT-01 bearing remains steady.",
    evidence: [
      { label: "TGT-01 CPA", value: "0.18 nm — below 0.5 nm threshold" },
      { label: "Time to CPA", value: "~6 min at current closing rate" },
      { label: "Bearing rate", value: "Steady — collision geometry confirmed" },
      { label: "Comms status", value: "RF degraded — acoustic fallback active" },
    ],
    generatedAt: mins(1),
  },
  ev1: {
    id: "de1",
    triggerEventId: "ev1",
    situation:
      "TGT-01 is bearing 047°T relative, closing at a combined closure rate of ~16 kts. CPA is 0.18 nm, crossing approximately 6 minutes from now. Rule 16 of COLREGS may apply — ownship may be the give-way vessel.",
    reason:
      "The contact's speed and heading create a classic crossing situation where ownship has the obligation to take early and substantial action. Autonomous logic assessed this against the mission track and current sea room.",
    confidence: 88,
    confidenceLabel: "High",
    recommendation:
      "Prepare to authorize a manual starboard alteration to 090°T if autonomous correction is not executed in the next 90 seconds. Ensure acoustic link is ready for command relay if RF remains down.",
    expectedNextStep:
      "Course alteration to open CPA above 0.5 nm. System will reassess contact geometry after maneuver settles.",
    evidence: [
      { label: "TGT-01 bearing", value: "Steady at 040°T — collision geometry" },
      { label: "CPA", value: "0.18 nm in ~6 min" },
      { label: "Speed (TGT-01)", value: "12.4 kts, heading 220°T" },
      { label: "Sea room to starboard", value: ">2 nm — maneuver viable" },
    ],
    generatedAt: mins(2),
  },
  ev2: {
    id: "de2",
    triggerEventId: "ev2",
    situation:
      "Ownship is tracking approximately 3° left of the planned track on Leg 3. A correction maneuver has been initiated to return to the centerline within 400 m.",
    reason:
      "Wind-driven current from the northeast is imparting a consistent port set of 0.4 kts. The autonomous track-following algorithm applied a preemptive heading correction to compensate.",
    confidence: 94,
    confidenceLabel: "High",
    recommendation:
      "No action required. Track correction is within normal autonomous tolerance. Verify search coverage is not meaningfully impacted on the port side of the search box.",
    expectedNextStep:
      "Return to planned track within 3 minutes. Heading correction of +5° will be removed once back on centerline.",
    evidence: [
      { label: "Cross-track error", value: "310 m — within 400 m tolerance" },
      { label: "Set and drift", value: "0.4 kts northeasterly" },
      { label: "Correction heading", value: "+5° from nominal" },
      { label: "ETA to centerline", value: "~3 min" },
    ],
    generatedAt: mins(5),
  },
  ev3: {
    id: "de3",
    triggerEventId: "ev3",
    situation:
      "RF primary link has been silent for 9 minutes. Acoustic fallback is operating nominally. No command messages are queued. Vessel is operating autonomously within mission parameters.",
    reason:
      "RF degradation is consistent with known ducting conditions at this range and sea state. Acoustic link provides 1,200-baud command capability, which is sufficient for emergency override.",
    confidence: 71,
    confidenceLabel: "Moderate",
    recommendation:
      "If RF is not restored within 15 minutes, consider transmitting a contingency hold command over acoustic to freeze the vessel at the next waypoint. Current mission progress is unaffected.",
    expectedNextStep:
      "Acoustic keepalive pings every 120 seconds. RF auto-retry in progress — link expected to recover at WP-3 approach due to geometry change.",
    evidence: [
      { label: "RF last contact", value: "14:47Z (9 min ago)" },
      { label: "Acoustic link", value: "Active — 1,200 baud" },
      { label: "Queued commands", value: "None" },
      { label: "RF retry", value: "Auto — every 60 sec" },
    ],
    generatedAt: mins(9),
  },
};

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function fmtTime(d: Date): string {
  return d.toISOString().substring(11, 16) + "Z";
}

function relTime(d: Date): string {
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

// ─── Colour / severity maps ──────────────────────────────────────────────────

const severityColors: Record<AlertSeverity, string> = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#38bdf8",
  nominal: "#4ade80",
};

const severityBg: Record<AlertSeverity, string> = {
  critical: "rgba(239,68,68,0.08)",
  warning: "rgba(245,158,11,0.08)",
  info: "rgba(56,189,248,0.06)",
  nominal: "rgba(74,222,128,0.06)",
};

const riskColors: Record<RiskLevel, string> = {
  critical: "#ef4444",
  elevated: "#f59e0b",
  nominal: "#4ade80",
  none: "#6b7280",
};

// ─── 2D Mission Map Component ─────────────────────────────────────────────────

const MAP_BOUNDS = {
  minLat: 36.775, maxLat: 36.91,
  minLon: -76.06, maxLon: -75.78,
};

function projectToSvg(
  pos: LatLon,
  svgW: number,
  svgH: number,
  pad = 20
): [number, number] {
  const { minLat, maxLat, minLon, maxLon } = MAP_BOUNDS;
  const x = pad + ((pos.lon - minLon) / (maxLon - minLon)) * (svgW - 2 * pad);
  const y = pad + ((maxLat - pos.lat) / (maxLat - minLat)) * (svgH - 2 * pad);
  return [x, y];
}

function toPolyPoints(pts: LatLon[], W: number, H: number): string {
  return pts.map((p) => projectToSvg(p, W, H).join(",")).join(" ");
}

function toPolylinePath(pts: LatLon[], W: number, H: number): string {
  if (pts.length === 0) return "";
  const [first, ...rest] = pts;
  const [fx, fy] = projectToSvg(first, W, H);
  const d = `M ${fx} ${fy} ` + rest.map((p) => {
    const [x, y] = projectToSvg(p, W, H);
    return `L ${x} ${y}`;
  }).join(" ");
  return d;
}

interface MissionMapProps {
  ownship: OwnshipState;
  mission: MissionObject;
  contacts: Contact[];
  comms: CommsStatus;
  selectedContactId: string | null;
  onContactSelect: (id: string | null) => void;
}

function MissionMap({ ownship, mission, contacts, comms, selectedContactId, onContactSelect }: MissionMapProps) {
  const W = 480, H = 400;
  const [ox, oy] = projectToSvg(ownship.position, W, H);

  // Arrow head for heading
  const headRad = ((ownship.headingDeg - 90) * Math.PI) / 180;
  const arrowLen = 22;
  const ax = ox + Math.cos(headRad) * arrowLen;
  const ay = oy + Math.sin(headRad) * arrowLen;

  return (
    <div style={{ background: "#0b1220", borderRadius: 6, overflow: "hidden", position: "relative", width: "100%", height: "100%" }}>
      {/* Stale comms banner */}
      {comms.isStale && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          background: "rgba(245,158,11,0.18)", borderBottom: "1px solid rgba(245,158,11,0.4)",
          padding: "4px 10px", display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: "#f59e0b", fontFamily: "monospace",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", display: "inline-block", animation: "pulse 1.5s infinite" }} />
          COMMS DEGRADED — {comms.linkLabel} last contact {Math.floor(comms.staleSec / 60)}m ago · Acoustic fallback active
        </div>
      )}

      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <g key={t}>
            <line x1={W * t} y1={0} x2={W * t} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
            <line x1={0} y1={H * t} x2={W} y2={H * t} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          </g>
        ))}

        {/* Search polygon */}
        {mission.searchPolygon && (
          <polygon
            points={toPolyPoints(mission.searchPolygon, W, H)}
            fill="rgba(56,189,248,0.04)"
            stroke="rgba(56,189,248,0.25)"
            strokeWidth={1}
            strokeDasharray="6 4"
          />
        )}

        {/* Hazard zones */}
        {mission.hazardZones.map((hz) => (
          <g key={hz.id}>
            <polygon
              points={toPolyPoints(hz.polygon, W, H)}
              fill="rgba(245,158,11,0.08)"
              stroke="rgba(245,158,11,0.4)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          </g>
        ))}

        {/* Planned route */}
        <path
          d={toPolylinePath(mission.plannedRoute, W, H)}
          fill="none"
          stroke="rgba(56,189,248,0.3)"
          strokeWidth={1.5}
          strokeDasharray="8 5"
        />

        {/* Actual track */}
        <path
          d={toPolylinePath(mission.actualTrack, W, H)}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={2}
        />

        {/* Waypoints */}
        {mission.waypoints.map((wp) => {
          const [wx, wy] = projectToSvg(wp.position, W, H);
          const color = wp.status === "completed" ? "#4ade80" : wp.status === "active" ? "#38bdf8" : "rgba(148,163,184,0.5)";
          return (
            <g key={wp.id}>
              <circle cx={wx} cy={wy} r={4} fill="none" stroke={color} strokeWidth={1.5} />
              <circle cx={wx} cy={wy} r={1.5} fill={color} />
              <text x={wx + 6} y={wy + 4} fontSize={8} fill={color} fontFamily="monospace" opacity={0.85}>{wp.label}</text>
            </g>
          );
        })}

        {/* Contacts */}
        {contacts.map((c) => {
          const [cx, cy] = projectToSvg(c.position, W, H);
          const col = riskColors[c.riskLevel];
          const isSelected = selectedContactId === c.id;
          const headRad2 = ((c.headingDeg - 90) * Math.PI) / 180;
          const cax = cx + Math.cos(headRad2) * 14;
          const cay = cy + Math.sin(headRad2) * 14;
          return (
            <g key={c.id} style={{ cursor: "pointer" }} onClick={() => onContactSelect(isSelected ? null : c.id)}>
              {isSelected && (
                <circle cx={cx} cy={cy} r={14} fill="none" stroke={col} strokeWidth={1} opacity={0.4} />
              )}
              <polygon
                points={`${cx},${cy - 8} ${cx - 5},${cy + 5} ${cx + 5},${cy + 5}`}
                fill={isSelected ? col : "none"}
                stroke={col}
                strokeWidth={1.5}
              />
              <line x1={cx} y1={cy - 8} x2={cax} y2={cay} stroke={col} strokeWidth={1} opacity={0.7} />
              <text x={cx + 8} y={cy - 6} fontSize={8} fill={col} fontFamily="monospace">{c.label}</text>
            </g>
          );
        })}

        {/* Ownship */}
        <g>
          {/* Range ring */}
          <circle cx={ox} cy={oy} r={30} fill="none" stroke="rgba(56,189,248,0.12)" strokeWidth={0.8} />
          {/* Heading line */}
          <line x1={ox} y1={oy} x2={ax} y2={ay} stroke="#38bdf8" strokeWidth={1.5} />
          {/* Ship body */}
          <polygon
            points={`${ox},${oy - 10} ${ox - 5},${oy + 7} ${ox},${oy + 4} ${ox + 5},${oy + 7}`}
            fill="#38bdf8"
            opacity={0.95}
            style={{ transform: `rotate(${ownship.headingDeg}deg)`, transformOrigin: `${ox}px ${oy}px` }}
          />
          <circle cx={ox} cy={oy} r={2} fill="#0b1220" />
        </g>

        {/* Map label */}
        <text x={8} y={H - 8} fontSize={8} fill="rgba(148,163,184,0.5)" fontFamily="monospace">
          OP CLEAN SLATE – SECTOR 4 | {fmtTime(now)} UTC
        </text>
      </svg>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 10, right: 10,
        background: "rgba(11,18,32,0.85)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 4, padding: "6px 10px", fontSize: 9, color: "#94a3b8", fontFamily: "monospace",
        lineHeight: 1.8,
      }}>
        <div style={{ color: "#38bdf8" }}>━━ Actual track</div>
        <div style={{ color: "rgba(56,189,248,0.4)" }}>┅┅ Planned route</div>
        <div style={{ color: "rgba(245,158,11,0.6)" }}>┅┅ Hazard zone</div>
        <div style={{ color: "rgba(56,189,248,0.35)" }}>┅┅ Search area</div>
      </div>
    </div>
  );
}

// ─── Event Timeline Component ────────────────────────────────────────────────

interface EventTimelineProps {
  events: AlertEvent[];
  selectedEventId: string | null;
  onEventSelect: (id: string | null) => void;
}

function EventTimeline({ events, selectedEventId, onEventSelect }: EventTimelineProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Event Timeline
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
          {events.filter(e => !e.isAcknowledged).length} unacknowledged
        </div>
      </div>

      {/* Events */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {events.map((ev) => {
          const col = severityColors[ev.severity];
          const bg = severityBg[ev.severity];
          const isSelected = selectedEventId === ev.id;
          return (
            <div
              key={ev.id}
              onClick={() => onEventSelect(isSelected ? null : ev.id)}
              style={{
                padding: "9px 14px",
                borderLeft: `3px solid ${isSelected ? col : "transparent"}`,
                background: isSelected ? bg : "transparent",
                cursor: "pointer",
                transition: "background 0.15s",
                borderBottom: "1px solid rgba(255,255,255,0.03)",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {/* Severity dot */}
              <div style={{ flexShrink: 0, paddingTop: 4 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: col,
                  opacity: ev.isAcknowledged ? 0.4 : 1,
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Category + time */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <span style={{
                    fontSize: 9, fontFamily: "monospace", color: col,
                    opacity: ev.isAcknowledged ? 0.5 : 1,
                    textTransform: "uppercase", letterSpacing: "0.07em",
                  }}>
                    {ev.category}
                  </span>
                  <span style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>{relTime(ev.timestamp)}</span>
                </div>
                {/* Title */}
                <div style={{
                  fontSize: 12, color: ev.isAcknowledged ? "#64748b" : "#e2e8f0",
                  fontWeight: ev.isAcknowledged ? 400 : 600,
                  lineHeight: 1.35,
                }}>
                  {ev.title}
                </div>
                {/* Detail — only when selected */}
                {isSelected && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5, lineHeight: 1.55 }}>
                    {ev.detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Fleet Commander Explanation Panel ──────────────────────────────────────

interface FleetCommanderPanelProps {
  episode: DecisionEpisode;
  ownship: OwnshipState;
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "#4ade80" : value >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
      <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 11, color, fontFamily: "monospace", minWidth: 36 }}>{value}%</span>
    </div>
  );
}

function FleetCommanderPanel({ episode, ownship }: FleetCommanderPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Copilot header */}
      <div style={{
        padding: "10px 14px 9px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
        background: "rgba(56,189,248,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: "1.5px solid rgba(56,189,248,0.45)",
            flexShrink: 0, overflow: "hidden",
            boxShadow: "0 0 0 2px rgba(56,189,248,0.1)",
          }}>
            <img
              src="/__mockup/images/captain-avatar.png"
              alt="Fleet Commander"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#38bdf8", fontFamily: "monospace", letterSpacing: "0.07em", textTransform: "uppercase" }}>
              Fleet Commander
            </div>
            <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>
              Autonomy Explanation Layer · {fmtTime(episode.generatedAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>

        {/* SITUATION */}
        <Section label="Situation">
          <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", lineHeight: 1.65 }}>
            {episode.situation}
          </p>
        </Section>

        {/* REASON */}
        <Section label="Reason">
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.65 }}>
            {episode.reason}
          </p>
        </Section>

        {/* CONFIDENCE */}
        <Section label="Confidence">
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{episode.confidenceLabel}</div>
          <ConfidenceBar value={episode.confidence} />
        </Section>

        {/* EVIDENCE */}
        <Section label="Evidence">
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {episode.evidence.map((ev, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                padding: "5px 8px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 4, gap: 8,
              }}>
                <span style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", flexShrink: 0 }}>{ev.label}</span>
                <span style={{ fontSize: 10, color: "#cbd5e1", fontFamily: "monospace", textAlign: "right" }}>{ev.value}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* RECOMMENDATION */}
        <Section label="Recommendation">
          <p style={{ margin: 0, fontSize: 12, color: "#e2e8f0", lineHeight: 1.65, fontWeight: 500 }}>
            {episode.recommendation}
          </p>
        </Section>

        {/* EXPECTED NEXT */}
        <Section label="Expected Next Step">
          <div style={{
            padding: "7px 10px",
            background: "rgba(56,189,248,0.06)",
            borderLeft: "2px solid rgba(56,189,248,0.4)",
            borderRadius: "0 4px 4px 0",
          }}>
            <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
              {episode.expectedNextStep}
            </p>
          </div>
        </Section>

        {/* Telemetry quick row */}
        <div style={{
          marginTop: 14,
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 6,
        }}>
          {[
            { label: "Speed", value: `${ownship.speedKts} kts` },
            { label: "Heading", value: `${ownship.headingDeg}°T` },
            { label: "Fuel", value: `${ownship.fuelPct}%` },
            { label: "Battery", value: ownship.batteryPct ? `${ownship.batteryPct}%` : "—" },
          ].map((item) => (
            <div key={item.label} style={{
              padding: "5px 8px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 4,
              display: "flex", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>{item.label}</span>
              <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 9, color: "#475569", fontFamily: "monospace",
        textTransform: "uppercase", letterSpacing: "0.1em",
        marginBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Status Bar ────────────────────────────────────────────────────────────────

function StatusBar({ ownship, comms }: { ownship: OwnshipState; comms: CommsStatus }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 20,
      padding: "5px 16px",
      background: "rgba(0,0,0,0.35)",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      flexShrink: 0,
      fontFamily: "monospace",
    }}>
      <span style={{ fontSize: 10, color: "#64748b" }}>MODE</span>
      <span style={{ fontSize: 10, color: "#38bdf8", letterSpacing: "0.05em" }}>{ownship.modeLabel}</span>
      <span style={{ fontSize: 10, color: "#334155" }}>|</span>
      <span style={{ fontSize: 10, color: "#64748b" }}>PHASE</span>
      <span style={{ fontSize: 10, color: "#94a3b8" }}>{ownship.missionPhase}</span>
      <span style={{ fontSize: 10, color: "#334155" }}>|</span>
      <span style={{ fontSize: 10, color: "#64748b" }}>HDG</span>
      <span style={{ fontSize: 10, color: "#94a3b8" }}>{ownship.headingDeg}°T</span>
      <span style={{ fontSize: 10, color: "#64748b" }}>SPD</span>
      <span style={{ fontSize: 10, color: "#94a3b8" }}>{ownship.speedKts} kts</span>
      <div style={{ flex: 1 }} />
      {/* Comms indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: comms.degraded ? "#f59e0b" : "#4ade80",
        }} />
        <span style={{ fontSize: 9, color: comms.degraded ? "#f59e0b" : "#64748b" }}>
          {comms.linkLabel} {comms.degraded ? "DEGRADED" : "OK"}
        </span>
      </div>
      <span style={{ fontSize: 10, color: "#334155" }}>|</span>
      <span style={{ fontSize: 10, color: "#64748b" }}>{ownship.name}</span>
    </div>
  );
}

// ─── Top Header ───────────────────────────────────────────────────────────────

function TopHeader({ mission, events }: { mission: MissionObject; events: AlertEvent[] }) {
  const criticals = events.filter(e => e.severity === "critical" && !e.isAcknowledged).length;
  const warnings = events.filter(e => e.severity === "warning" && !e.isAcknowledged).length;
  return (
    <div style={{
      display: "flex", alignItems: "center", padding: "0 16px",
      height: 48, borderBottom: "1px solid rgba(255,255,255,0.07)",
      background: "#080f1c", flexShrink: 0, gap: 20,
    }}>
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 4,
          background: "linear-gradient(135deg, #0ea5e9, #1d4ed8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
        }}>⚓</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.03em", fontFamily: "monospace" }}>FLEETCOMMAND</div>
          <div style={{ fontSize: 9, color: "#334155", fontFamily: "monospace", letterSpacing: "0.08em" }}>AUTONOMY OPERATIONS</div>
        </div>
      </div>

      <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)" }} />

      {/* Mission name */}
      <div>
        <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", textTransform: "uppercase" }}>Mission</div>
        <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{mission.missionName}</div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Alert counts */}
      {criticals > 0 && (
        <div style={{
          padding: "3px 10px", borderRadius: 3, background: "rgba(239,68,68,0.15)",
          border: "1px solid rgba(239,68,68,0.35)", fontSize: 10, color: "#ef4444",
          fontFamily: "monospace", fontWeight: 600,
        }}>
          {criticals} CRITICAL
        </div>
      )}
      {warnings > 0 && (
        <div style={{
          padding: "3px 10px", borderRadius: 3, background: "rgba(245,158,11,0.12)",
          border: "1px solid rgba(245,158,11,0.3)", fontSize: 10, color: "#f59e0b",
          fontFamily: "monospace",
        }}>
          {warnings} WARNING
        </div>
      )}

      <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>{fmtTime(now)}</div>
    </div>
  );
}

// ─── Main Console ─────────────────────────────────────────────────────────────

export function FleetCommand() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>("ev1");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // When an event with a related contact is selected, highlight that contact on map
  const handleEventSelect = (id: string | null) => {
    setSelectedEventId(id);
    if (id) {
      const ev = mockEvents.find(e => e.id === id);
      setSelectedContactId(ev?.relatedContactId ?? null);
    } else {
      setSelectedContactId(null);
    }
  };

  const handleContactSelect = (id: string | null) => {
    setSelectedContactId(id);
    // Clear event selection when clicking a contact directly
    if (id !== selectedContactId) setSelectedEventId(null);
  };

  // Resolve active decision episode
  const episode = selectedEventId
    ? (decisionsByEvent[selectedEventId] ?? decisionsByEvent.default)
    : decisionsByEvent.default;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      width: "100%", height: "100vh",
      background: "#0d1526",
      color: "#e2e8f0",
      fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
      overflow: "hidden",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      <TopHeader mission={mockMission} events={mockEvents} />

      {/* Main three-panel layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 260px 280px", overflow: "hidden" }}>

        {/* ── Panel 1: Mission Map ── */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "8px 14px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mission Map</div>
          </div>
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <MissionMap
              ownship={mockOwnship}
              mission={mockMission}
              contacts={mockContacts}
              comms={mockComms}
              selectedContactId={selectedContactId}
              onContactSelect={handleContactSelect}
            />
          </div>

          {/* Contact list below map */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", maxHeight: 150, overflowY: "auto" }}>
            <div style={{ padding: "6px 14px 4px", fontSize: 9, color: "#475569", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Contacts
            </div>
            {mockContacts.map(c => {
              const isSelected = selectedContactId === c.id;
              const col = riskColors[c.riskLevel];
              return (
                <div
                  key={c.id}
                  onClick={() => handleContactSelect(isSelected ? null : c.id)}
                  style={{
                    padding: "5px 14px",
                    display: "flex", alignItems: "center", gap: 10,
                    cursor: "pointer",
                    background: isSelected ? `rgba(${c.riskLevel === "critical" ? "239,68,68" : c.riskLevel === "elevated" ? "245,158,11" : "74,222,128"},0.06)` : "transparent",
                    borderLeft: `2px solid ${isSelected ? col : "transparent"}`,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: col, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: col, fontFamily: "monospace", minWidth: 44 }}>{c.label}</span>
                  <span style={{ fontSize: 10, color: "#64748b", flex: 1 }}>{c.classification}</span>
                  <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>CPA {c.closestPointOfApproachNm.toFixed(2)} nm</span>
                  <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{c.timeToClosestApproachMin}m</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Panel 2: Event Timeline ── */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <EventTimeline
            events={mockEvents}
            selectedEventId={selectedEventId}
            onEventSelect={handleEventSelect}
          />
        </div>

        {/* ── Panel 3: Fleet Commander ── */}
        <div style={{ overflow: "hidden" }}>
          <FleetCommanderPanel episode={episode} ownship={mockOwnship} />
        </div>
      </div>

      <StatusBar ownship={mockOwnship} comms={mockComms} />
    </div>
  );
}
