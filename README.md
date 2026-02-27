# Telemetriq — Sports Telemetry Overlay 🏃‍♂️📊

[![License](https://img.shields.io/badge/license-MIT-blue)](#)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![Tests](https://img.shields.io/badge/tests-vitest%20%E2%9C%85-blue)](#)
[![E2E](https://img.shields.io/badge/e2e-playwright-orange)](#)

Telemetriq is a web application for visualizing sports telemetry (GPX and other formats) on top of video — with customizable overlay templates and export capabilities.

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

Clone and run locally:

```bash
git clone <repo-url>
cd sports_telemetry_overlay/frontend
bun install
bun run dev      # dev server (Vite) — http://localhost:5173
```

Import a GPX file + video via the UI → choose an overlay template → Export.

## Features ✨
- WebGPU / WebGL overlay rendering
- GPX and other telemetry formats support
- Video export via browser `@ffmpeg/ffmpeg` and/or native FFmpeg
- Template-driven, customizable overlay layouts
- Unit + E2E tests (Vitest + Playwright)

## Value proposition & use cases

Telemetriq helps athletes, coaches and content creators quickly extract actionable insights from training sessions and turn them into clear, telemetry‑overlaid videos. The app saves time on annotation and preparation, improves feedback quality, and simplifies production of instructional or promotional material.

Who benefits:
- Athletes who want to analyze workouts and track progress
- Coaches who need to mark segments and provide visual feedback quickly
- Content creators and marketers producing clips with telemetry (speed, distance, elevation, etc.)

Example use cases:
- Workout analysis: upload GPX + video, align metrics with the timeline, and find sections with speed drops or heart‑rate spikes — focus your coaching and save analysis time.
- Coaching feedback: mark key intervals and export videos with visual cues for athletes — clearer guidance and faster improvement.
- Content creation: auto‑generate short clips and infographics for social media or training materials — reduce prep time and increase engagement.
- Export & reporting: export videos and metadata for analytics, publishing, or archival — easy integration into workflows.

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

CI also builds and publishes a production Docker image to GitHub Container Registry (GHCR) for the `like-a-freedom/telemetriq` repository. Example pull commands:

```bash
docker pull ghcr.io/like-a-freedom/telemetriq:latest
# or pinned to commit
docker pull ghcr.io/like-a-freedom/telemetriq:<commit-sha>
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

- `SITE_URL` — public base URL for the site (used in `robots.txt`, `sitemap.xml`, canonical/OG tags and LLM discovery files). Defaults to `https://telemetriq.app`.

  Only `SITE_URL` needs to be set. The server injects the runtime `SITE_URL` (used for canonical/OG/robots/sitemap) so you can change it without rebuilding the image. The client can also read `SITE_URL` at runtime via `window.__SITE_URL__` (exposed by `/site-config.js`); `VITE_SITE_URL` is no longer required.

Examples:

- Local dev (shell):

```bash
export SITE_URL=http://localhost:5173
bun run dev
```

- Docker Compose (override in `.env` or shell):

```bash
# .env
SITE_URL=https://telemetriq.like-a-freedom.ru

docker compose -f docker-compose.yaml up --build -d
```

robots/sitemap are generated at runtime by the server from `SITE_URL` (Caddy in production; Vite dev middleware locally). The build still emits static copies for convenience, but the server will serve the up‑to‑date files from the single `SITE_URL` value so you can change it without rebuilding.

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
