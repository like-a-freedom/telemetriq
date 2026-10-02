# Telemetriq

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Turn synchronized sports telemetry and video into videos with customizable telemetry overlays. The existing README identifies athletes, coaches and sports content creators as users.

## Operating Context

Import video and GPX, synchronize them, select and configure an overlay, preview, then export in the browser. The existing application uses Vue, TypeScript, Canvas and browser video processing.

## Capabilities and Constraints

GPX supplies position, recording time, distance and optional elevation, heart rate, cadence and power. Preview and export must show the same synchronized data. Missing optional measurements must not become invented values. Weather and previous-activity comparisons have no data source in the current import workflow.

## Evidence on Hand

Repository README, frontend README and template registry describe the existing product. The user supplied `docs/references/ghost-overlay.jpg` as the visual reference for Ghost Run and confirmed that this template should reproduce the telemetry interface only.

## Product Principles

- Keep the athlete's video visible and telemetry readable.
- Preserve consistency between preview and exported video.
- Display real imported measurements and make missing data explicit.

## Open Decisions

No new product-wide positioning or accessibility standard was established by this overlay request.
