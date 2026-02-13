# Telemetriq — Sports Telemetry Overlay 🏃‍♂️📊

[![License](https://img.shields.io/badge/license-MIT-blue)](#)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![Tests](https://img.shields.io/badge/tests-vitest%20%E2%9C%85-blue)](#)
[![E2E](https://img.shields.io/badge/e2e-playwright-orange)](#)

Short description: Telemetriq is a web/Tauri application for visualizing sports telemetry (GPX and other formats) on top of video — with customizable overlay templates and export capabilities.

---

## Table of contents
1. [Quick start](#quick-start)
2. [Demo / Screenshots](#demo--screenshots)
3. [Features](#features)
4. [Run & Build](#run--build)
5. [Tests](#tests)
6. [Docker / dev‑compose](#docker--dev-compose)
7. [Architecture & stack](#architecture--stack)
8. [Environment variables](#environment-variables)
9. [Contributing](#contributing)
10. [FAQ](#faq)
11. [License](#license)

---

## Quick start
Requirements:
- Bun (recommended for all JS/TS commands)
- Docker (optional)
- Node.js is not required for development — use `bun`

Clone and run locally:

```bash
git clone <repo-url>
cd sports_telemetry_overlay/frontend
bun install
bun run dev      # dev server (Vite) — http://localhost:5173
```

Import a GPX file + video via the UI → choose an overlay template → Export.

---

## Demo / Screenshots
Add a GIF or screenshot here to showcase the main flows.

<div align="center">
  <!-- example: <img src="docs/demo.gif" alt="demo" width="720"/> -->
</div>

---

## Features ✨
- WebGPU / WebGL overlay rendering
- GPX and other telemetry formats support
- Video export via browser `@ffmpeg/ffmpeg` and/or native FFmpeg
- Template-driven, customizable overlay layouts
- Unit + E2E tests (Vitest + Playwright)

---

## Run & Build 🔧
All JS/TS commands use `bun` (see `frontend/package.json`).

- Dev: `bun run dev`
- Build: `bun run build`
- Preview production build: `bun run preview`
- Lint: `bun run lint`
- Fix lint issues: `bun run lint:fix`

### Notable scripts
- `bun run fetch-ffmpeg-core` — download wasm ffmpeg to `public/vendor/ffmpeg`
- `bun run benchmark:webgpu` — run WebGPU benchmark (Vitest)

---

## Tests 🧪
- Unit: `bun run test` (Vitest)
- Watch: `bun run test:watch`
- Coverage: `bun run test:coverage`
- E2E: `bun run test:e2e` (Playwright)

E2E requires Playwright browsers installed — run `npx playwright install` if needed.

---

## Docker / dev‑compose 🐳
The dev compose brings up the frontend with volume mounting (port 5173):

```bash
docker-compose -f docker-compose.dev.yaml up --build
```

---

## Architecture & stack 🔭
- UI: Vue 3 + Pinia
- Bundler: Vite (commands executed with Bun)
- Tests: Vitest (unit), Playwright (e2e)
- Media: `@ffmpeg/ffmpeg` (web) + native FFmpeg for offline export
- Code layout: `frontend/src` for UI, `modules/` for telemetry processing

---

## Environment variables
Create `.env` / `.env.local` in `frontend/` to override defaults if needed.
(See `vite.config.ts` for environment usage.)

---

## Contributing 🤝
1. Open an issue describing the bug or feature.
2. Fork the repo and create a branch `feature/your-feature`.
3. Run `bun run lint:fix` and add tests for your changes.
4. Send a PR with a clear description, screenshots/GIFs and tests.

Coding standards: ESLint + Prettier.

## License
This project is licensed under the MIT License — see `LICENSE` in the repository root.

---

## Support & contact
Open an issue for bugs or feature requests. For quick questions, create a WIP PR.

---