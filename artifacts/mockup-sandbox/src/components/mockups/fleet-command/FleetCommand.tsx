// ============================================================================
// FLEETCOMMAND MOCKUP - Presentation Layer Prototype
// ============================================================================
// This file is the main FleetCommand UI mockup, implementing the three core
// panels required by the PRD:
// 1. Mission Map - ownship, planned/actual track, contacts, hazards
// 2. Event Timeline - chronological alert feed with severity color-coding
// 3. Fleet Commander - autonomy explanation panel (Situation/Reason/Confidence/Recommendation)
//
// CURRENT STATE:
// This is a self-contained mockup with inline mock data and local types.
// It represents the Presentation Layer from Docs/arch.md.
//
// FUTURE EVOLUTION (when real maritime data arrives):
// 1. Extract type definitions to a shared package (lib/types or similar)
// 2. Replace inline mock data with props/context from Adaptive Layer
// 3. Connect Fleet Commander explanations to the Explanation Layer
// 4. Add data streaming/update logic via ingestion layer
// 5. Keep UI contract stable - component props should remain the same
//
// DATA FLOW (future):
// Raw maritime data -> Ingestion Layer -> Adaptive Normalization ->
// Explanation Synthesizer -> THIS COMPONENT (Presentation Layer)
//
// WHY TYPES ARE DEFINED HERE:
// During mockup/prototyping phase, types live with the UI for faster iteration.
// These will be extracted to a shared package once the architecture stabilizes.
// ============================================================================

import { useState, useRef, useEffect } from "react";

console.log("[FleetCommand] Module imported");

// ─── Normalized Data Model (UI Contract) ────────────────────────────────────
// These interfaces define the stable contract between the Presentation Layer
// and the upstream Adaptive/Explanation layers.
//
// IMPORTANT: These types should eventually move to a shared package (e.g. lib/types)
// so they can be used by both the backend (normalization/explanation) and frontend
// (presentation).
//
// The UI should ONLY consume these normalized types, never raw source schemas.
// This insulation allows the underlying data sources to change without breaking
// the UI - only the Adaptive Layer adapters need to be updated.
// ============================================================================

// Geographic coordinate (latitude/longitude in decimal degrees)
export interface LatLon {
  lat: number;  // Latitude: -90 to +90
  lon: number;  // Longitude: -180 to +180
}

// Ownship (your vessel) state - the primary vessel being monitored
// This represents the autonomous vessel's current status
export interface OwnshipState {
  id: string;                // Unique vessel identifier
  name: string;              // Vessel call sign or name
  position: LatLon;          // Current GPS position
  headingDeg: number;        // True heading, 0–360° (0=north, 90=east)
  speedKts: number;          // Speed over ground in knots
  depthM: number | null;     // Depth in meters (null for surface vessels)
  modeLabel: string;         // Human-readable autonomy mode (e.g. "AUTONOMOUS – SEARCH PATTERN")
  missionPhase: string;      // Current mission phase (e.g. "Search Leg 3 of 7")
  fuelPct: number;           // Fuel remaining, 0–100%
  batteryPct: number | null; // Battery remaining, 0–100% (null if not applicable)
  updatedAt: Date;           // Timestamp of last telemetry update
}

// Contact types - external objects detected by sensors or AIS
export type ContactType = "surface" | "subsurface" | "air" | "unknown";

// Risk levels - standardized threat/collision risk assessment
export type RiskLevel = "critical" | "elevated" | "nominal" | "none";

// Contact - any detected object near the vessel (ships, obstacles, unknowns)
// Includes collision risk metrics (CPA/TCPA)
export interface Contact {
  id: string;                         // Unique contact identifier
  label: string;                      // Short label for operator (e.g. "TGT-01")
  type: ContactType;                  // Contact classification
  position: LatLon;                   // Current position
  headingDeg: number;                 // True heading, 0–360°
  speedKts: number;                   // Speed over ground
  riskLevel: RiskLevel;               // Overall collision/encounter risk
  closestPointOfApproachNm: number;   // CPA - closest predicted distance in nautical miles
  timeToClosestApproachMin: number;   // TCPA - time until CPA in minutes
  classification: string;             // Detailed classification (e.g. "Fast Mover – Possible Intercept")
  updatedAt: Date;                    // Timestamp of last update
}

// Waypoint status - progress through planned route
export type WaypointStatus = "completed" | "active" | "upcoming";

// Waypoint - a single point in the planned mission route
export interface Waypoint {
  id: string;           // Unique waypoint identifier
  sequence: number;     // Order in route (1, 2, 3, ...)
  position: LatLon;     // Geographic position
  label: string;        // Operator label (e.g. "WP-2")
  status: WaypointStatus; // Progress status
}

