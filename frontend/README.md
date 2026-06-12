# Telemetriq Frontend

Vue 3 + TypeScript + Vite frontend for Telemetriq.

## Common commands

- `bun install`
- `bun run dev`
- `bun run build`
- `bun run test`
- `bun run lint`

## Templates system

Overlay templates live in `src/modules/templates/`.

- Canonical registration: `src/modules/templates/registry.ts`
- Authoring helper: `src/modules/templates/types.ts` → `defineTemplate(...)`
- Backward-compatible shim: `src/modules/templateConfigs.ts`

When adding a new system template:

1. create the template module
2. export it with `defineTemplate(...)`
3. register it once in `registry.ts`
4. add renderer code only if the template needs a new drawing algorithm

## Telemetry metric pipeline

The overlay pipeline is intentionally split into two stages:

1. `buildTelemetryTimeline(...)` produces responsive per-point telemetry frames from synchronized GPX data.
2. `getTelemetryAtTime(...)` performs preview/export lookups, applies dense-sample pace stabilization, and holds pace across sparse gaps.

Behavioral expectations:

- pace/speed should react quickly to sustained changes visible in video
- isolated GPS spikes should be filtered out
- sparse 3–5 second gaps should not create invented ramps
- preview and export must use the same lookup semantics

When changing telemetry math, prefer behavior-based tests over brittle implementation assertions.

## Auto-sync pipeline

Video/GPX synchronization lives in `src/modules/syncEngine.ts` and is consumed through `src/stores/syncStore.ts`.

Behavioral expectations:

- time metadata is the primary autosync signal when available
- GPS may refine time only when the nearest track point is spatially close and within the expected time window
- GPS-only sync should fail cleanly when no close track match exists
- outside-range time fallbacks should not claim GPS confidence when the GPS evidence is weak

When changing autosync logic, cover both the pure engine (`syncEngine.test.ts`) and store-level propagation (`stores.test.ts`) with real-fixture regressions when possible.

For broader project setup and product-level usage, see the repository root `README.md`.
