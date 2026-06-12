---
version: "alpha"
name: Telemetriq
description: Design system for a sports telemetry video editor — dark-first, precision-instrument app chrome with expressive, data-first overlay templates for runners, cyclists, and trail athletes.
colors:
  primary: "#646cff"
  primary-hover: "#535bf2"
  success: "#4caf50"
  error: "#f44336"
  warning: "#ff9800"
  warning-text: "#ffcc80"
  warning-surface: "#3a2a12"
  bg: "#0a0a0a"
  bg-secondary: "#141414"
  bg-tertiary: "#1e1e1e"
  bg-hover: "#2a2a2a"
  border: "#333"
  text: "#ffffffde"
  text-secondary: "#999"
  status-auto: "#36b37e"
  status-manual: "#ff9f43"
  overlay-text: "#ffffff"
  overlay-scrim: "#000000"
  trail-accent: "#ff3b30"
  cycling-accent: "#00e676"
  cycling-accent-strong: "#00c853"
typography:
  ui-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif'
    fontSize: 1.3rem
    fontWeight: 600
    lineHeight: 1.3
  ui-body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif'
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  ui-label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif'
    fontSize: 0.85rem
    fontWeight: 500
    lineHeight: 1.4
  ui-code:
    fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace'
    fontSize: 1.35rem
    fontWeight: 500
    letterSpacing: "-0.01em"
  ui-label-caps:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    fontSize: 0.65rem
    fontWeight: 500
    letterSpacing: "0.08em"
    textTransform: uppercase
  overlay-mono:
    fontFamily: '"SFMono-Regular", "Roboto Mono", Menlo, monospace'
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.1
  overlay-sans:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.2
  overlay-number:
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 3rem
    fontWeight: 300
    lineHeight: 1
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    typography: "{typography.ui-label}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1.5rem"
    height: 44px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.overlay-text}"
    typography: "{typography.ui-label}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.text}"
    typography: "{typography.ui-label}"
    rounded: "{rounded.md}"
    padding: "0.6rem 1.5rem"
    height: 44px
  card:
    backgroundColor: "{colors.bg-secondary}"
    borderColor: "{colors.border}"
    textColor: "{colors.text}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.lg}"
    border: 1px
    padding: 16px
  input:
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.text}"
    typography: "{typography.ui-body}"
    borderColor: "{colors.border}"
    rounded: 6px
    padding: "0.6rem 0.75rem"
  input-focus:
    borderColor: "{colors.primary}"
  select:
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.text}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.md}"
    height: 40px
  range-track:
    backgroundColor: "{colors.bg-tertiary}"
    height: 4px
    rounded: 2px
  range-thumb:
    backgroundColor: "{colors.text}"
    size: 14px
    border: "2px solid {colors.bg}"
  status-dot:
    size: 6px
    rounded: 50%
  status-dot-auto:
    backgroundColor: "{colors.status-auto}"
    boxShadow: "0 0 6px rgba(54,179,126,0.5)"
  status-dot-manual:
    backgroundColor: "{colors.status-manual}"
    boxShadow: "0 0 6px rgba(255,159,67,0.5)"
  warning-block:
    backgroundColor: "{colors.warning-surface}"
    textColor: "{colors.warning-text}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.lg}"
    padding: 16px
  metric-toggle-locked:
    backgroundColor: "{colors.bg-tertiary}"
    textColor: "{colors.text}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.md}"
    padding: 12px
  metric-toggle-disabled:
    backgroundColor: "{colors.bg-secondary}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.ui-body}"
    rounded: "{rounded.md}"
    padding: 12px
  trail-run-overlay:
    backgroundColor: "{colors.overlay-scrim}"
    textColor: "{colors.trail-accent}"
    typography: "{typography.overlay-mono}"
    rounded: "{rounded.sm}"
    padding: 12px
  cycling-pro-overlay:
    backgroundColor: "{colors.overlay-scrim}"
    textColor: "{colors.cycling-accent}"
    typography: "{typography.overlay-sans}"
    rounded: "{rounded.sm}"
    padding: 12px