// MissionObject - complete mission definition and progress
// Contains planned route, actual track, search areas, hazards, and waypoints
export interface MissionObject {
  id: string;                // Unique mission identifier
  missionName: string;       // Mission call sign or name
  missionType: string;       // Mission category (e.g. "Search and Survey")
  plannedRoute: LatLon[];    // Ordered list of positions defining intended track
  actualTrack: LatLon[];     // Recorded actual positions (breadcrumb trail)
  waypoints: Waypoint[];     // Waypoints along route
  searchPolygon: LatLon[] | null; // Search area boundary (null if not a search mission)
  hazardZones: { id: string; label: string; polygon: LatLon[]; severity: RiskLevel }[]; // Restricted areas
  startedAt: Date;           // Mission start time
  estimatedEndAt: Date;      // Estimated completion time
}

// Alert severity levels
export type AlertSeverity = "critical" | "warning" | "info" | "nominal";

// AlertEvent - a timestamped event in the timeline
// Represents autonomy decisions, warnings, state changes, and operator notifications
export interface AlertEvent {
  id: string;                 // Unique event identifier
  timestamp: Date;            // When this event occurred
  severity: AlertSeverity;    // Severity/urgency level
  category: string;           // Event category (e.g. "Contact Risk", "Route Deviation", "Comms")
  title: string;              // Short operator-facing summary
  detail: string;             // One-sentence elaboration
  relatedContactId?: string;  // Optional: link to a Contact if this event concerns one
  relatedWaypointId?: string; // Optional: link to a Waypoint if relevant
  isAcknowledged: boolean;    // Whether operator has acknowledged this event
}

// EvidencePoint - a single piece of supporting evidence for a decision
// Used in DecisionEpisode to show observable facts backing the explanation
export interface EvidencePoint {
  label: string;  // Short label (e.g. "TGT-01 CPA")
  value: string;  // Value or observation (e.g. "0.18 nm — below 0.5 nm threshold")
}

// DecisionEpisode - Fleet Commander explanation for a specific situation
// Implements the Situation/Reason/Confidence/Recommendation format from PRD
// This is the output of the Explanation Layer, consumed by the Fleet Commander panel
export interface DecisionEpisode {
  id: string;                 // Unique episode identifier
  triggerEventId: string | null; // Event that triggered this explanation (null for default/ambient)
  situation: string;          // What is happening right now (current state)
  reason: string;             // Why the vessel is behaving this way
  confidence: number;         // Confidence level, 0–100
  confidenceLabel: string;    // Human-readable confidence ("High", "Moderate", "Low")
  recommendation: string;     // What the operator should do or consider
  expectedNextStep: string;   // What the autonomy will likely do next
  evidence: EvidencePoint[];  // Supporting facts/observations
  generatedAt: Date;          // When this explanation was generated
}

// CommsStatus - communication link health
// Tracks staleness and degradation of telemetry links
export interface CommsStatus {
  linkLabel: string;     // Link name (e.g. "RF Primary", "Acoustic Backup")
  isStale: boolean;      // True if no recent contact
  lastContactAt: Date;   // Timestamp of last successful contact
  staleSec: number;      // Seconds since last contact
  degraded: boolean;     // True if link is operational but degraded
}

// ─── Mock Data ───────────────────────────────────────────────────────────────
// TEMPORARY: This mock data is hardcoded for demo/development purposes.
//
// WHEN REAL DATA ARRIVES:
// - Replace these exports with props/context provided by parent components
// - Parent should receive data from Adaptive Layer (normalized from raw feeds)
// - This component should become purely presentational (no data ownership)
//
// MOCK DATA INCLUDES:
// - mockOwnship: Single vessel (UVS-241 SIREN) in autonomous search mode
// - mockContacts: Three nearby surface contacts with varying risk levels
// - mockMission: Search mission with planned route, waypoints, and hazard zones
// - mockEvents: Timeline of recent alerts and state changes
// - mockComms: Communication link status (currently showing degraded RF)
// - decisionsByEvent: Pre-written Fleet Commander explanations per event
// ============================================================================

const now = new Date();
console.log("[FleetCommand] Mock data timestamp (now):", now.toISOString());

// Helper: Create a Date object N minutes in the past
const mins = (n: number) => new Date(now.getTime() - n * 60_000);

// MOCK: Ownship state - represents UVS-241 SIREN in autonomous search mode
// Currently mid-mission, executing leg 3 of a search pattern
export const mockOwnship: OwnshipState = {
  id: "ownship-1",
  name: "UVS-241 SIREN",
  position: { lat: 36.84, lon: -75.96 }, // Off Virginia coast
  headingDeg: 47,                         // Northeast heading
  speedKts: 4.2,                          // Slow search speed
  depthM: null,                           // Surface vessel
  modeLabel: "AUTONOMOUS – SEARCH PATTERN",
  missionPhase: "Search Leg 3 of 7",
  fuelPct: 61,
  batteryPct: 74,
  updatedAt: mins(1), // Telemetry is 1 minute old
};
console.log("[FleetCommand] Mock ownship loaded:", mockOwnship.name, "at", mockOwnship.position);

