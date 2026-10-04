---
version: 1
slug: "frontend-src-modules-layouts-ghostrunlayout-ts"
primary_target: "frontend/src/modules/layouts/ghostRunLayout.ts"
related_targets: ["frontend/src/modules/templates/ghostRun.ts", "frontend/src/modules/ghostRunRoute.ts", "frontend/src/modules/trailRunFonts.ts", "frontend/e2e/ghost-run-layout.spec.ts"]
---

# Ghost Run overlay

Scope: the existing selectable Ghost Run Canvas overlay. Mode: Experience. The athlete's footage leads; telemetry stays at the edges. Original reference: `docs/references/ghost-overlay.jpg`. The user confirmed HUD only, without the central runner. On 2026-10-04 the user requested an experiment replacing decorative lines with compact dark translucent blocks, soft corners and a cyan accent. Their subsequent feedback accepted the material but found it bland and identified inconsistent padding and alignment inside all panels; the current refinement addresses that spacing and adds a restrained pace accent.

This is an ordinary extension of the incumbent Canvas template system. `DESIGN.md` remains the authority for product chrome and the global visual system. The choices below belong to Ghost Run only.

## Direction contract

**THESIS:** Keep the open running HUD and its edge hierarchy while giving each telemetry group compact translucent backing. The left metric rail, route map and bottom-right route progress stay recognizable; the footage's center stays open.

**OWN-WORLD:** White condensed sans numerals, quieter white labels and units, dark translucent panels with soft corners and subtle pale cyan edges, cyan route/progress graphics and a coral heart. A fine cyan segment follows the pace panel's upper-right corner. Use bundled Barlow Semi Condensed at 600 for values and 500 for labels and units. All HUD blocks stay level. Thin contrasting contours support the ink; panels use flat fill without decorative shadows or blur.

**STORY:** Read current pace, distance, elapsed time and heart rate, locate progress on the imported track, and understand its elevation. Missing measurements remain explicit; comparison and weather are omitted without source data.

**FIRST VIEWPORT:** Landscape left rail begins near 5% width and 12% height, with one panel per metric and a matching route panel below. The clock, live elevation/grade and bottom-right progress/profile summary have the same backing. The left bracket is removed, and distance progress is a filled rounded bar. Center stays clear. Portrait uses larger relative type, a shared right margin and a wide bottom progress block; elevation/grade sits above it with a visible gap. Shallow landscape reflows the four metrics into two columns and two rows.

**FORM:** The original user-pinned reference establishes the telemetry composition. The user-confirmed panel experiment updates its material and decorative geometry for this surface only. Render directly in Canvas; this extension does not establish a new global visual world. Earlier launcher limitations and review results remain recorded in the dated history below.

**FINISH:** Record the separate scoped review, current surface contract, validation evidence and capture provenance. Product/global design documents retain their existing authority. Ghost Run ships no raster artwork.

## Data semantics

Distances use the application's kilometers and pace uses minutes per kilometer. The clock renders absolute recording time as a zero-padded 24-hour clock in the renderer's local time zone; the timestamp alone does not identify the athlete's original time zone. It prefers the frame timestamp, falls back to route start plus frame offset, and disappears without usable absolute time. The route and elevation profile represent the complete imported activity; progress and position follow the synchronized telemetry frame. Elevation gain/loss describe the full recorded track. They are not comparison or planned-route values.

- **ELAPSED** includes pauses and uses total recording time, rather than moving time. The preview Time helper explains this template-specific behavior.
- The route keeps the imported track's aspect ratio. The current marker follows recording time, so loops and stationary samples remain unambiguous. The drawing trace is bounded to 384 points; elevation sampling retains local extrema instead of smoothing out narrow hills.
- Missing or non-finite pace, elapsed time, heart rate, elevation or grade readings display `N/A`; negative pace is rejected. Route geometry, the elevation profile and gain/loss appear only when their source data supports them. Missing elevation samples break gain/loss accumulation across that segment.
- The right block shows live elevation and grade, or grade alone when elevation is disabled. Weather, a previous-run comparison and split delta are omitted because the current import flow has no source for them.

## Colors

The template owns a small local palette in `GHOST_RUN_COLORS`, without adding global CSS tokens:

| Role | Implemented value | Use |
| --- | --- | --- |
| Soft white | `#F7FBFA` | Metric values, supporting text and route trace |
| Pale cyan | `#7DE6E3` | Subtle panel edges, current-position marker, grade status dot, progress and profile |
| Coral | `#FF5B72` | Drawn heart beside the heart-rate value |
| Dark contour | `#152321` | Local text and geometry contrast support |
| Dark panel | `#0F1B1E` | Local translucent backing for telemetry groups |