---

## Overview

Telemetriq is a **dark-first sports telemetry tool** — a single-page web application for aligning GPX tracks with video footage and rendering performance overlays. The product combines two visual planes that must work together without being confused:

1. **App chrome** — upload, preview, sync, settings, export; neutral, legible, editing-oriented. Reads like a **precision instrument panel**: near-black surfaces, a single electric-indigo primary accent (`#646cff`), and monospace readouts for timing data.
2. **Overlay canvas** — footage-bound telemetry graphics rendered by Canvas 2D; expressive, sport-specific, but always subordinate to video readability.

**Design north star:**
- **Chrome recedes** — the video preview and telemetry data are the heroes; UI surfaces sit behind them in dark, low-contrast tones.
- **One accent, used sparingly** — `#646cff` drives all interactive moments: primary buttons, focus rings, slider highlights, toggle states. Overlay templates use their own dedicated sport-specific accents.
- **Precision matters** — timing offsets are displayed in monospace at larger sizes (1.35rem), evoking a chronograph instrument readout.
- **No decoration in chrome** — no background gradients, no decorative shadows on UI panels. Depth comes from subtle borderlines and surface layering.
- **Overlay templates may be expressive, but each template behaves like a single visual system.** Do not mix unrelated accent families inside one overlay.

## Colors

Telemetriq uses a **split color system**:

- **Neutral product surfaces** for editor UI — a dark monochrome with a single chromatic accent.
- **Single-purpose overlay accent colors** for template identity — trail and cycling each have one controlled accent family.

### Product Chrome (Dark Mode — default)

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#646cff` | Primary buttons, focus rings, active slider elements, toggle states |
| `primary-hover` | `#535bf2` | Button hover darkening |
| `success` | `#4caf50` | Download complete, sync auto-dot background |
| `error` | `#f44336` | Error text, cancel buttons, processing failure |
| `warning` | `#ff9800` | Warning indicators, manual sync state |
| `warning-text` | `#ffcc80` | Light warning text (dark-mode safe) |
| `warning-surface` | `#3a2a12` | Warning block background |
| `bg` | `#0a0a0a` | Page background — the canvas |
| `bg-secondary` | `#141414` | Card/panel surfaces |
| `bg-tertiary` | `#1e1e1e` | Input fields, secondary interactive surfaces |
| `bg-hover` | `#2a2a2a` | Hover state for interactive elements |
| `border` | `#333` | Default borders on cards, inputs, buttons |
| `text` | `#ffffffde` | Primary body and heading text |
| `text-secondary` | `#999` | Labels, hints, muted metadata |
| `status-auto` | `#36b37e` | Auto-sync status dot |
| `status-manual` | `#ff9f43` | Manual-sync status dot |

### Product Chrome (Light Mode)

Driven by `@media (prefers-color-scheme: light)` in `frontend/src/style.css`:

| Token | Light Value |
|-------|-------------|
| `bg` | `#ffffff` |
| `bg-secondary` | `#f5f5f5` |
| `bg-tertiary` | `#ebebeb` |
| `bg-hover` | `#e0e0e0` |
| `border` | `#ddd` |
| `text` | `#213547` |
| `text-secondary` | `#666` |

Primary, success, error, and warning remain unchanged across themes.

### Overlay Accents

| Token | Hex | Usage |
|-------|-----|-------|
| `overlay-text` | `#ffffff` | Primary overlay text |
| `overlay-scrim` | `#000000` | Scrim / backdrop for overlay elements |
| `trail-accent` | `#ff3b30` | Trail Run identity — trace, stat labels, hit regions |
| `cycling-accent` | `#00e676` | Cycling Pro primary metric color |
| `cycling-accent-strong` | `#00c853` | Cycling Pro emphasis / threshold |

