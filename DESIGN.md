---
name: Serene Mint Health
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#56615b'
  on-tertiary: '#ffffff'
  tertiary-container: '#9aa59f'
  on-tertiary-container: '#313b36'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#dae5de'
  tertiary-fixed-dim: '#bec9c2'
  on-tertiary-fixed: '#141e1a'
  on-tertiary-fixed-variant: '#3f4944'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.25rem
  margin: 1.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies a modern, calming, and clinically trustworthy healthcare experience. Rooted in soft wellness aesthetics, it marries clinical precision with the warmth of boutique hospitality. 

### Design Philosophy
- **Tone:** Tranquil, approachable, lucid, and protective. It replaces the anxiety of medical software with soft, breathable space and confident, legible information architecture.
- **Style Archetype:** Soft Organic Minimalist. We utilize gentle tinted canvas backgrounds (soft mint and sage), crisp snow-white cards, generous rounded containers, and pill-formed navigation tokens.
- **Visual Motif:** Dual-toned soft containers, subtle 1px translucent borders, tactile pill toggles, and airy typographic scales that keep cognitive strain to an absolute minimum.

## Colors

The palette balances soothing mint tones against crisp white cards and deep slate typography for optimal legibility and peaceful aesthetic clarity.

### Functional Palette Mapping
- **Canvas / Background:** `#edf4f2` — A gentle, tinted cyan-mint backdrop that reduces screen glare and anchors floating white cards.
- **Card Surfaces:** `#ffffff` and `#f8fafc` — Crisp, luminous white surfaces that cleanly separate content modules from the tinted canvas.
- **Primary / Action Mint:** `#10b981` (Emerald / Mint) — Used for active indicators, affirmative statuses, and vital trend highlights.
- **Contrast / Ink:** `#0f172a` (Slate 900) — Primary text, primary CTA buttons, active pill navigation segments, and key data points.
- **Muted Surfaces & Highlights:** `#e2ede6` — Soft sage wash used for pill tabs, soft card inner callouts, and muted container backgrounds.
- **Subtle Accents:** Soft pastel washes (e.g., pale sky `#e0f2fe` for diagnostics, soft amber `#fef3c7` for medication alerts) applied sparingly behind card items to support visual categorization.

## Typography

Typographic treatments rely entirely on **Plus Jakarta Sans** to maintain approachable warmth, clean geometry, and high clinical readability across small metrics, graphs, and appointments.

### Hierarchical Guidelines
- **Headlines:** Use heavy weights (`700` and `600`) with tight letter-spacing (`-0.02em`) for dashboards and module headers, providing grounding and modern confidence.
- **Body & Data:** Keep body copy neutral (`#64748b` for labels, `#0f172a` for primary data) to create an effortless scan path.
- **Metric Micro-labels:** Small dates, calendar numerals, and measurement units should be set in `label-sm` or `body-sm` with tabular figure styling where numerical alignment is critical.

## Layout & Spacing

The layout is built around a structured, fluid grid system framed by generous outer margins that give clinical panels room to breathe.

### Grid & Composition Rules
- **Desktop:** 12-column grid layout with `1.25rem` (20px) gutters and `1.75rem` (28px) canvas margins. The typical dashboard partitions into an ergonomic sidebar (span 2 or 3), an expansive central clinical feed (span 6 or 7), and an auxiliary schedule/treatment rail (span 3 or 4).
- **Tablet:** 8-column layout collapsing auxiliary feeds beneath key primary parameter cards.
- **Mobile:** 4-column layout; modules reflow into a clean single-column vertical stack with fixed bottom pill navigation.
- **Inner Padding:** Cards utilize `space-lg` (24px) for comfortable internal breathing room, while compact line-item cards use `space-md` (16px).

## Elevation & Depth

Visual hierarchy avoids abrupt elevation steps or harsh drop shadows. Instead, depth is conveyed through translucent white planes, subtle multi-layered ambient glows, and tinted background contrast.

### Elevation Hierarchy
- **Level 0 (Backdrop):** Base ambient canvas in `#edf4f2`.
- **Level 1 (Surface Cards):** `#ffffff` surfaces layered directly on canvas with a diffuse soft shadow: `0 4px 20px -2px rgba(15, 23, 42, 0.04), 0 2px 6px -1px rgba(15, 23, 42, 0.02)`. Optional faint border `1px solid rgba(255, 255, 255, 0.8)`.
- **Level 2 (Active Cards & Floating Menus):** `0 10px 30px -4px rgba(15, 23, 42, 0.06), 0 4px 10px -2px rgba(15, 23, 42, 0.03)`.
- **Inner Recessed Items:** Sub-cards (such as appointment slots or medication rows) use soft-tinted fills (`#f1f5f9` or `#e2ede6`) with no shadow, keeping them grounded inside parent cards.

## Shapes

The design uses an overtly rounded, friendly visual language that softens clinical tension.

### Corner Treatment
- **Master Cards & Panels:** Configured with `rounded-2xl` to `rounded-3xl` (20px to 24px) for outer module perimeters.
- **Pills & Toggles:** Set to fully rounded pill radii (`rounded-full` / 9999px) for tabs, filter chips, metric badges, and interactive state indicators.
- **Inner Sub-containers:** Item rows, appointment cards, and avatar frames use `rounded-xl` (12px to 16px) to maintain nested proportional curvature.

## Components

### Buttons & Interactive Controls
- **Primary Buttons:** High-contrast `#0f172a` pill with crisp white text (`#ffffff`), centered icons, and generous horizontal padding (`1.5rem`).
- **Secondary / Action Pills:** Soft-tinted `#f1f5f9` or `#e2ede6` pill buttons with subtle dark slate text for secondary operations like "New Medication" or calendar pagers.
- **Icon Action Buttons:** Minimal rounded squares or full circles (`40x40px`) filled with `#f8fafc`, subtle hover darkening, and centered line icons.

### Navigation & Segmented Tabs
- **Pill Tabs:** Contained within a soft track (`#f1f5f9` or transparent). Active tabs use solid `#0f172a` with white text; inactive items utilize muted slate text `#64748b`.
- **Sidebar Nav Items:** Soft rounded-xl or pill-shaped rows. Active state displays an elevated white card-chip with dark text and a vibrant indicator.

### Cards & Module Surfaces
- **Metric Cards:** Clean white backgrounds containing header action rows, line charts with translucent gradient fills under curves, and floating pill selectors.
- **Treatment & Appointment Cards:** Horizontal pill-like rows featuring a rounded square avatar/icon container (tinted with pastel accent backgrounds), bold title, timestamp subtitle, and an overflow action trigger on the trailing edge.

### Calendar & Scheduling Widget
- Compact grid with clean sans-serif weekday headers, subtle day numbers, and the selected day encased in a solid `#0f172a` circle accompanied by indicator dots for active appointments.

### Inputs & Search
- Inputs are pill-shaped or soft-rounded (`16px`) fields with translucent light gray backgrounds (`#f1f5f9` or `#f8fafc`), inset icons, and faint borders that transition to emerald green (`#10b981`) on active focus.