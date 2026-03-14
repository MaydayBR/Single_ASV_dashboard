## Potential Information to Be Prepared to Receive

All of the following are plausible data types or artifacts that could be provided, so the UI and data model should be designed to accommodate them.

### 1. Mission telemetry and vehicle state
A high-probability input is mission and subsystem telemetry, whether delivered live or through replay. At minimum, this likely includes ownship position, motion, and other kinematic state needed to place the vessel on a map, show route progress, and contextualize autonomy decisions.

The safest assumption is that an "ownship state" object will include a timestamp and core kinematic fields, but schemas may vary and some fields may be missing. The rendering pipeline should therefore tolerate incomplete data, variable update rates, and stale information, especially because Saronic emphasizes operations in comms-degraded or comms-denied environments without persistent connectivity.

### 2. Autonomy decision state and autonomy-aware alerts
Another likely category is autonomy-related decision data. In addition to raw telemetry, you may receive—or be expected to derive—decision annotations such as autonomy mode, behavior state, "why" tags, or safety-related alert objects.

A practical way to structure these for Track 1 is as UI-ready events: time-stamped decision points with:
- a short label describing what changed,
- a rationale explaining why it changed,
- and an operational implication describing what the operator should monitor next.

This approach aligns with explainability best practices: helping operators understand reasons, evidence, and implications, rather than exposing raw internal model state.

### 3. Video and EO/IR sensor viewpoints
Video is a realistic expectation for Track 1. Available evidence suggests Saronic operations rely heavily on multi-camera video, including 360° coverage, low-latency streaming, and electro-optical / infrared viewpoints.

In practice, participants may receive a live video feed, replay clips, or at least metadata describing camera viewpoints and sensor modes. The UI should be prepared to support video or sensor-view context as a core operator-facing element.

### 4. Mission planning objects
You should expect mission intent data in addition to live vehicle state. A mission-ready UI must show not only where the vessel is, but what it is trying to do.

Relevant planning objects likely include:
- points or waypoints,
- polylines or routes,
- polygons or operational areas,
- optional search patterns or task overlays,
- timing, roles, behaviors, or speed settings.

For Track 1, the UI should be ready to render and cross-link these geometry types so operators can connect mission intent to current vessel behavior.

### 5. Communications status and dropouts
Communications state should be treated as first-class operational information, not just a backend detail. Since Saronic discusses multiple communications links and operations in degraded or disabled comms conditions, the UI should make comms health obvious.

That means showing:
- timestamps,
- last-heard indicators,
- stale-data warnings,
- degraded-mode banners,
- and visible dropout events.

A strong Track 1 UI will make it clear when the map or telemetry is no longer current rather than silently freezing.

### 6. Replay logs and scenario packs for offline development
Replayable data is also a strong possibility. Saronic's publicly described workflow emphasizes replay, observability, regression testing, and multimodal log analysis.

For Track 1, you may receive:
- a log bundle for one or more scenarios,
- a replay stream,
- or a simplified export intended for participants.

Even if the format is not something like MCAP directly, it is wise to build the UI around a record/replay abstraction so the same interface can support both live and offline data.

## Public Maritime Data Sources Worth Pre-Staging

Track 1 is expected to combine Saronic-provided data with public maritime sources. The following sources are especially valuable to prepare in advance.

### 1. AIS and vessel traffic context
AIS-derived products are one of the most likely public layers to matter. AIS is the standard source for vessel positions and characteristics and is useful for showing nearby contacts, traffic density, vessel classes, and common transit lanes.

Even if Saronic provides contact tracks directly, AIS-based context can make those contacts more understandable for operators without requiring private data.

### 2. Nautical charts and ENC layers
Nautical chart context is one of the highest-value layers for a mission-ready maritime UI. NOAA Electronic Navigational Charts and related services provide shoreline, depths, obstructions, aids to navigation, restricted areas, and other navigationally relevant features.

These layers are useful both as a basemap and as structured operational context for safe navigation.

### 3. Traffic lanes and routing measures
Traffic lanes, separation zones, precautionary areas, and recommended routes are especially useful for explaining autonomy behavior in plain language.

These layers can help answer operator questions such as:
- Why did the vessel reroute?
- Why is it holding course here?
- Why is it avoiding this area?

### 4. Weather and marine forecasts
Weather is an important contextual layer for any serious maritime autonomy UI. Forecasts, alerts, observations, wind, visibility, and other marine conditions can affect route planning and operator trust.

If the autonomy changes behavior, weather context helps make that behavior feel grounded and understandable.

### 5. Tides, currents, and water levels
Tides, currents, and water levels are especially relevant in nearshore, harbor, inlet, and port scenarios. These data can help explain slower movement, loitering, route changes, or station-keeping difficulty.

They are particularly useful as trust-building context when the autonomy's behavior might otherwise seem unexplained.

### 6. Restricted areas and hazards
Restricted areas, danger zones, and hazard layers are valuable for both mission planning and autonomy explanation. They can support operator-facing reasoning such as rerouting, avoidance, or constrained maneuvering.

### 7. Bathymetry and depth context
Bathymetry is also a high-value overlay. Depth context can help operators understand where the vessel can safely maneuver and why certain routes or behaviors were selected.

A practical approach is to use:
- ENC data for chart-grade nearshore constraints,
- and bathymetric relief or contours for quick visual depth awareness where needed.

### 8. Rules-of-the-road / COLREGS context
For maritime autonomy, decision explanations may need to map to navigation rules. Operator-friendly labeling of crossing, overtaking, give-way, and stand-on situations can make autonomy behavior easier to trust and manage.