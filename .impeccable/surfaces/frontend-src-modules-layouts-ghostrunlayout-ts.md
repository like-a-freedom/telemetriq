---
version: 1
slug: "frontend-src-modules-layouts-ghostrunlayout-ts"
primary_target: "frontend/src/modules/layouts/ghostRunLayout.ts"
related_targets: ["frontend/src/modules/templates/ghostRun.ts", "frontend/src/modules/ghostRunRoute.ts", "frontend/src/modules/trailRunFonts.ts", "frontend/e2e/ghost-run-layout.spec.ts"]
---

# Ghost Run overlay

Scope: a new selectable Canvas overlay. Mode: Experience. The athlete's footage leads; telemetry stays at the edges. Reference: `docs/references/ghost-overlay.jpg`. The user confirmed HUD only, without the central runner.

This is an ordinary extension of the incumbent Canvas template system. `DESIGN.md` remains the authority for product chrome and the global visual system. The choices below belong to Ghost Run only.

## Direction contract

**THESIS:** Reproduce the reference's open, transparent running HUD with a left metric rail, route map and bottom-right route progress. No enclosing dashboard panel.

**OWN-WORLD:** White condensed sans numerals, quieter white labels and units, pale cyan hairlines and position markers, coral heart. Use the bundled Barlow family at 600 for values and 500 for labels and units. Shallow perspective connects text and geometry; contrasting contours support the ink without covering the footage.

**STORY:** Read current pace, distance, elapsed time and heart rate, locate progress on the imported track, and understand its elevation. Missing measurements remain explicit; comparison and weather are omitted without source data.

**FIRST VIEWPORT:** Landscape left rail begins near 5% width and 12% height, four generously separated metric groups, a fine open bracket outside it, route below. Small recording clock at top right, live elevation/grade at right, distance progress and elevation profile at bottom right. Center stays clear. Portrait uses larger relative type, a shared right margin and a wide bottom progress block. Shallow landscape reflows the four metrics into two columns and two rows.

**FORM:** User-pinned reference; no concept seed required. Implement its telemetry geometry directly in Canvas; the supplied image is the visual authority. Launcher unavailable, so context and contract are recorded directly.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Data semantics

Distances use the application's kilometers and pace uses minutes per kilometer. The clock is GPX recording time in UTC. The route and elevation profile represent the complete imported activity; progress and position follow the synchronized telemetry frame. Elevation gain/loss describe the full recorded track. They are not comparison or planned-route values.

- **ELAPSED** includes pauses and uses total recording time, rather than moving time. The preview Time helper explains this template-specific behavior.
- The route keeps the imported track's aspect ratio. The current marker follows recording time, so loops and stationary samples remain unambiguous. The drawing trace is bounded to 384 points; elevation sampling retains local extrema instead of smoothing out narrow hills.
- Missing finite pace, heart rate, elevation or grade readings display `N/A`. Route geometry, the elevation profile and gain/loss appear only when their source data supports them. Missing elevation samples break gain/loss accumulation across that segment.
- The right block shows live elevation and grade, or grade alone when elevation is disabled. Weather, a previous-run comparison and split delta are omitted because the current import flow has no source for them.

## Colors

The template owns a small local palette in `GHOST_RUN_COLORS`, without adding global CSS tokens:

| Role | Implemented value | Use |
| --- | --- | --- |
| Soft white | `#F7FBFA` | Metric values, supporting text and route trace |
| Pale cyan | `#7DE6E3` | Open bracket, current-position marker, live elevation, progress and profile |
| Coral | `#FF5B72` | Drawn heart beside the heart-rate value |
| Dark contour | `#152321` | Local text and geometry contrast support |

Template configuration supplies text and accent overrides. The heart retains its semantic coral color. No palette choice here changes the editor's indigo primary accent.

## Typography

Use the bundled Barlow Semi Condensed faces: values at weight 600; labels, units, recording clock and profile details at weight 500. The shared font loader awaits both faces before Canvas measurement and rendering; the faces carry tabular numeral settings.

The rail scales from the shorter frame dimension and the template's size controls. Fit all visible rail metrics together using measured text and reserved numeric widths, preserving a common value size as data changes. Portrait has a larger relative value scale, with 12px minimum rail labels and recording clock. Its unit sizing starts at 12px; the smaller bpm copy uses 85% of that size. Shallow landscape uses 10px minimum supporting rail text. These sizes precede projection. Values continue to scale proportionally through 4K instead of stopping at a fixed pixel cap.

Each rail value, separator and unit shares one local plane tangent. The pace suffix is a tall drawn slash followed by lowered `km`, matching the reference's hierarchy while retaining kilometer semantics. Do not position its pieces on independent transforms.

**The One Rail Rule.** Fit the rail as a complete type system; do not shrink individual metric values independently.

## Layout

The default landscape rail starts near 4.7% of width and 12% of height. It contains pace, distance, elapsed time and heart rate, with an open bracket outside the metric groups. The route sits below this rail. A recording clock sits at top right; live elevation/grade occupies the right edge; current/total distance, progress, elevation profile and full-activity ascent/descent occupy bottom right. The athlete's center remains clear.