Template configuration supplies text and accent overrides. The heart retains its semantic coral color. Panel backing adapts to dark custom ink without changing that foreground. No palette choice here changes the editor's indigo primary accent.

## Typography

Use the bundled Barlow Semi Condensed faces: values at weight 600; labels, units, recording clock and profile details at weight 500. The shared font loader awaits both faces before Canvas measurement and rendering; the faces carry tabular numeral settings.

The rail scales from the shorter frame dimension and the template's size controls. Fit all visible rail metrics together using measured text and realistic reserved numeric widths; the widest visible or reserved group determines their shared panel width. Pace retains the full value size, while other rail values use 88% when pace is enabled; compact two-column layouts retain equal size. Portrait has a larger relative value scale, with 13px starting floors for rail labels and units and a 12px recording-clock floor. Bpm uses the same unit size without an additional reduction. Shallow landscape starts supporting rail text at 10px. Extreme content can reduce the shared fit. Values continue to scale proportionally through 4K instead of stopping at a fixed pixel cap.

Each rail value, separator and unit shares one level transform. Measure the actual ink ascent, descent and side bearings when placing content inside panels; advance width alone does not define a painted edge. The pace suffix remains a tall drawn slash followed by lowered `km`, retaining kilometer semantics. The heart/bpm badge keeps the shared painted left edge, standard unit gap and value-baseline alignment established in the latest heart correction below. The panel refinement leaves those geometry constants intact.

**The One Rail Rule.** Fit the rail as a complete type system; do not shrink individual metric values independently.

## Layout

Every edge group uses the same external frame inset: `12u` (6% of the shorter dimension, minimum 12px), measured at the panel's outer edge. The rail and route start at that inset; clock, elevation/grade and summary end at the mirrored right inset. Content sits another `4u` inside each panel. The clock also uses the frame inset above its panel. The default landscape rail starts at 12% of frame height. Pace, distance, elapsed time and heart rate each occupy a separate compact panel; the route uses matching backing below the rail. A recording clock sits at top right; live elevation/grade occupies the right edge; current/total distance, progress, elevation profile and full-activity ascent/descent share the bottom-right summary panel. The athlete's center remains clear.

Rail, route, right telemetry and progress use level rigid transforms, with no perspective compression, shear or rotation. Preserve the route's aspect ratio within its panel. Functional route and elevation-profile lines remain; decorative bracket geometry is removed.

Portrait keeps the same edge hierarchy. The rail content begins at about 8% of width and the panel begins at 11% of frame height. Elevation labels, units, grade, recording clock and ascent/descent totals align their visible ink to the common right content inset (`16u`, normally 8% of the shorter dimension). The progress panel spans the frame between equal left and right external insets, with a level baseline at 86% of frame height. Landscape uses an 82.5% baseline. Portrait elevation is raised above the lower summary to preserve the gap between their panels.

Landscape below 240px high reflows visible rail metrics into up to two columns, retaining readable support text and widening the progress/profile block. Metric toggles remove their corresponding rendered content; supported metrics are pace, distance, time, heart rate, elevation and grade.

All panels share one local spacing unit (`u = max(1px, 0.5% of the shorter frame dimension)`): padding is `4u`, label/value gaps and the space above the grade row are `3u`, other internal gaps are `2u`, and rail/compact-column gaps are `3u`. Panel heights follow measured content plus padding. Stack rail panels from their finished edges; compact cells use the row's maximum content height and columns advance by panel width plus the shared gap. Labels share the same painted left inset. Stable numeric reserve widths keep changing readings from moving the rail.

The clock uses its measured ink inside the same padding. Right telemetry retains the common painted right edge, measured stacking and numeric/grade reserves. The route reserves marker clearance while retaining the imported aspect ratio. The summary measures its distance caption at the actual fitted font with an explicit suffix gap, allocates distance/profile content in a common measured row, and aligns ascent/descent to the content's top and bottom.

**The Portrait Edge Rule.** Align the painted right-side text to one safe outer margin; aligning only a containing block does not preserve the reference's edge rhythm.

## Elevation & Depth

Flat local panels provide contrast while the footage between them remains open. Default light ink uses dark backing at alpha 0.64; pace backing is emphasized at 0.76. Recognized three- or six-digit hex text colors with relative luminance below 0.25 receive soft-white backing at alpha 0.86. Unrecognized color formats use the default dark backing. Accent borders use alpha 0.16, or 0.32 for pace. Background-opacity and gradient controls remain unavailable for this template; these panels are part of its layout.