// MOCK: Contacts - three nearby surface contacts with varying risk profiles
// c1: Critical risk - fast closing contact, potential collision geometry
// c2: Elevated risk - fishing vessel on converging course
// c3: Nominal risk - stationary unknown contact, well separated
export const mockContacts: Contact[] = [
  {
    id: "c1",
    label: "TGT-01",
    type: "surface",
    position: { lat: 36.87, lon: -75.91 }, // Northeast of ownship
    headingDeg: 220,                        // Southwest heading (toward ownship)
    speedKts: 12.4,                         // Fast - likely patrol or intercept
    riskLevel: "critical",                  // CRITICAL - CPA breach imminent
    closestPointOfApproachNm: 0.18,         // Will pass within 0.18 nm (very close)
    timeToClosestApproachMin: 6,            // Only 6 minutes until CPA
    classification: "Fast Mover – Possible Intercept",
    updatedAt: mins(2),
  },
  {
    id: "c2",
    label: "TGT-02",
    type: "surface",
    position: { lat: 36.80, lon: -75.89 }, // Southeast of ownship
    headingDeg: 10,                         // North heading
    speedKts: 5.1,                          // Moderate speed
    riskLevel: "elevated",                  // ELEVATED - monitoring required
    closestPointOfApproachNm: 0.65,         // Will pass at 0.65 nm
    timeToClosestApproachMin: 22,           // 22 minutes until CPA
    classification: "Fishing Vessel",
    updatedAt: mins(4),
  },
  {
    id: "c3",
    label: "TGT-03",
    type: "unknown",
    position: { lat: 36.82, lon: -76.01 }, // West of ownship
    headingDeg: 90,                         // East heading
    speedKts: 0.3,                          // Stationary or very slow
    riskLevel: "nominal",                   // NOMINAL - no immediate threat
    closestPointOfApproachNm: 1.8,          // Will pass at 1.8 nm (safe distance)
    timeToClosestApproachMin: 85,           // 85 minutes until CPA
    classification: "Stationary / Unknown",
    updatedAt: mins(9),
  },
];
console.log("[FleetCommand] Mock contacts loaded:", mockContacts.length, "contacts");
console.log("[FleetCommand] Contact risk breakdown:", {
  critical: mockContacts.filter(c => c.riskLevel === "critical").length,
  elevated: mockContacts.filter(c => c.riskLevel === "elevated").length,
  nominal: mockContacts.filter(c => c.riskLevel === "nominal").length,
});

// MOCK: Mission definition - Op CLEAN SLATE search mission
// This defines the planned route, actual track, waypoints, search area, and hazards
// Route: 8-waypoint search pattern covering Sector 4
// Current progress: Approaching WP-2, starting leg 3
export const mockMission: MissionObject = {
  id: "msn-24",
  missionName: "Op CLEAN SLATE – Sector 4",
  missionType: "Search and Survey",
  
  // Planned route: 8 waypoints forming a search box pattern
  plannedRoute: [
    { lat: 36.80, lon: -76.02 }, // WP-1 START (southwest corner)
    { lat: 36.84, lon: -75.96 }, // WP-2 (moving northeast)
    { lat: 36.87, lon: -75.93 }, // WP-3 (continuing northeast)
    { lat: 36.89, lon: -75.88 }, // WP-4 (northeast corner)
    { lat: 36.86, lon: -75.83 }, // WP-5 (moving south)
    { lat: 36.82, lon: -75.83 }, // WP-6 (continuing south)
    { lat: 36.79, lon: -75.88 }, // WP-7 (southwest turn)
    { lat: 36.80, lon: -76.02 }, // WP-8 END (back to start)
  ],
  
  // Actual track: breadcrumb trail of recorded positions
  // Currently 4 points recorded, approaching WP-2
  actualTrack: [
    { lat: 36.80, lon: -76.02 }, // Started at WP-1
    { lat: 36.81, lon: -75.99 }, // Tracking northeast
    { lat: 36.83, lon: -75.97 }, // Minor drift detected
    { lat: 36.84, lon: -75.96 }, // Current position (near WP-2)
  ],
  
  // Waypoints: detailed status for each route point
  waypoints: [
    { id: "wp1", sequence: 1, position: { lat: 36.80, lon: -76.02 }, label: "WP-1 START", status: "completed" },
    { id: "wp2", sequence: 2, position: { lat: 36.84, lon: -75.96 }, label: "WP-2", status: "active" },      // ACTIVE
    { id: "wp3", sequence: 3, position: { lat: 36.87, lon: -75.93 }, label: "WP-3", status: "upcoming" },
    { id: "wp4", sequence: 4, position: { lat: 36.89, lon: -75.88 }, label: "WP-4", status: "upcoming" },
    { id: "wp5", sequence: 5, position: { lat: 36.86, lon: -75.83 }, label: "WP-5", status: "upcoming" },
    { id: "wp6", sequence: 6, position: { lat: 36.82, lon: -75.83 }, label: "WP-6", status: "upcoming" },
    { id: "wp7", sequence: 7, position: { lat: 36.79, lon: -75.88 }, label: "WP-7", status: "upcoming" },
    { id: "wp8", sequence: 8, position: { lat: 36.80, lon: -76.02 }, label: "WP-8 END", status: "upcoming" },
  ],
  
  // Search polygon: rectangular search area boundary
  // Covers approximately 0.23° lat x 0.23° lon (~14 nm x 14 nm)
  searchPolygon: [
    { lat: 36.79, lon: -76.04 }, // Southwest corner
    { lat: 36.90, lon: -76.04 }, // Northwest corner
    { lat: 36.90, lon: -75.81 }, // Northeast corner
    { lat: 36.79, lon: -75.81 }, // Southeast corner
  ],
  
  // Hazard zones: restricted areas within the mission area
  // hz1: Underwater cable restriction zone
  hazardZones: [
    {
      id: "hz1",
      label: "Restricted — Cabling",
      severity: "warning", // Warning severity (not critical but must avoid)
      polygon: [
        { lat: 36.85, lon: -75.99 },
        { lat: 36.86, lon: -75.96 },
        { lat: 36.84, lon: -75.95 },
        { lat: 36.83, lon: -75.98 },
      ],
    },
  ],
  
  startedAt: new Date(now.getTime() - 3 * 60 * 60_000),  // Started 3 hours ago
  estimatedEndAt: new Date(now.getTime() + 5 * 60 * 60_000), // 5 hours remaining
};
console.log("[FleetCommand] Mock mission loaded:", mockMission.missionName);
console.log("[FleetCommand] Mission progress:", mockMission.actualTrack.length, "track points,", 
  mockMission.waypoints.filter(w => w.status === "completed").length, "of", 
  mockMission.waypoints.length, "waypoints completed");