**Color rules:**
- App chrome must stay neutral; overlays carry personality.
- `trail-accent` is reserved exclusively for Trail Run template.
- `cycling-accent` / `cycling-accent-strong` are reserved exclusively for Cycling Pro template.
- Never mix unrelated accent families inside a single overlay.
- Text and UI states must meet WCAG AA contrast thresholds (4.5:1).
- Over video, contrast comes from **local scrims, fades, and shadow discipline**, not arbitrary extra colors.
- Never use raw hex values in component styles — always reference `var(--color-*)`.

## Typography

Telemetriq has **two typography layers** that never mix:

### UI Chrome (DOM — Vue components)

- **Body**: System font stack — `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif` at `1rem` base, `line-height: 1.5`.
- **Code/Monospace (timing values)**: `"SF Mono", "Fira Code", "Cascadia Code", "JetBrains Mono", Consolas, monospace` at `1.35rem`, `font-weight: 500`, `letter-spacing: -0.01em`. Used exclusively in SyncSlider offset readout.
- **Labels**: Same system stack, `0.65rem`–`0.75rem`, `font-weight: 500`–`600`, `letter-spacing: 0.06em`–`0.08em`, uppercase.

**Type scale (UI chrome):**

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Page title (h1) | `2rem` | `700` | Upload view heading |
| Section heading (h2) | `1.3rem–1.8rem` | `600`–`700` | Preview, Result view titles |
| Card title (h3) | `0.9rem–1rem` | `600` | Card headers, sync section |
| Body | `0.85rem–1rem` | `400` | Descriptions, labels |
| Small / hint | `0.65rem–0.85rem` | `400`–`500` | Secondary info, helper text |
| Label / badge | `0.65rem–0.75rem` | `500`–`700` | Status badges, uppercase labels |
| Monospace readout | `1.35rem` | `500` | SyncSlider offset value |
| Root mobile | `14px` at ≤640px, `13px` at ≤480px | — | Controlled via `html { font-size }` |

### Video Overlay (Canvas — template engine)

Each template defines its own `fontFamily` via Canvas 2D `fillText()`. Common choices: `Inter`, `Space Grotesk`, `JetBrains Mono`, `DM Sans`, `Bebas Neue`, `Outfit`, `Instrument Serif`. See individual template files in `frontend/src/modules/templates/`.

| Token | Stack | Usage |
|-------|-------|-------|
| `overlay-mono` | `"SFMono-Regular", "Roboto Mono", Menlo, monospace` | Trail Run trace labels, precision text |
| `overlay-sans` | `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | Cycling Pro metrics, clean dashboard text |
| `overlay-number` | `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | Large metric values (3rem, weight 300) |

**Typography rules:**
- No custom web fonts are imported globally — the system font stack is sufficient for app chrome.
- Monospace is reserved for timing/tabular data only. Never use monospace for body text or headings.
- Overlay fonts must include fallback stacks — the Canvas 2D renderer relies exclusively on locally installed fonts.
- Use tabular or optically stable numerals wherever rapidly changing metrics appear.
- Large metric values can be bold in scale, but supporting labels and units must remain readable at a glance.

## Layout & Spacing

### Page Structure

All pages use a **centered single-column layout** with `margin: 0 auto`:

| View | Max-width | Layout |
|------|-----------|--------|
| Upload | `800px` | Focused file-upload flow |
| Preview | `1280px` | Two-column: video player (flex-1) + sidebar (340px) |
| Processing | `600px` | Centered progress indicator |
| Result | `700px` | Download/share single column |

**Preview workspace** (primary layout): `grid-template-columns: 1fr 340px; gap: 1.5rem`. Sidebar uses `position: sticky; top: 1rem`. At ≤1024px, collapses to single column with no sticky.

### Spacing