The text-shadow control enables thin glyph contours and geometry under-strokes. For recognized three- or six-digit hex colors, the renderer compares foreground and requested contour: below a 3:1 ratio it substitutes soft white for dark ink, or the dark contour for lighter ink. Otherwise it retains the requested contour. Canvas shadows, blur and offsets are zero. No full-frame dim layer is drawn.

**The Local Contrast Rule.** Keep contrast support within each telemetry group and preserve the open footage between HUD elements.

## Shapes

Panels have soft corners using the shared spacing scale (radius `2u`, capped by half their width and height). The pace panel's fine upper-right cyan corner segment adds restrained emphasis. The distance bar has a muted rounded track and a cyan fill proportional to current/total distance. Fine route and profile strokes, small circular position markers, the pace separator and a drawn coral heart retain their functional roles. These are Canvas paths; the reference photograph and a runner illustration are not embedded in the shipping overlay.

## Panel spacing refinement validation and finish, 2026-10-04

External-margin follow-up: replaced the width-based left anchor and text-based right anchor with the shared `12u` panel frame inset. Bounds assertions cover all 1,728 metric/size/style configurations and 12 normal/missing-data cases across six sizes; clock/right ink alignment is also checked through portrait and landscape 4K. The previous renderer failed the new external-inset assertions. All 10 Ghost Chromium tests, 41 focused heart/clock unit tests, build/typecheck and lint passed. Updated the clock's former flush-edge unit-test contract to the shared inset plus padding, including its minimum-size allowance in shallow frames. Refreshed the Ghost visual baseline in a passing focused test and restored its original source. Final landscape, portrait and shallow captures (`ghost-margin-final-{landscape,portrait,shallow}.png`) were inspected with the same local DJI still and synthetic fixture. These captures supersede earlier evidence for external margins.

User follow-up: increased label/value clearance and the space above `% grade` from `2u` to `3u`. Focused geometry assertions first failed on the previous spacing across all five normal/missing-data sizes, then passed with the new gaps. All 10 Ghost Chromium tests, 41 focused heart/clock unit tests, build/typecheck and lint passed. The Ghost visual baseline was refreshed in a passing focused test and its original test source restored. Final landscape and portrait captures (`ghost-spacing-final-{landscape,portrait}.png`) were inspected; they use the same local 8-second DJI still and synthetic fixture. This follow-up changes measured vertical spacing only and supersedes the earlier captures for those gaps.

Finish disposition: **ship**, scoped to padding, alignment, content-based panel sizing, rail rhythm and the pace corner accent. A fresh separate reviewer opened both before captures and all six after captures and found no material defects. The character remains deliberately delicate; stronger emphasis is a taste choice. The documenter checked the current spacing/panel implementation, focused browser test contract, evidence manifest and product/global context. This refinement preserves the first experiment's dark flat material, footprint and topology, the existing pace hierarchy and heart/bpm contract.

Validation recorded in `.impeccable/review/ghost-refined-evidence.json`: build/typecheck and lint passed; 41 focused heart/clock unit tests and all 10 Ghost Chromium tests passed. The existing 1,728 configurations pass alongside 10 new normal/missing-data cases across five sizes, measuring content margins in all eight panel roles, vertical balance, label edges, rail/column gaps and distance-caption clearance. Restoring the previous panel renderer failed on measured margins, vertical balance and rail/column gaps across all five sizes; the corrected renderer passed. Pre/post layout detector results were `[]`, with the existing Canvas coverage limit. Only the Ghost visual baseline was refreshed in a passing focused test, its original test source was restored, and the baseline's embedded origin was updated. No source corrections followed the visual captures.

Evidence: `.impeccable/review/ghost-refined-before-{landscape,portrait}.png`, `ghost-refined-after-{landscape,portrait,square,shallow,missing,dark}.png`, `ghost-refined-evidence.json` and `ghost-refined-comparison.html`. All captures carry embedded origins. They use the same local DJI frame extracted at 8 seconds with macOS AVFoundation, synthetic telemetry/circular route, and `brightness(0.22)` on footage for the dark case. They establish the scoped static review, without video/telemetry synchronization, moving-footage or separate 4K visual approval. Product/global design documentation and its recorded drift retain their existing status; the dated sections below preserve the earlier verification provenance.

## First panel experiment validation and finish, historical 2026-10-04

Finish disposition: **ship**, scoped to the changed panels, typography fitting and placement in this experiment. A fresh separate reviewer opened the two before captures and all six final captures and found no material defects in the changed surface. This does not establish approval for every footage color, moving scene or export size.