// MOCK: Event timeline - chronological alert feed
// Events are sorted newest-first in the UI (most recent at top)
// Each event has severity, category, related objects (contacts/waypoints), and acknowledgment status
//
// EVENT CATEGORIES:
// - Contact Risk: Collision/encounter alerts involving nearby contacts
// - Route: Navigation and track-following events
// - Comms: Communication link status changes
// - Mission: Waypoint/phase transitions and mission geometry events
// - System: Telemetry and sensor health notifications
export const mockEvents: AlertEvent[] = [
  {
    id: "ev1",
    timestamp: mins(2),  // 2 minutes ago - MOST RECENT
    severity: "critical",
    category: "Contact Risk",
    title: "CPA breach — TGT-01 closing fast",
    detail: "TGT-01 on intercept bearing 220°T, CPA 0.18 nm in ~6 min. Rule-of-road precedence unclear.",
    relatedContactId: "c1", // Links to contact c1 (TGT-01)
    isAcknowledged: false,  // NOT ACK - requires operator attention
  },
  {
    id: "ev2",
    timestamp: mins(5),  // 5 minutes ago
    severity: "warning",
    category: "Route",
    title: "Minor deviation — currents pushing port",
    detail: "Ownship tracking 3° left of planned track. Correction maneuver initiated.",
    isAcknowledged: false, // NOT ACK
  },
  {
    id: "ev3",
    timestamp: mins(9),  // 9 minutes ago
    severity: "warning",
    category: "Comms",
    title: "RF link degraded — 9 min since last ping",
    detail: "Last RF contact at 14:47Z. Acoustic backup active. No data loss yet.",
    isAcknowledged: true, // ACK - operator aware
  },
  {
    id: "ev4",
    timestamp: mins(14), // 14 minutes ago
    severity: "info",
    category: "Mission",
    title: "WP-2 approach — entering leg 3",
    detail: "Ownship within 0.3 nm of WP-2. Transitioning to Search Leg 3.",
    relatedWaypointId: "wp2", // Links to waypoint wp2
    isAcknowledged: true,
  },
  {
    id: "ev5",
    timestamp: mins(21), // 21 minutes ago
    severity: "info",
    category: "Contact",
    title: "New contact — TGT-03 detected",
    detail: "Stationary surface contact bearing 265°T at 1.8 nm. Classification: Unknown.",
    relatedContactId: "c3", // Links to contact c3 (TGT-03)
    isAcknowledged: true,
  },
  {
    id: "ev6",
    timestamp: mins(38), // 38 minutes ago
    severity: "info",
    category: "Mission",
    title: "Hazard zone proximity — restricted cabling area",
    detail: "Ownship within 0.5 nm of cabling restriction zone. Auto-deconfliction active.",
    isAcknowledged: true,
  },
  {
    id: "ev7",
    timestamp: mins(47), // 47 minutes ago - OLDEST
    severity: "nominal",
    category: "System",
    title: "Telemetry nominal — all sensors green",
    detail: "Sonar, INS, and GPS within spec. System health 98%.",
    isAcknowledged: true,
  },
];
console.log("[FleetCommand] Mock events loaded:", mockEvents.length, "events");
console.log("[FleetCommand] Unacknowledged events:", mockEvents.filter(e => !e.isAcknowledged).length);