The rail, bracket and route use a shared mild projective plane. Right telemetry and progress use their own shallow planes; text follows each plane's local tangent rather than tilting independently of nearby geometry. Preserve the route's aspect ratio before projection.

Portrait keeps the same edge hierarchy. The rail begins at about 8% of width and 11% of height. Elevation labels, units, grade, recording clock and ascent/descent totals align their visible ink to the common outer right margin, 4% of the shorter dimension. The progress block spans most of the frame width; its nominal baseline sits at 86% of frame height. Landscape uses an 82.5% nominal progress baseline. These baselines acquire the plane's gentle slope.

Landscape below 240px high reflows visible rail metrics into up to two columns, retaining readable support text and widening the progress/profile block. Metric toggles remove their corresponding rendered content; supported metrics are pace, distance, time, heart rate, elevation and grade.

**The Portrait Edge Rule.** Align the painted right-side text to one safe outer margin; aligning only a containing block does not preserve the reference's edge rhythm.

## Elevation & Depth

No enclosing panel, background fill, gradient or full-frame dim layer is drawn. The default text-shadow control enables thin glyph contours and geometry under-strokes beneath the bracket, route, markers, progress and profile. For recognized three- or six-digit hex colors, the renderer compares foreground and requested contour: below a 3:1 ratio it substitutes soft white for dark ink, or the dark contour for lighter ink. Otherwise it retains the requested contour. This protects both default and dark text/accent overrides without recoloring their foregrounds. Canvas shadow blur and offsets are zero.

**The Local Contrast Rule.** Support the ink at its edges; preserve the open footage between HUD elements.

## Shapes

An open, softly curved bracket groups the left rail. Fine route and profile strokes, small circular position markers and a drawn coral heart carry the remaining geometry. These are Canvas paths; the reference photograph and a runner illustration are not embedded in the shipping overlay.

## Validation and finish

Finish disposition: **ship**, scoped to the resolved portrait alignment, shallow-frame readable reflow and corrected pace-suffix alignment. The reviewer observed no regressions across the 12 final recaptures. This records the reviewed fixes, not universal approval for every footage color or export size.

Implementation validation completed on 2026-10-02: build and lint passed; unit tests reported 874 passed and 9 skipped; the full Chromium suite reported 58 passed and 4 skipped out of 62 tests in 36.4 seconds. All six focused Ghost Run browser tests passed.

`frontend/e2e/ghost-run-layout.spec.ts` covers 1,728 configurations: nine frame sizes, all 64 metric-toggle combinations and three size/style variations, checking transformed logical text bounds/collisions and path bounds. It also checks missing-data behavior, center transparency, editor selection, Canvas preview/video-frame export parity, portrait right edges and proportional pace type through portrait and landscape 4K. Twenty-four painted contrast cases combine two portrait sizes, six solid grounds and two ink palettes; they check the pace label's contrasting pixels and the pace value's size floor. They do not establish a contrast ratio for every metric over arbitrary moving footage. 4K is regression-tested, without a separate capture-based visual approval.

The documenter checked the current template, renderer, route builder, bundled font loader, product/global style context, focused test contracts, pinned reference and all 12 final captures:

- `.impeccable/review/ghost-run-landscape.png`
- `.impeccable/review/ghost-run-portrait.png`
- `.impeccable/review/ghost-run-portrait-small.png`
- `.impeccable/review/ghost-run-square.png`
- `.impeccable/review/ghost-run-shallow.png`
- `.impeccable/review/ghost-run-bright.png`
- `.impeccable/review/ghost-run-dark.png`
- `.impeccable/review/ghost-run-portrait-bright.png`
- `.impeccable/review/ghost-run-portrait-dark.png`
- `.impeccable/review/ghost-run-portrait-warm.png`
- `.impeccable/review/ghost-run-portrait-cyan.png`
- `.impeccable/review/ghost-run-portrait-dark-ink.png`

Capture context is recorded in `.impeccable/review/ghost-run-evidence.json`: a local DJI footage frame and real Suunto GPX telemetry were combined for design review. Those captures do not assert that the two sources are synchronized.

The refreshed visual-regression baseline, `frontend/e2e/templates-visual.spec.ts-snapshots/template-ghost-run-chromium-darwin.png`, contains an `impeccable:prompt` PNG text chunk identifying Playwright capture after the perspective/portrait refinements, its synthetic preview fixture and the Canvas renderer. It is a test capture, not generated artwork. Ghost Run ships no raster artwork.

Global documentation state was preserved: `DESIGN.md` predates this surface brief, uses `Layout & Spacing` instead of the current document contract's canonical `Layout` heading, and carries component properties beyond that contract's eight-property schema. `.impeccable/design.json` is absent. This ordinary extension does not canonize or repair those pre-existing documentation gaps.

## Projection correction, 2026-10-02

Supersedes the perspective description above: HUD blocks now use rigid rotation, with no perspective compression or shear of glyphs. Landscape rail and right telemetry use a restrained 0.012-radian rotation; progress uses 0.045 radians. Portrait and compact layouts remain level, including ascent/descent totals. Compact right telemetry sits higher to maintain separation from the progress details. Geometry contrast under-strokes are narrower. Existing contours remain to preserve readability over footage.