Implementation validation recorded in `.impeccable/review/ghost-panels-evidence.json`: production build/typecheck and lint passed; 41 focused heart/clock unit tests and all nine Ghost Chromium tests passed after cleanup. The 1,728 layout combinations cover bounds and text collisions, with panel alpha and portrait elevation/progress separation checked in the Ghost suite. The focused Ghost visual test passed after refreshing its baseline; its original test source was restored and only the Ghost snapshot changed. The completed-change detector returned `[]` on the changed TypeScript targets; that source scan does not establish Canvas contrast compliance.

At that finish, the documenter checked the then-current renderer/template contract, product/global context, evidence manifest, all eight captures and their embedded `impeccable:prompt` origins:

| Capture | Dimensions | Purpose |
| --- | --- | --- |
| `.impeccable/review/ghost-panels-before-landscape.png` | 960 × 540 | Original renderer comparison |
| `.impeccable/review/ghost-panels-before-portrait.png` | 390 × 844 | Original renderer comparison |
| `.impeccable/review/ghost-panels-after-landscape.png` | 960 × 540 | Final landscape panels |
| `.impeccable/review/ghost-panels-after-portrait.png` | 390 × 844 | Final portrait placement and panel gap |
| `.impeccable/review/ghost-panels-after-dark.png` | 960 × 540 | Dark footage contrast case |
| `.impeccable/review/ghost-panels-after-shallow.png` | 884 × 151 | Compact reflow |
| `.impeccable/review/ghost-panels-after-square.png` | 640 × 640 | Square composition |
| `.impeccable/review/ghost-panels-after-missing.png` | 320 × 568 | Explicit missing measurements |

The self-contained comparison is `.impeccable/review/ghost-panels-comparison.html`. Captures use a local DJI frame extracted at 8 seconds with macOS AVFoundation and synthetic telemetry/circular route for identical before/after comparison. The dark case applies `brightness(0.22)` to the footage only. These are browser captures, without generated artwork or a claim of video/telemetry synchronization.

At that finish, the visual baseline, `frontend/e2e/templates-visual.spec.ts-snapshots/template-ghost-run-chromium-darwin.png` (884 × 151), carried an `impeccable:prompt` text chunk identifying the October 4 panel experiment and the synthetic Playwright preview fixture. It has since been refreshed for the spacing refinement above. The reference image and review captures are evidence, not shipping overlay artwork.

This contract records the user-confirmed experiment for Ghost Run. It does not promote these local panels, colors or composition into the global design system. Pre-existing documentation drift remains recorded below. The dated October 2 sections retain their original verification provenance; their superseded no-panel, bracket, shadow and rotation descriptions are historical.

## Validation and finish, historical 2026-10-02

Finish disposition: **ship**, scoped to the resolved portrait alignment, shallow-frame readable reflow and corrected pace-suffix alignment. The reviewer observed no regressions across the 12 final recaptures. This records the reviewed fixes, not universal approval for every footage color or export size.

Implementation validation completed on 2026-10-02: build and lint passed; unit tests reported 874 passed and 9 skipped; the full Chromium suite reported 58 passed and 4 skipped out of 62 tests in 36.4 seconds. All six focused Ghost Run browser tests passed.

`frontend/e2e/ghost-run-layout.spec.ts` covers 1,728 configurations: nine frame sizes, all 64 metric-toggle combinations and three size/style variations, checking transformed logical text bounds/collisions and path bounds. It also checks missing-data behavior, center transparency, editor selection, Canvas preview/video-frame export parity, portrait right edges and proportional pace type through portrait and landscape 4K. Twenty-four painted contrast cases combine two portrait sizes, six solid grounds and two ink palettes; they check the pace label's contrasting pixels and the pace value's size floor. They do not establish a contrast ratio for every metric over arbitrary moving footage. 4K is regression-tested, without a separate capture-based visual approval.

On 2026-10-02 the documenter checked that version's template, renderer, route builder, bundled font loader, product/global style context, focused test contracts, pinned reference and all 12 final captures:

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

At that review, the visual-regression baseline, `frontend/e2e/templates-visual.spec.ts-snapshots/template-ghost-run-chromium-darwin.png`, carried an `impeccable:prompt` PNG text chunk identifying Playwright capture after the perspective/portrait refinements, its synthetic preview fixture and the Canvas renderer. That baseline has since been refreshed for the October 4 experiment described above. It remains a test capture, not generated artwork. Ghost Run ships no raster artwork.

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
