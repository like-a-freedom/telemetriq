# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-11-08

### Added

- Ghost Run HUD overlay template: translucent metric panels, a live route line
  with a heart-rate badge, and track time shown as a 24-hour wall clock.
- GPS coordinates and recording timestamps (`latitude`, `longitude`, `timestampMs`)
  on telemetry frames, powering route-based overlays.
- GitHub Pages deployment with a verified static build, plus an optional
  hash-based router mode (`VITE_ROUTER_MODE=hash`) for hosting from a subpath.
- `medium` and `semibold` font weights in typography presets across all templates.
- Bundled Barlow Semi Condensed fonts for the trail-run overlay.

### Changed

- Overlay typography aligned across templates to prevent overflow; classic layout
  rows now fit the canvas width; arc gauge and hero number polished.
- All dependencies updated to their latest versions (vue, vite, pinia, vue-router,
  mediabunny, eslint, playwright, vitest and others).

### Fixed

- Overlays no longer paint invalid telemetry values (NaN or empty) in any template.
- Ghost Run heart badge aligns with the pulse value.
- The production build includes all required site assets and resolves the web
  manifest from the configured base path.

[1.3.0]: https://github.com/like-a-freedom/telemetriq/compare/v1.2.0...v1.3.0
