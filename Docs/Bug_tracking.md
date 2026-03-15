# Bug Tracking — FleetCommand

> **Workflow rule:** Before fixing any error, check this file for a known solution. After resolving any error, document it here with root cause and resolution steps.

---

## How to Use This File

1. **Before fixing a bug** — Search this file for the error message, component name, or symptom. If a matching entry exists, follow the documented resolution.
2. **After fixing a bug** — Add a new entry below using the template at the bottom of this file.
3. **Never close a bug** without documenting the root cause and resolution, even for "obvious" fixes.

**Faster debugging:** When generating or changing code, add logging (entry/exit, key state, errors, consistent labels) so bugs can be traced quickly. See *Docs/Implementation.md* → "Logging & Quick Debugging" and the workflow rule "Logging for Quick Debugging."

---

## Open Issues

*No open issues yet. Add entries here when bugs are discovered during implementation.*

---

## Resolved Issues

*No resolved issues yet. Entries will be added as bugs are encountered and fixed during development.*

---

## Bug Entry Template

Copy and fill in this template when logging a new bug:

```
### [BUG-###] Short descriptive title
**Date:** YYYY-MM-DD
**Status:** Open | In Progress | Resolved
**Severity:** Critical | Warning | Info
**Affected file(s):** path/to/file.ts

**Error / Symptom:**
Paste the exact error message or describe the observable behavior.

**Root Cause:**
Explain what caused the issue.

**Resolution:**
Step-by-step description of what was changed to fix it.

**Related files changed:**
- path/to/changed/file.ts

**Notes:**
Any additional context, edge cases, or follow-up items.
```

---

## Known Gotchas & Pitfalls

These are not bugs, but recurring issues to watch for during development.

### TypeScript project references must be updated when adding new packages
**Context:** The monorepo uses TypeScript composite projects. When adding `lib/types` or any new package, the root `tsconfig.json` `references` array must be updated or `pnpm run typecheck` will fail silently for that package.
**Fix:** See `Docs/project_structure.md` → "TypeScript Project References" section for the correct config.

### `any` usage inside `normalizeRawFeed` is intentional — do not widen it elsewhere
**Context:** `normalizeRawFeed(raw: unknown)` must accept `unknown` input. The `any` inside the normalization function body is the one permitted escape hatch. All other files must use canonical types from `@workspace/types`.
**Fix:** If you see a type error propagating from `normalizeRawFeed` output, the fix is always to strengthen the normalization logic, not to cast downstream.

### Tailwind classes not applied after adding new component files
**Context:** Vite + Tailwind requires the `content` glob in `tailwind.config.ts` to cover all new component paths. If a new directory is added (e.g. `src/components/ui/`), classes in those files may be purged in production builds.
**Fix:** Confirm `tailwind.config.ts` `content` array includes `./src/**/*.{ts,tsx}`.

### Map library peer dependency conflicts
**Context:** Leaflet and MapLibre GL JS both define global `window` types. Importing both in the same bundle can cause type conflicts.
**Fix:** Choose one map library per the decision in `Docs/Implementation.md` (Stage 2) and stick to it. Do not mix.

### `pnpm --filter` requires exact package name, not folder path
**Context:** Running `pnpm --filter mockup-sandbox run dev` will fail. The filter value must match the `name` field in `package.json`.
**Fix:** Use `pnpm --filter @workspace/mockup-sandbox run dev` (note the `@workspace/` scope prefix).
