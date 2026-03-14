📘 Product Requirements Document (PRD)

📌 **Product Name (Working Title):**  
FleetCommand — A feedback loop to get a better grasp at what Autonomous Surface Vessels are thinking.

---

⭐️ **Background**  
I am competing in Saronic's Hackathon. I am pursuing **Track #1: UI — Visualizing Autonomous Decisions.**  
The goal is to build a mission-ready interface that makes a single autonomous vessel’s behavior understandable in real time using provided telemetry/data streams and public maritime context.

---

🎯 **Objective**  
Build a single-vessel autonomy explanation console that helps an operator quickly understand current behavior, decision rationale, risk context, and likely next actions. The UI must answer:

1. What is the vessel doing right now?
2. Why is it doing that?
3. What risk/constraint is driving that behavior?
4. What will it likely do next?
5. Does the operator need to care yet?

---

⭐ **Core Features (MVP)**

1. **Mission Map & Data Pipeline**
   - **Main mission map** showing: ownship position, planned vs actual path, waypoint(s), mission/search polygon, nearby contacts, hazard/boundary zones (if provided).
   - **Adaptive layer:** Single normalization function `normalizeRawFeed(raw: unknown) → NormalizedMissionState`. UI never depends on raw input shape. Canonical types (e.g. OwnshipState, MissionObject, Contact, AlertEvent, DecisionEpisode) and adapters for websocket, REST, JSON, replay logs, etc.
   - Realistic **mock maritime data** until real data is available; code modular and hackathon-friendly.

2. **Event Timeline / Alert Feed**
   - Interactive event timeline that serves as the historical context layer for Fleet Commander, showing the most important recent vessel, mission, autonomy, contact, and alert events in chronological order so the operator can understand how the current situation developed over time.
   - Displays recent events in timed order with the newest events easiest to scan, allowing the operator to quickly trace the chain of decisions, warnings, and state changes that led to the vessel’s present behavior.
   - Filtered to meaningful events only, excluding low-value telemetry noise and focusing instead on autonomy mode changes, route deviations, speed or heading changes, contact-risk spikes, mission-phase transitions, hazard proximity, degraded comms, sensor uncertainty, and important alert creation/clear events.
   - Color-coded by severity and significance so the operator can immediately distinguish informational events from warnings, critical alerts, and high-priority autonomy decisions that may require attention.
   - Click-through on events with feedback from Fleet Commander, allowing each timeline item to become an explanation trigger: when the operator selects an event, Fleet Commander should generate a targeted explanation of what happened, why it mattered, what evidence supported the system’s response, and whether any operator action was or is needed.
   -Event detail should connect timeline items to autonomy explanations, mission state, and risk context, ensuring that every important event is not shown in isolation but tied to route progress, nearby contacts, active alerts, mission geometry, and current vessel behavior.
   - Supports decision reconstruction, helping the operator answer questions such as: What changed first? What caused the vessel to deviate? When did the contact become risky? When did the system shift autonomy behavior? and Was the response appropriate?
   - Designed as the memory layer for Fleet Commander, giving the explanation UI a clear sequence of prior events it can reference when generating contextual explanations instead of only describing the vessel’s current state.
   - Autonomy-centered event types should include things like route adjustments, heading changes, speed changes, avoidance behavior, hold-position behavior, mission start/completion, waypoint arrival, confidence drops, alert escalation, and return-to-route moments.
   - Risk-centered event types should include contact classification changes, CPA/TCPA threshold crossings, hazard-zone entry or proximity, collision-risk escalation, and environmental or operational constraints that influenced autonomy behavior.
   - Mission-centered event types should include mission-phase transitions, waypoint progression, search-pattern entry, patrol completion, route replanning, and deviations from intended task flow.
   - Operator-friendly event titles should be concise and meaningful, such as “Autonomy shifted to avoidance behavior,” “Crossing contact risk increased,” “Route deviation detected,” or “Comms freshness degraded,” rather than exposing raw system or log-language by default.
   - Selected event behavior: When an event is clicked, the UI should highlight related map elements, relevant contacts, or mission geometry if available, while Fleet Commander updates its explanation to focus on that event’s role in the broader mission story.
   - Scannable default, deeper detail on demand: Each event should be readable in one line or a compact card at a glance, with expandable detail for timestamp, severity, linked risks, related mission object, and supporting evidence if the operator wants more context.
   - Integrates directly with explanation synthesis, giving Fleet Commander structured event context it can use to generate stronger explanations of what changed, why it changed, what evidence mattered, and what is likely to happen next.
   - Reduces cognitive load by turning fragmented alerts and state changes into an understandable operational narrative, making the timeline feel less like a raw log feed and more like a mission-history tool for human supervision.

