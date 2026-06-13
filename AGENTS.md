# Telemetriq Agent Guide

## Start here

- Most code changes happen in [`frontend/`](../frontend/); the repository root mainly holds deployment files, Docker Compose files, and top-level documentation.
- Read the [root README](../README.md) for product/setup context, the [frontend README](../frontend/README.md) for day-to-day commands, and the [templates README](../frontend/src/modules/templates/README.md) before changing template authoring or registry behavior.

## Working directory and commands

- Use **Bun** for all JS/TS tasks. Run commands from `frontend/` or prefix them with `cd frontend &&` when starting from the repo root.
- Install dependencies: `bun install`
- Dev server: `bun run dev`
- Build + typecheck: `bun run build`
- Unit tests: `bun run test`
- E2E tests: `bun run test:e2e`
- Lint: `bun run lint` (warnings fail because ESLint runs with `--max-warnings=0`)
- If FFmpeg WASM assets are missing, fetch them with `bun run fetch-ffmpeg-core`.
- Playwright may require browser installation before the first E2E run.

## Architecture map

- `frontend/src/modules/` contains most domain logic: telemetry parsing, video processing, overlay rendering, template definitions, and media utilities.
- `frontend/src/components/` contains Vue UI components.
- `frontend/src/stores/` contains Pinia stores using the composition-style `defineStore(...)` pattern; see [`frontend/src/stores/processingStore.ts`](../frontend/src/stores/processingStore.ts).
- `frontend/src/core/` contains shared types and core errors; see [`frontend/src/core/types.ts`](../frontend/src/core/types.ts).
- `frontend/src/__tests__/` contains unit/integration coverage; `frontend/e2e/` contains Playwright browser flows.

## Project-specific conventions

- This repository is frontend-only. Do not assume a backend service or server-side API layer exists.
- `bun run build` runs `vue-tsc -b` before Vite, so type errors block builds even if the dev server still renders.
- TypeScript is strict (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`); keep types explicit and remove unused code instead of leaving placeholders.
- Keep business logic in `modules/`, stores, or composables when possible; avoid pushing domain logic into large Vue SFCs.
- Most behavior changes should include focused tests in `frontend/src/__tests__/`; use `frontend/e2e/` for full browser flows.

## Telemetry metric behavior

- Pace and speed should feel synchronized to the athlete on screen, not delayed by long trailing smoothing windows.
- The current telemetry pipeline computes responsive per-segment metrics from synchronized GPX samples, rejects isolated spikes, and applies only light dense-sample pace stabilization at lookup/render time.
- Large GPX gaps must not invent synthetic ramps. Hold the last known pace across sparse gaps instead of extrapolating through missing data.
- When changing telemetry math, validate both preview-time lookups (`getTelemetryAtTime`) and export-time rendering (`VideoPlayer.vue` / `videoProcessor.ts`) so preview and rendered video stay aligned.

## Auto-sync behavior

- Auto-sync is time-first when reliable video creation time is present. GPS may refine it only when the nearest GPX candidate is both temporally plausible and spatially close.
- Weak GPS matches must not override a plausible time-based offset. A nearest point that is far from the video GPS should produce a warning, not false confidence.
- GPS-only sync is allowed only when there is a genuinely close track match; otherwise the store should surface a manual-sync error state.
- Real-fixture autosync tests should cover weak-GPS warnings, looped tracks, sparse metadata, outside-range fallbacks, and store/UI propagation of sync warnings.

## Template workflow

- The template registry is the single source of truth: add templates with `defineTemplate(...)` and register them once in [`frontend/src/modules/templates/registry.ts`](../frontend/src/modules/templates/registry.ts).
- If a template uses an existing layout mode, avoid adding new renderer wiring. Only touch layout renderers when the template introduces a genuinely new drawing algorithm.

## UI/UX guardrails

- **Metric toggles in the preview panel**: show only metrics that the selected template supports (`available === true`). Unavailable metrics must not be displayed — they add noise and provide no actionable value. The overlay canvas and warning blocks handle missing-data communication.
- **Sync panel**: no redundant headings. The SyncSlider component already carries its own status indicator (Auto/Manual dot). Don't duplicate "Synchronization" as a separate header.
- **CSS fallbacks**: all `var(--color-*, …)` fallback values must match the hex values declared in `DESIGN.md` color tokens.
- **Primary buttons**: flat `var(--color-primary)` background, not a gradient. Gradient is reserved for hover state.
- **No decorative shadows** on cards, panels, or buttons. Depth comes from surface contrast and subtle borders.

## Testing and environment gotchas

- E2E helpers (`window.__e2eStores`) are exposed only in dev mode when the URL includes `?e2e`; see [`frontend/src/main.ts`](../frontend/src/main.ts).
- To navigate to `/preview` or `/result` with seeded data, seed stores on the upload page first, then click a button to navigate (direct `page.goto` triggers guard redirects before `evaluate` can seed).
- `navigator.wakeLock.request('screen')` may hang in headless Playwright Chromium. Always mock the WakeLock API in `seedStores` functions before seeding files:
  ```ts
  (navigator as any).wakeLock = {
      request: async () => ({
          release: async () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
      }),
  };
  ```
- The template selector dropdown (`#template-select`) does NOT include the `'custom'` template — use `TEMPLATE_IDS.filter(id => id !== 'custom')` in tests that iterate over selectable templates.
- Do not hardcode the full list of template ids in tests. Import `TEMPLATE_IDS` from the registry so new templates such as `trail-run` and `cycling-pro` are covered automatically.
- Performance/fixture tests must tolerate optional local media assets. Assert required fixture labels only for files that actually exist in `test_data/` instead of assuming every workspace has the same baseline sample set.
- Telemetry tests should be behavior-driven: cover exact-second lookups, in-between-frame lookups, pauses, sparse gaps, isolated spikes, sustained speed changes, preview/export parity, and auto-sync edge cases (weak GPS, loops, fallback paths). Avoid brittle assertions against arbitrary internal floating-point intermediates.
- The main environment variable is `SITE_URL`, used for canonical URLs, robots, and sitemap behavior. Check the [root README environment section](../README.md#environment-variables) before changing site metadata behavior.