4px-based scale, applied as `rem` in CSS:

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px / `0.25rem` | Calendar cells, tight inline gaps |
| `sm` | 8px / `0.5rem` | Info grids, field labels |
| `md` | 12px / `0.75rem` | Checkbox groups, field rows, card sections |
| `lg` | 16px / `1rem` | Sidebar gaps, header, main section spacing |
| `xl` | 24px / `1.5rem` | Upload zone gaps, workspace grid gap |
| `xxl` | 32px / `2rem` | Page-level padding, upload zone padding |

**Padding patterns:** Cards/panels `1rem–1.5rem`, buttons `0.6rem 1.5rem`, inputs `0.6rem 0.75rem`, selects `0.6rem 3rem 0.6rem 0.75rem` (extra right for caret).

### Responsive Breakpoints

| Width | Effect |
|-------|--------|
| ≤1024px | Preview collapses to single column, sidebar loses sticky |
| ≤768px | Upload zones collapse to 1 column |
| ≤640px | Base font `14px`, buttons full-width, touch targets ≥44px, inputs `16px` |
| ≤480px | Base font `13px` |

### Overlay Safe Areas

- Top/left/right safe margin: ~4–5% of frame size.
- Bottom safe margin in preview: increase to account for native player controls when visible.
- Export can be slightly more aggressive, but preview must not misrepresent actual balance.

## Elevation & Depth

**Flat elevation model** — depth comes from surface layering and subtle borders, not shadows.

Surface hierarchy (dark mode):
1. Page background (`#0a0a0a`) — the canvas
2. Cards / panels (`#141414` + `1px solid var(--color-border)`) — elevated surfaces
3. Inputs / interactive (`#1e1e1e`) — recessed feel
4. Hover states (`#2a2a2a`) — temporary lift

**The only shadows in the system:**
- SyncSlider status dot glow: `box-shadow: 0 0 6px rgba(...)` — auto (green) or manual (orange).
- Button hover glow: subtle glow from accent on primary buttons.

Overlays should use shadows and fades only to preserve legibility over video, not as decoration.

## Shapes

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | `2px`–`4px` | Slider track, progress bar fill |
| `md` | `6px`–`8px` | Buttons, inputs, selects, toggle buttons |
| `lg` | `10px`–`12px` | Cards, panels, video preview |
| `xl` | `16px` | App shell containers |
| `pill` | `20px` / `999px` | Status badges, metric state chips |

**Shape rules:**
- Interactive elements use `6px`–`8px` — tight enough for precision, soft enough for comfort.
- Containers use `10px`–`16px` — visually distinct from inputs.
- Pills reserved for badges/chips only.
- Never mix significantly different radii within the same visual grouping.

## Components

### Buttons

**No shared `<Button>` component** — styled per-view using BEM modifier classes with consistent tokens.

| Variant | Background | Text | Border |
|---------|------------|------|--------|
| Primary | `var(--color-primary)` | `#fff` | none |
| Primary hover | `var(--color-primary-hover)` + gradient | `#fff` | none |
| Secondary | `var(--color-bg-tertiary)` | `var(--color-text)` | `1px solid var(--color-border)` |
| Cancel | transparent | `var(--color-error)` | `1px solid var(--color-error)` |
| Reset (SyncSlider) | transparent | `var(--color-primary)` | `1px solid var(--color-primary)` |

**States:** Hover (darken/lift by `translateY(-1px)`), active (`scale(0.96)`), focus-visible (`outline: 2px solid var(--color-primary)`), disabled (`opacity: 0.5; cursor: not-allowed`).

**Sizing:** Default `0.6rem 1.5rem` / `font-size: 0.9rem–1rem` / `radius: 8px`. Compact `0.35rem 0.55rem` / `0.7rem` / `6px`. All buttons `min-height: 44px` on mobile.

### SyncSlider (Precision Instrument Control)

The most distinctively styled component — a **chronograph instrument readout**:

- **Status indicator**: `6px` glowing dot (green=auto, orange=manual) + uppercase label.
- **Offset readout**: Right-aligned monospace at `1.35rem`, `500` weight. Format: `+1h 24m 40s` (≥1h), `+35m 23s` (≥1m), `+12.5s` (seconds).
- **Slider**: `4px` track, `14px` white circle thumb with `2px` dark border, `scale(1.15)` hover.
- **Range labels**: `0.65rem`, tabular-nums, min / center (auto-sync offset) / max.
- **Step buttons**: Compact with inline SVG icons (`14×14` viewBox, `currentColor`).
- **Container**: `1px solid var(--color-border)`, `radius: 10px`, `padding: 1.25rem 1.5rem`.

### Form Inputs

- **Select**: `appearance: none`, custom SVG caret via `--ui-caret` data-URI. Background `var(--color-bg-tertiary)`, `border-radius: 6px`, `padding: 0.6rem 3rem 0.6rem 0.75rem`. Border → primary on focus.
- **Text input**: Same surface/border, `padding: 0.6rem 0.75rem`.
- **Range slider**: Full WebKit/Moz vendor styling. Track `4px`, thumb `14px` circle.
- **Checkboxes**: `18×18px`, `accent-color: var(--color-primary)`, wrapped in `10px` radius containers.
- **Mobile**: Inputs forced to `font-size: 16px` to prevent iOS auto-zoom.

### Status Indicators

- **Status dots**: `6px` circles with subtle glow. Green (`#36b37e`) auto, orange (`#ff9f43`) manual. Transition `0.3s`.
- **Metric state badges**: Pills (`999px`), `0.66rem`, `700` weight, uppercase. Locked = purple-tinted, disabled = gray.
- **WebGPU badge**: `radius: 20px`, inline-flex. Active = translucent indigo, inactive = gray.

### Warnings & Errors

- **Warning block**: `background: var(--color-warning-surface)`, amber border, `radius: 8px`, `padding: 0.75rem–1rem`.
- **Error block**: `rgba(244,67,54,0.1)` background, red border.
- **Inline (SyncSlider)**: `#ffb74d` warning / `#f44336` error, `0.75rem` paragraph.

### Metric Toggles

Three states must remain visually distinct:
1. **Optional + available** — interactive checkbox
2. **Required / locked** — checked, visually active, not disabled-looking
3. **Unavailable** — muted and non-interactive

Required ≠ disabled. Locked is a supported state — do not borrow the same treatment as unavailable.

### Progress Bar

- Container: `var(--color-bg-secondary)`, `radius: 12px`, `padding: 1.5rem`.
- Track: `var(--color-bg-tertiary)`, `height: 6px`, `radius: 4px`.
- Fill: `linear-gradient(90deg, var(--color-primary), #7b82ff)`, transition `width 0.3s ease`.
- States: complete (green), error (red).

## Overlay Templates

### Trail Run

- **Aesthetic**: Editorial, minimal, alpine, top-weighted.
- **Color**: `trail-accent` (`#ff3b30`) — trace, labels, stat bands.
- **Typography**: `overlay-mono` for precision, map-like character.
- **Layout**: Top trace + three-column stat band.
- **Guardrails**: Trace, labels, and units must remain readable over bright footage. Use localized contrast support instead of turning the template into a thick opaque bar. Keep the template fast and clean — avoid ornamental UI paneling.

### Cycling Pro

- **Aesthetic**: Technical, performance-oriented, dashboard-like.
- **Color**: `cycling-accent` (`#00e676`) for primary metrics, `cycling-accent-strong` (`#00c853`) for emphasis.
- **Typography**: `overlay-sans` for clean metrics, `overlay-number` for large values (3rem, weight 300).
- **Layout**: Left telemetry stack + distance + speed dial.
- **Guardrails**: One green accent family only unless a true alert state exists. The left rail should frame information, not dominate the composition. Missing telemetry expressed as `N/A` or `NO DATA` — never a broken metric or long-lived `--`. The speed dial must account for preview-safe positioning (raise dial and/or add preview-only padding to avoid collision with native player controls).

## Icons

**Three-tier strategy** — no icon library:

1. **Unicode emojis**: Quick visual affordances (🏃 app, 🎬 video, 📍 GPX, ✅/❌ status, ⚡ GPU, 🐢 CPU). Rendered as text.
2. **Inline SVGs**: SyncSlider step buttons — `14×14` viewBox, `currentColor`, minus/plus/reset paths.
3. **CSS data-URI**: `--ui-caret` — single chevron-down SVG as `background-image`. Used on all `<select>` elements (replaces native arrow) and collapsible toggles (rotates 180° when open).

**Rules:** Never use emoji as structural UI icons in buttons or navigation. SVGs must use `currentColor`. The caret is the only CSS data-URI icon — do not add more.

## Motion

All animations are **CSS-only**, brief (150–300ms), GPU-composited via `transform`/`opacity`:

| Element | Duration | Property |
|---------|----------|----------|
| Button hover | — | `translateY(-1px)` lift |
| Button active | — | `scale(0.96)` press |
| Input/select focus | `0.2s` | `border-color` |
| Collapse toggle | `0.15s` | `background, border-color, transform` |
| Chevron rotate | `0.15s` | `transform: rotate(180deg)` |
| Slider thumb hover | `0.15s` | `transform, box-shadow` |
| Progress bar | `0.3s` | `width` |
| Status dot | `0.3s` | `background, box-shadow` |

**One keyframe**: `pulse-warning` — 2s infinite opacity pulse (1→0.6→1), ProcessingView "Tab in background" only.

**Rules:** Respect `prefers-reduced-motion` (globally `0.01ms !important`). Never animate `width`/`height`/`top`/`left` — only `transform` and `opacity`. One animation per view max. No decorative motion.

## Do's and Don'ts

### Do

- Use CSS variables for all colors. Exceptions: status dot glows, warning text `#ffb74d`.
- Use BEM naming with component prefix (`sync-slider__dot--auto`).
- Use `<style scoped>` in every Vue SFC.
- Use monospace for timing/tabular data only.
- Use `<button>` and `<input>` — no `<div>` custom controls.
- Leverage `prefers-color-scheme` for light mode.
- Respect `prefers-reduced-motion`.
- Mobile-first: test at 375px, touch targets ≥44px, inputs at 16px.
- Keep app chrome neutral and overlays expressive.
- Keep the primary accent (`#646cff`) scarce — interactive moments only.
- Surface through contrast, not shadows.
- Keep preview behavior trustworthy relative to export.
- Treat locked metrics as a supported state — not a degraded one.
- Test templates on both bright and dark footage.

### Don't

- Don't add new colors without a CSS variable token first.
- Don't use emojis as structural icons in buttons or navigation.
- Don't add a second accent color to app chrome — status colors are semantic, not decorative.
- Don't mix unrelated accent families inside a single overlay template.
- Don't use custom web fonts globally.
- Don't add decorative shadows on cards/buttons.
- Don't animate more than one element per view.
- Don't define shared `<Button>`/`<Input>` abstractions — style inline per component.
- Don't import icon libraries.
- Don't hardcode light-mode colors — always test both themes.
- Don't use `width`/`height` animation.
- Don't rely on low-opacity white over bright footage in overlays.
- Don't let preview controls collide with critical overlay elements.
- Don't use `--` as the only missing-data indicator when `N/A` or `NO DATA` is clearer.

## Token Architecture

Telemetriq follows a three-layer token model:

### Primitive tokens
Raw values: dark/light surfaces, base radii, spacing units, trail and cycling accent colors.

### Semantic tokens
Purpose-based roles: `primary`, `bg-secondary`, `bg-tertiary`, `text`, `text-secondary`, `warning`, `error`, `success`, `trail-accent`, `cycling-accent`.

### Component tokens
Per-component mappings in the YAML front matter: `button-primary`, `card`, `input`, `select`, `warning-block`, `metric-toggle-locked`, `trail-run-overlay`, `cycling-pro-overlay`.

