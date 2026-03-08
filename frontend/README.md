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

For broader project setup and product-level usage, see the repository root `README.md`.