// MOCK: Comms status - communication link health
// Currently showing degraded RF link (9 minutes since last contact)
// In a real system, this would update continuously based on actual link telemetry
export const mockComms: CommsStatus = {
  linkLabel: "RF Primary",        // Primary radio frequency link
  isStale: true,                  // Link is stale (no recent contact)
  lastContactAt: mins(9),         // Last successful contact was 9 minutes ago
  staleSec: 9 * 60,               // 540 seconds since last contact
  degraded: true,                 // Link is degraded but not completely down
};
console.log("[FleetCommand] Mock comms status loaded:", mockComms.linkLabel, 
  "- stale:", mockComms.isStale, "- degraded:", mockComms.degraded);

// MOCK: Decision episodes - Fleet Commander explanations
// Maps event IDs to pre-written explanation episodes
// "default" episode is shown when no specific event is selected
//
// EXPLANATION FORMAT (per PRD):
// - Situation: What is happening right now
// - Reason: Why the vessel is doing this
// - Confidence: How certain the system is (0-100%)
// - Recommendation: What the operator should do
// - Expected Next Step: What the autonomy will likely do next
// - Evidence: Observable facts supporting the explanation
//
// IN REAL SYSTEM:
// These would be dynamically generated by the Explanation Layer, not hardcoded.
// The Explanation Layer synthesizes normalized signals into operator-ready text.
const decisionsByEvent: Record<string, DecisionEpisode> = {
  // DEFAULT EPISODE: Shown when no event is selected, or selected event has no custom explanation
  // Represents the "ambient" operational state
  default: {
    id: "de0",
    triggerEventId: null, // Not triggered by a specific event
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
  // EPISODE ev1: Critical collision risk with TGT-01
  // Triggered by the CPA breach alert (most urgent current situation)
  // Focuses on COLREGS compliance and collision avoidance logic
  ev1: {
    id: "de1",
    triggerEventId: "ev1", // Triggered by "CPA breach — TGT-01 closing fast" alert
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
  // EPISODE ev2: Route deviation due to currents
  // Triggered by minor track deviation alert
  // Focuses on environmental effects and track-keeping behavior
  ev2: {
    id: "de2",
    triggerEventId: "ev2", // Triggered by "Minor deviation — currents pushing port" alert
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
  
  // EPISODE ev3: Comms degradation (RF link down, acoustic backup active)
  // Triggered by comms warning alert
  // Focuses on link status and fallback capability
  ev3: {
    id: "de3",
    triggerEventId: "ev3", // Triggered by "RF link degraded" alert
    situation:
      "RF primary link has been silent for 9 minutes. Acoustic fallback is operating nominally. No command messages are queued. Vessel is operating autonomously within mission parameters.",
    reason:
      "RF degradation is consistent with known ducting conditions at this range and sea state. Acoustic link provides 1,200-baud command capability, which is sufficient for emergency override.",
    confidence: 71,
    confidenceLabel: "Moderate", // Lower confidence due to comms uncertainty
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
console.log("[FleetCommand] Decision episodes loaded:", Object.keys(decisionsByEvent).length, "episodes");

// ─── Utility Helpers ──────────────────────────────────────────────────────────

// Format a Date as UTC time string (HH:MMZ)
// Example: "14:32Z"
function fmtTime(d: Date): string {
  return d.toISOString().substring(11, 16) + "Z";
}

// Format a Date as relative time from now
// Example: "2m ago", "47s ago", "1h ago"
function relTime(d: Date): string {
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

// ─── Color/Severity Maps ─────────────────────────────────────────────────────
// Visual design system for severity and risk indicators
// Maps semantic levels to specific colors for consistent UI presentation

// Alert severity colors (foreground)
const severityColors: Record<AlertSeverity, string> = {
  critical: "#ef4444", // Red - immediate attention required
  warning: "#f59e0b",  // Amber - monitoring required
  info: "#38bdf8",     // Blue - informational
  nominal: "#4ade80",  // Green - all nominal
};

// Alert severity backgrounds (subtle fill for selected/hover states)
const severityBg: Record<AlertSeverity, string> = {
  critical: "rgba(239,68,68,0.08)",
  warning: "rgba(245,158,11,0.08)",
  info: "rgba(56,189,248,0.06)",
  nominal: "rgba(74,222,128,0.06)",
};

// Contact risk level colors
const riskColors: Record<RiskLevel, string> = {
  critical: "#ef4444", // Red - collision risk
  elevated: "#f59e0b", // Amber - heightened awareness
  nominal: "#4ade80",  // Green - normal separation
  none: "#6b7280",     // Gray - no risk
};
console.log("[FleetCommand] Color maps initialized");

// ─── 2D Mission Map Component ─────────────────────────────────────────────────

// Map bounds - geographic area covered by this mockup
// Covers approximately 0.135° lat x 0.28° lon (~8nm x 16nm)
// Centered roughly on the mock mission area off Virginia coast
const MAP_BOUNDS = {
  minLat: 36.775, maxLat: 36.91,  // Latitude range
  minLon: -76.06, maxLon: -75.78,  // Longitude range
};
console.log("[FleetCommand] Map bounds:", MAP_BOUNDS);

// ============================================================================
// GEOGRAPHIC PROJECTION UTILITIES
// ============================================================================
// These functions convert lat/lon coordinates to SVG pixel coordinates.
// Uses a simple linear projection (suitable for small areas where curvature is negligible).
//
// PROJECTION LOGIC:
// - X axis: longitude maps linearly from minLon to maxLon
// - Y axis: latitude maps linearly from maxLat (top) to minLat (bottom)
// - Padding inset prevents elements from touching SVG edges
//
// LIMITATIONS:
// This is NOT a proper map projection (no Mercator, UTM, etc.).
// It assumes the area is small enough that linear interpolation is acceptable.
// For larger areas or high-precision navigation, use a proper projection library.
// ============================================================================

// Project a single lat/lon position to SVG [x, y] coordinates
// Returns tuple [x, y] where (0,0) is top-left of SVG
function projectToSvg(
  pos: LatLon,
  svgW: number,      // SVG width in pixels
  svgH: number,      // SVG height in pixels
  pad = 20           // Padding inset from edges
): [number, number] {
  const { minLat, maxLat, minLon, maxLon } = MAP_BOUNDS;
  
  // X: interpolate longitude from left (minLon) to right (maxLon)
  const x = pad + ((pos.lon - minLon) / (maxLon - minLon)) * (svgW - 2 * pad);
  
  // Y: interpolate latitude from top (maxLat) to bottom (minLat)
  // Note: Y is inverted because SVG Y increases downward
  const y = pad + ((maxLat - pos.lat) / (maxLat - minLat)) * (svgH - 2 * pad);
  
  return [x, y];
}

// Convert an array of lat/lon positions to SVG polygon points string
// Output format: "x1,y1 x2,y2 x3,y3 ..."
// Used for <polygon> elements (search areas, hazard zones)
function toPolyPoints(pts: LatLon[], W: number, H: number): string {
  return pts.map((p) => projectToSvg(p, W, H).join(",")).join(" ");
}

// Convert an array of lat/lon positions to SVG path d attribute
// Output format: "M x1 y1 L x2 y2 L x3 y3 ..."
// Used for <path> elements (routes, tracks)
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

// ============================================================================
// MISSION MAP COMPONENT
// ============================================================================
// Renders the 2D mission map with:
// - Search polygon (dashed blue outline)
// - Hazard zones (dashed amber outline)
// - Planned route (dashed cyan line)
// - Actual track (solid cyan line - breadcrumb trail)
// - Waypoints (circles with status-based colors)
// - Contacts (triangles with heading vectors and risk-based colors)
// - Ownship (blue ship icon with heading arrow and range ring)
// - Comms degraded banner (top overlay if comms are stale)
//
// INTERACTION:
// - Click contacts to select/deselect them
// - Selected contact highlights on map and in contact list below
//
// VISUAL HIERARCHY:
// - Background: dark blue (#0b1220)
// - Grid: subtle white lines for spatial reference
// - Active elements: bright colors (cyan for ownship, risk colors for contacts)
// - Completed waypoints: green, Active: cyan, Upcoming: gray
// ============================================================================

interface MissionMapProps {
  ownship: OwnshipState;
  mission: MissionObject;
  contacts: Contact[];
  comms: CommsStatus;
  selectedContactId: string | null;
  onContactSelect: (id: string | null) => void;
}

function MissionMap({ ownship, mission, contacts, comms, selectedContactId, onContactSelect }: MissionMapProps) {
  console.log("[MissionMap] Rendering with:", {
    ownshipPos: ownship.position,
    contactCount: contacts.length,
    waypointCount: mission.waypoints.length,
    selectedContactId,
    commsStale: comms.isStale,
  });
  
  // SVG dimensions
  const W = 480, H = 400;
  
  // Project ownship position to SVG coordinates
  const [ox, oy] = projectToSvg(ownship.position, W, H);
  console.log("[MissionMap] Ownship projected to SVG:", { ox, oy });

  // Calculate ownship heading arrow endpoint
  // Heading is in degrees (0=north), but SVG uses radians with 0=east
  // So we subtract 90° before converting to radians
  const headRad = ((ownship.headingDeg - 90) * Math.PI) / 180;
  const arrowLen = 22; // Length of heading indicator line
  const ax = ox + Math.cos(headRad) * arrowLen;
  const ay = oy + Math.sin(headRad) * arrowLen;
  console.log("[MissionMap] Ownship heading:", ownship.headingDeg, "deg -> arrow end:", { ax, ay });

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
// ============================================================================
// EVENT TIMELINE - Chronological Alert Feed
// ============================================================================
// Displays recent alerts and autonomy events in reverse chronological order
// (newest at top, oldest at bottom).
//
// FEATURES:
// - Color-coded severity dots and borders
// - Unacknowledged event counter in header
// - Click to select event (expands detail, updates Fleet Commander panel)
// - Selected event shows full detail text and highlights related contacts/waypoints
// - Visual indication of acknowledged vs unacknowledged events
//
// INTERACTION:
// - Click event to select/deselect
// - Selected event triggers DecisionEpisode update in Fleet Commander panel
// - If event has relatedContactId, that contact highlights on map
//
// VISUAL DESIGN:
// - Dark background with subtle borders
// - Severity dot on left (pulsing for unacknowledged)
// - Category badge and relative timestamp on top row
// - Title in bold for unacknowledged, normal weight for acknowledged
// - Detail text only shown when event is selected
// ============================================================================

interface EventTimelineProps {
  events: AlertEvent[];
  selectedEventId: string | null;
  onEventSelect: (id: string | null) => void;
}

function EventTimeline({ events, selectedEventId, onEventSelect }: EventTimelineProps) {
  console.log("[EventTimeline] Rendering with", events.length, "events");
  console.log("[EventTimeline] Selected event ID:", selectedEventId);
  console.log("[EventTimeline] Unacknowledged count:", events.filter(e => !e.isAcknowledged).length);
  
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
// ============================================================================
// FLEET COMMANDER PANEL - AI Autonomy Explanation Copilot
// ============================================================================
// This is the main explanation interface (the "AI Captain") that helps operators
// understand what the autonomy is doing and why.
//
// EXPLANATION FORMAT (per PRD):
// - SITUATION: What is happening right now
// - REASON: Why the vessel is behaving this way
// - CONFIDENCE: System certainty (0-100%) with color-coded bar
// - EVIDENCE: Observable facts supporting the explanation
// - RECOMMENDATION: What the operator should do
// - EXPECTED NEXT STEP: What the autonomy will likely do next
//
// DATA SOURCE:
// Receives a DecisionEpisode prop (from decisionsByEvent lookup)
// The episode changes based on which event is selected in the timeline
//
// FUTURE INTEGRATION:
// In a real system, this panel would query the Explanation Layer API
// to get dynamically generated explanations based on current state.
// The format (Situation/Reason/Confidence/Recommendation) would remain the same.
//
// VISUAL DESIGN:
// - Captain avatar at top (currently placeholder image)
// - Calm, professional, mission-ready aesthetic
// - Monospace fonts for operational feel
// - Cyan accent color for autonomy theme
// - Bottom section shows quick telemetry (speed, heading, fuel, battery)
// ============================================================================

interface FleetCommanderPanelProps {
  episode: DecisionEpisode;  // Current explanation episode to display
  ownship: OwnshipState;     // Ownship state for telemetry display
}

// Confidence bar visualization (green for high, amber for medium, red for low)
function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "#4ade80" : value >= 60 ? "#f59e0b" : "#ef4444";
  console.log("[ConfidenceBar] Rendering with value:", value, "color:", color);
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
  console.log("[FleetCommanderPanel] Rendering episode:", episode.id);
  console.log("[FleetCommanderPanel] Episode details:", {
    triggerEventId: episode.triggerEventId,
    confidence: episode.confidence,
    confidenceLabel: episode.confidenceLabel,
    evidenceCount: episode.evidence.length,
  });
  
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

// ============================================================================
// SECTION HELPER - Labeled Content Section
// ============================================================================
// Reusable component for creating labeled sections in the Fleet Commander panel
// Shows uppercase monospace label above content with consistent spacing
// ============================================================================
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
// ============================================================================
// STATUS BAR - Bottom Telemetry Strip
// ============================================================================
// Shows real-time vessel telemetry and comms status in a compact horizontal bar
// Displayed at the bottom of the console for constant awareness
//
// DISPLAYS:
// - Autonomy mode label (e.g. "AUTONOMOUS – SEARCH PATTERN")
// - Mission phase (e.g. "Search Leg 3 of 7")
// - Current heading (degrees true)
// - Current speed (knots)
// - Comms status indicator (green=OK, amber=degraded)
// - Vessel name/call sign
//
// VISUAL DESIGN:
// - Dark semi-transparent background
// - Monospace font for operational aesthetic
// - Pipe separators between sections
// - Comms indicator pulses when degraded
// ============================================================================

function StatusBar({ ownship, comms }: { ownship: OwnshipState; comms: CommsStatus }) {
  console.log("[StatusBar] Rendering with ownship:", ownship.name, "comms:", comms.linkLabel);
  
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
// ============================================================================
// TOP HEADER - Mission Context and Alert Summary
// ============================================================================
// Shows mission name, alert counts, and branding
// Fixed at top of console for constant mission awareness
//
// DISPLAYS:
// - FleetCommand branding (anchor icon + name)
// - Mission name (from MissionObject)
// - Unacknowledged critical alert count (red badge)
// - Unacknowledged warning alert count (amber badge)
// - Current UTC time
//
// VISUAL DESIGN:
// - Darkest background (#080f1c) for maximum contrast with content below
// - Gradient brand icon (blue to darker blue)
// - Color-coded alert badges (red for critical, amber for warning)
// ============================================================================

function TopHeader({ mission, events }: { mission: MissionObject; events: AlertEvent[] }) {
  const criticals = events.filter(e => e.severity === "critical" && !e.isAcknowledged).length;
  const warnings = events.filter(e => e.severity === "warning" && !e.isAcknowledged).length;
  
  console.log("[TopHeader] Rendering mission:", mission.missionName);
  console.log("[TopHeader] Alert counts:", { criticals, warnings });
  
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
// ============================================================================
// FLEETCOMMAND ROOT COMPONENT - Three-Panel Autonomy Console
// ============================================================================
// Main UI component that assembles the three core panels:
// 1. LEFT: Mission Map (with ownship, contacts, route)
// 2. MIDDLE: Event Timeline (chronological alerts)
// 3. RIGHT: Fleet Commander (AI explanation copilot)
//
// STATE MANAGEMENT:
// - selectedEventId: Currently selected event in timeline (drives explanation)
// - selectedContactId: Currently selected contact on map (highlights contact)
//
// INTERACTION LOGIC:
// - Selecting an event updates Fleet Commander panel with that event's explanation
// - If the event has a relatedContactId, that contact highlights on the map
// - Selecting a contact directly clears event selection
// - Deselecting everything shows the "default" Fleet Commander explanation
//
// LAYOUT:
// - Fixed 100vh height (full screen)
// - Top header with mission name and alert counts
// - Three-column grid (map | timeline | commander)
// - Bottom status bar with ownship telemetry and comms indicator
// ============================================================================

export function FleetCommand() {
  console.log("[FleetCommand] Component rendering");
  
  // Initial state: ev1 (critical CPA breach alert) is pre-selected to demonstrate urgency
  const [selectedEventId, setSelectedEventId] = useState<string | null>("ev1");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  
  console.log("[FleetCommand] Current state:", { selectedEventId, selectedContactId });

  // ─── Event Selection Handler ─────────────────────────────────────────────
  // When an event is selected:
  // 1. Update selectedEventId state
  // 2. If event has a relatedContactId, highlight that contact on map
  // 3. If deselecting (id=null), clear contact selection too
  //
  // This creates a synchronized view: event selection -> contact highlight
  const handleEventSelect = (id: string | null) => {
    console.log("[FleetCommand.handleEventSelect] Event selected:", id);
    setSelectedEventId(id);
    
    if (id) {
      // Look up the event to check if it has a related contact
      const ev = mockEvents.find(e => e.id === id);
      console.log("[FleetCommand.handleEventSelect] Found event:", ev?.title);
      console.log("[FleetCommand.handleEventSelect] Related contact ID:", ev?.relatedContactId ?? "none");
      
      // Highlight the related contact on map (if any)
      setSelectedContactId(ev?.relatedContactId ?? null);
    } else {
      console.log("[FleetCommand.handleEventSelect] Event deselected, clearing contact highlight");
      setSelectedContactId(null);
    }
  };

  // ─── Contact Selection Handler ───────────────────────────────────────────
  // When a contact is selected directly on the map:
  // 1. Update selectedContactId state
  // 2. Clear event selection (user is focusing on contact, not event)
  //
  // This allows operators to inspect contacts independently of the event timeline
  const handleContactSelect = (id: string | null) => {
    console.log("[FleetCommand.handleContactSelect] Contact selected:", id);
    setSelectedContactId(id);
    
    // Clear event selection when clicking a contact directly
    // (unless clicking the same contact that's already selected from an event)
    if (id !== selectedContactId) {
      console.log("[FleetCommand.handleContactSelect] Clearing event selection (user clicked contact directly)");
      setSelectedEventId(null);
    }
  };

  // ─── Episode Resolution ──────────────────────────────────────────────────
  // Determine which DecisionEpisode to show in Fleet Commander panel
  // Logic:
  // 1. If an event is selected, use that event's episode (if it exists)
  // 2. If no episode for that event, fall back to "default"
  // 3. If no event selected, use "default"
  //
  // This allows each event to have a custom explanation, with a sensible fallback
  const episode = selectedEventId
    ? (decisionsByEvent[selectedEventId] ?? decisionsByEvent.default)
    : decisionsByEvent.default;
  
  console.log("[FleetCommand] Resolved episode:", episode.id, "for event:", selectedEventId);
  console.log("[FleetCommand] Episode summary:", {
    situation: episode.situation.substring(0, 60) + "...",
    confidence: episode.confidence,
    recommendation: episode.recommendation.substring(0, 60) + "...",
  });

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