**Rule:** New UI work should prefer semantic or component tokens over hardcoded values in component files.

## Source of Truth & File Map

| File | Role |
|------|------|
| `frontend/src/style.css` | Global CSS variables, typography baseline, light-mode overrides, caret token |
| `frontend/src/modules/templates/types.ts` | Template contract, default capabilities |
| `frontend/src/modules/templates/registry.ts` | Canonical template registry |
| `frontend/src/modules/templates/*.ts` | Template identity, preview colors, overlay defaults |
| `frontend/src/views/PreviewView.vue` | Main editor UI, settings, warnings, action hierarchy |
| `frontend/src/components/SyncSlider.vue` | Precision sync offset control with instrument aesthetic |
| `frontend/src/components/VideoPlayer.vue` | Video preview plane and overlay rendering surface |
| `frontend/src/components/TemplateSelector.vue` | Template selection and select styling |
| `frontend/src/modules/layouts/trailRunLayout.ts` | Trail Run visual algorithm |
| `frontend/src/modules/layouts/cyclingProLayout.ts` | Cycling Pro visual algorithm |
| `frontend/src/modules/layouts/speedometerGauge.ts` | Cycling Pro dial geometry |

## Current Product Priorities

### P0 — Readability & Trust

1. **Strengthen Trail Run contrast on bright footage**: increase label/unit contrast, strengthen scrim/fade, thicken trace. Files: `trailRunLayout.ts`, `trailRun.ts`.
2. **Normalize Cycling Pro color system**: remove hardcoded red unit labels, use one green-led accent family. Files: `cyclingProLayout.ts`, `cyclingPro.ts`.
3. **Fix preview-safe speed dial positioning**: raise dial and/or add preview-only safe padding to avoid native controls collision. Files: `VideoPlayer.vue`, `cyclingProLayout.ts`.

### P1 — Hierarchy & States

4. **Separate locked and unavailable metric states**: required must look active, unavailable must look muted. File: `PreviewView.vue`.
5. **Replace weak missing-data placeholders in Cycling Pro**: `N/A` or `NO DATA` over `--`. Files: `cyclingProLayout.ts`, `PreviewView.vue`.
6. **Improve warning readability**: stronger contrast, better grouping. File: `PreviewView.vue`.

### P2 — Polish & Consistency

7. **Reduce left-side visual mass in Cycling Pro portrait**: narrow backdrop, rebalance spacing. Files: `cyclingProLayout.ts`, `speedometerGauge.ts`.
8. **Replace emoji with consistent SVG icon family in product chrome**. File: `PreviewView.vue`.
9. **Consolidate caret styling**: one canonical select-caret implementation. Files: `PreviewView.vue`, `TemplateSelector.vue`.

## Agent Prompt Guide

### Quick Color Reference

```
Page bg:    var(--color-bg)             = #0a0a0a dark / #fff light
Card bg:    var(--color-bg-secondary)   = #141414 dark / #f5f5f5 light
Input bg:   var(--color-bg-tertiary)    = #1e1e1e dark / #ebebeb light
Primary:    var(--color-primary)        = #646cff (same in both themes)
Text:       var(--color-text)           = #ffffffde dark / #213547 light
Text muted: var(--color-text-secondary) = #999 dark / #666 light
Border:     var(--color-border)         = #333 dark / #ddd light
Trail:      var(--color-trail-accent)   = #ff3b30
Cycling:    var(--color-cycling-accent) = #00e676
```

### Starting Prompt

```
Use the DESIGN.md in the project root. This is a dark-first sports telemetry app.
Build a neutral editor shell using CSS variables and BEM naming. Add overlay-specific
personality only where the feature touches the video overlay canvas. Use the single
primary accent (#646cff) for app CTAs. Use trail-accent only for Trail Run and
cycling-accent only for Cycling Pro. Keep app chrome neutral, overlays expressive.
Prefer clean cards, strong spacing, and restrained depth over flashy effects.
```