3. **Fleet Commander (Explanation UI with Captian avatar)**
   - Mission-aware copilot panel that serves as the primary explanation layer for the currently monitored autonomous vessel, helping the operator understand what the autonomy is doing without needing to manually interpret raw telemetry, alerts, or contact data.
   - Explains current autonomous behavior in operator-friendly language, translating route deviations, speed changes, heading adjustments, mission-state changes, contact interactions, and alert conditions into concise, operationally useful summaries.
   - Prioritizes operator attention by surfacing the most important current issue first, such as collision risk, route deviation, degraded comms, mission-state transition, or sensor uncertainty, instead of treating all incoming information as equally important.
   - Summarizes current mission state and relevant risks by connecting vessel behavior to route progress, mission objectives, nearby contacts, hazard zones, and environmental context so the operator can quickly understand the full situation.
   - Recommends next action when relevant, clearly indicating whether the operator should simply monitor, prepare to intervene, inspect more detail, or take immediate action.
   - Captain avatar UI: Includes a visually distinct captain-style avatar that makes the explanation layer feel like an onboard mission copilot. The avatar should reinforce the sense that the system is “speaking” to the operator, while still maintaining a calm, trustworthy, professional tone rather than feeling gimmicky or cartoonish.
   - Tone and communication style: Responses should feel calm, concise, operational, and evidence-backed. Fleet Commander should avoid dramatic, vague, or overly conversational language and instead sound like a reliable maritime copilot giving briefings under real mission conditions.
   - **Response format:** Situation → Reason → Confidence → Recommendation (with explanation).
   - Situation: Clearly state what the vessel is currently doing or what meaningful change has occurred, such as deviating from route, slowing down, entering a mission area, reacting to traffic, or holding position.
   - Reason: Explain why the autonomy is behaving that way using mission context, contact behavior, route logic, alerts, or safety constraints.
   - Confidence: Indicate how certain the system is in its interpretation, ideally using a small set of understandable levels such as Low, Medium, or High.
   - Recommendation: Tell the operator what posture to take next, such as monitor only, inspect contact, prepare for intervention, or take action now, with a brief explanation of why.
   - **Explanation synthesizer:** Converts normalized signals into operator-ready text (what changed, why, 2–4 observable facts, what is expected next).
   - Event-aware behavior: Updates dynamically as timeline events occur, alerts appear or clear, contacts change risk level, or the operator selects a relevant item on the map or timeline.
   - Context-linked explanations: Should reference the currently selected vessel context, active alerts, route progress, nearby contacts, and mission geometry so explanations always feel grounded in the current operational picture.
   - Evidence-backed reasoning: Each explanation should be traceable to observable data such as heading changes, predicted closest approach, alert state, route deviation, mission-phase changes, or comms freshness, so the operator can trust why the explanation was generated.
   - Expected-next-step guidance: Should not only explain the present state, but also briefly communicate what the autonomy is likely to do next if current conditions continue, such as resume route, continue avoidance, maintain hold, or begin search behavior.
   - Operator urgency signaling: Should implicitly or explicitly communicate whether the current situation is informational, requires monitoring, or may require intervention, helping reduce cognitive load during fast-changing mission moments.
   - Expandable depth: The default output should be short and scannable, but the UI can optionally allow the operator to expand the explanation for deeper context, supporting facts, or related mission/timeline details if time permits.

---

📋 **Planned (Future Features)**  
*Only if time permits.*

- Show real map location and actual location of ** ASV** from given data.
- **Video / camera / sensor** screen.
- Support additional vessels in the future through the same normalization layer, while keeping the UI centered on one selected ownship.
- **Selected overlays** (e.g. weather).
- **Replay controller** for mission replay.
- **3D AR / spatial view** (e.g. three.js, bathymetry) for spatial intuition.

---

📁 **Workspace & technical context**
- **Monorepo:** pnpm workspace (see `replit.md`). TypeScript 5.9, composite projects; typecheck from root: `pnpm run typecheck`.
- **FleetCommand UI:** Lives in `artifacts/mockup-sandbox` — React, Vite, Tailwind; Replit design artifact with component preview. Main FleetCommand mockup: `artifacts/mockup-sandbox/src/components/mockups/fleet-command/FleetCommand.tsx`. The UI is the Presentation Layer and must consume only normalized data and explanation outputs (see `Docs/arch.md`).
- **API / backend:** `artifacts/api-server` (Express 5). Shared libs in `lib/` (api-spec, api-client-react, api-zod, db).
- **Run commands:** UI dev: `pnpm --filter @workspace/mockup-sandbox run dev`; API dev: `pnpm --filter @workspace/api-server run dev`.

---

📁 **Resources Available*
- Docs/Potential_info.md: It provides information on potential data I MAY be given. My code should be prepared to handle all of these types
- Docs/arch.md: describes the 4 phases of my code architecture, and how my code should flow 
- **Constraints:** Use dummy maritime mission data until real data; keep code modular and hackathon-friendly; avoid overengineering; polished but simple UI.