The Ghost Run browser suite checks undistorted, orthogonal glyph transforms and level portrait typography alongside bounds, collisions, contrast and preview/export parity. All six tests passed after this correction; build and lint passed.

## Independent first-principles review, 2026-10-02

Two isolated reviews identified bright-footage contrast, equal metric emphasis, small secondary text, dispersed portrait terrain data, and inconsistent landscape angles. This update supersedes earlier styling details: pace retains full value size, other rail values use 88% when pace is enabled (compact two-column layouts retain equal size). Portrait rows have tighter spacing. Labels and units have a 13px portrait floor before extreme-value fitting; bpm no longer receives an additional 15% reduction.

Text uses a contrasting glyph contour plus a soft, downward-offset glyph shadow; no panel or scene dimming. Elevation values use the same foreground as other measurements, with cyan reserved for route/status graphics. Portrait elevation and grade sit immediately above the progress region. The progress caption uses medium weight, its profile has a stronger minimum stroke, and all landscape blocks share a 0.012-radian rotation. Portrait/compact remain level.

Validation: build and lint pass; six Ghost browser tests pass including 1,728 layout combinations, palette visibility, and preview/export parity. Ghost visual baseline refreshed in an additional passing test. Two bounded render batches inspected with real-footage composites and solid palette cases. Detector returns zero findings but does not establish Canvas contrast compliance. Native browser detector injection unavailable (read-only evaluation).

## Fresh independent review, 2026-10-02

Two isolated assessments of current source and fresh browser renders found three defects: missing pace exposed `NaN:NaN`, terrain totals were too small on ordinary landscape video, and the diagonal pace separator lacked strength on textured bright footage. All three are resolved. The existing open composition remains appropriate to the footage.

Unavailable/non-finite pace and elapsed values display `N/A`; negative pace is also rejected. Landscape progress occupies up to 29% of width or 52% of the shorter dimension. Its caption starts at no less than 12px; ordinary landscape ascent/descent start at no less than 11px, with measured text space reserved before chart allocation. Extreme content remains fitted to the frame. The profile and pace separator use stronger protected strokes. Clock behavior is unchanged; its comment now accurately describes renderer-local time without asserting the athlete's original timezone.

Validation for these changes: build/typecheck and lint pass, 42 focused unit tests pass, eight Ghost Chromium tests pass, and the Ghost visual baseline was refreshed in a passing focused run. New tests assert missing/non-finite values and terrain type floors. Existing 1,728 combinations and preview/export parity pass. Native browser inspection covered seven states, followed by two bounded post-edit capture batches. New evidence uses synthetic telemetry over a local DJI footage frame; it does not establish video synchronization or every metric's contrast over moving footage. Captures: `.impeccable/review/ghost-fresh-landscape.png`, `ghost-fresh-portrait.png`, `ghost-fresh-missing.png`.

The Impeccable runtime runs with `IMPECCABLE_HOME=/private/tmp/telemetriq-impeccable` in the restricted environment. Its completed-change detector returned zero findings. Temporary browser harness/media were removed before the production build. The all-template visual test lacks four unrelated baselines; its original source was restored after the focused Ghost update.

## Heart badge alignment, 2026-10-02

The heart/bpm group beside the pulse value was inconsistent: the painted heart edge sat against the digits (the nominal gap was consumed by the path's anchor inset), bpm started at the heart's anchor rather than its painted left edge, and it dropped below the row baseline. This supersedes the badge geometry described above.

Heart and bpm now form one badge column: a shared painted left edge on the rail's standard unit gap (the same 0.16 value-size step that separates `km` and `m` from their values), the heart stacked tightly above the unit (2px floor), the unit lowered onto the value baseline like every other rail unit, and the painted heart kept inside the value's cap-to-baseline band. The heart is 0.30 value sizes; its painted box is about 1.03 × 0.96 of that size — curve bounds, not the control-point bounds the old anchoring used. Fit-time width reservation now matches the drawn badge column.

Validation: eight focused unit tests assert the contract against the painted bezier bounds computed independently from the captured path — flush left edge with bpm, unit gap and baseline parity with km, tight in-band stacking, badge removal with the metric toggle; a mutation restoring the control-point anchoring fails three of them. The Ghost Chromium suite passes all nine tests, including the cross-session heart/bpm contract test and the 1,728 layout combinations. Build/typecheck and lint pass; the Impeccable detector reports zero findings.

Evidence (Playwright/Chromium captures of the Canvas renderer, synthetic telemetry over solid grounds — review captures, not generated artwork): `.impeccable/review/ghost-heart-rail.png`, `ghost-heart-badge-landscape.png`, `ghost-heart-badge-portrait.png`, `ghost-heart-badge-shallow.png`. The heart's optical center sits slightly above the value's mid-height because the unit's ink ascent plus the stack gap consume the lower band; the pinned reference stacks the same way (heart above, bpm below, bottom-aligned to the value baseline).
