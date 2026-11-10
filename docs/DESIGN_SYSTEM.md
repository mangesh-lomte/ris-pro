# RadAxis RIS — Enterprise Design System Specification

## 1. System Overview & Brand Identity

- **System Name**: RadAxis RIS (RadAxis Enterprise RIS)
- **Product Type**: Enterprise Clinical Radiology Information System & Diagnostic Workflow Platform
- **Design Philosophy / Mode**: `OPERATE`
  - High information density tailored for clinical speed.
  - Zero decorative fluff, AI gradients, or marketing animations.
  - Strict visual hierarchy emphasizing Patient MRN, Accession Number, Modality, and Urgency.
  - Consistent keyboard navigation and deterministic data layouts.

---

## 2. Design Tokens

### 2.1 Color Palette

#### Base Surface & Neutrals
| Token | Tailwind Class | Hex / Value | Usage |
|---|---|---|---|
| Background Ground | `bg-slate-50` | `#F8FAFC` | Main app background canvas |
| Surface Card | `bg-white` | `#FFFFFF` | Worklists, modals, data cards |
| Surface Secondary | `bg-slate-100` | `#F1F5F9` | Table headers, secondary panels, inactive tabs |
| Border Default | `border-slate-200` | `#E2E8F0` | Dividers, card borders, table borders |
| Border Strong | `border-slate-300` | `#CBD5E1` | Inputs, interactive borders |
| Text High Emphasis | `text-slate-900` | `#0F172A` | Primary titles, patient names, modal headings |
| Text Medium Emphasis | `text-slate-700` | `#334155` | Table cell text, body copy, descriptions |
| Text Low Emphasis | `text-slate-500` | `#64748B` | Timestamps, secondary labels, helper hints |

#### Clinical Brand Accent
| Token | Tailwind Class | Hex / Value | Usage |
|---|---|---|---|
| Brand Primary | `bg-cyan-600` / `text-cyan-600` | `#0891B2` | Primary action buttons, active tab indicators |
| Brand Primary Hover | `hover:bg-cyan-700` | `#0E7490` | Hover state for primary actions |
| Brand Subtle | `bg-cyan-50` / `text-cyan-700` | `#ECFEFF` | Selected rows, highlighted clinical tags |
| Brand Focus Ring | `ring-cyan-500` | `#06B6D4` | Accessibility keyboard focus rings |

#### Clinical Urgency & Semantics
| Urgency / Semantic | Background | Text | Border | Clinical Meaning |
|---|---|---|---|---|
| `STAT / EMERGENCY` | `bg-red-50` | `text-red-700` | `border-red-200` | Critical triage, urgent review required |
| `URGENT` | `bg-amber-50` | `text-amber-700` | `border-amber-200` | Prioritized turnaround time (2h target) |
| `ROUTINE` | `bg-slate-100` | `text-slate-700` | `border-slate-200` | Standard queue priority (24h target) |
| `SUCCESS / READY` | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` | Signed report, completed scan, paid invoice |
| `IN PROGRESS` | `bg-blue-50` | `text-blue-700` | `border-blue-200` | Scanning active, drafting report |
| `CANCELLED / FAILED`| `bg-rose-50` | `text-rose-700` | `border-rose-200` | Cancelled order, voided claim |
| `CONTRAST SCREEN` | `bg-teal-50` | `text-teal-700` | `border-teal-200` | IV contrast administered or pending |

### 2.2 Typography Scale

- **Primary Interface Font**: `Inter`, `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Clinical Identifier & Numerical Font**: `JetBrains Mono`, `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

| Scale Level | Font Size / Line Height | Tailwind Class | Primary Usage |
|---|---|---|---|
| Micro | 10px / 14px | `text-[10px]` | Token pills, DICOM tag metadata, table footers |
| Caption | 12px / 16px | `text-xs` | Table cells, timestamps, badge labels |
| Body Small | 14px / 20px | `text-sm` | Form inputs, buttons, card descriptions |
| Body Base | 16px / 24px | `text-base` | Card headings, dialog titles, tab labels |
| Subheading | 18px / 28px | `text-lg` | Section headers, drawer titles |
| Page Header | 24px / 32px | `text-2xl` | Module titles, primary operational views |
| Monospace Figures | Fixed-width glyphs | `font-mono` | MRN (`PAT-YYYY-XXXXX`), Accession (`ACC-...`), UID, Currency |

### 2.3 Currency & Numeric Standards

- **Standard Currency**: Indian Rupee (`₹` / INR).
- **Number Delimiters**: Indian Numbering System (`en-IN` format: `₹1,25,000.00`).
- **Formatting Function**: `formatINR(amount)` centralized in `client/src/utils/formatters.ts`.
- **Constraint**: Zero foreign currencies (`$`, `USD`, `€`) allowed anywhere in billing, cashiering, or receipt surfaces.

---

## 3. Core Component Specifications

### 3.1 IdentifierPill (`client/src/components/shared/IdentifierPill.tsx`)
- Renders medical identifiers (MRN, Accession Number, StudyInstanceUID).
- Uses `font-mono`, `text-xs`, and non-wrapping inline layout (`whitespace-nowrap`).
- Integrated single-click clipboard copy with brief visual confirmation checkmark.

### 3.2 Clinical Badges
- **`PriorityBadge`**: Visual chip for scan urgency (STAT, URGENT, ROUTINE) with semantic border and pill rounding (`rounded-full`).
- **`StatusBadge`**: Visual chip for clinical order and study lifecycle states (SCHEDULED, ARRIVED, IN_PROGRESS, COMPLETED, FINALIZED).
- **`RoleBadge`**: Identifies user permission context (Radiologist, Technologist, Receptionist, Admin, Referring Doctor).

### 3.3 Clinical Tables
- High-density spacing: `py-2.5 px-3` per row to maximize visible examinations per viewport.
- Hover feedback: `hover:bg-slate-50/80 transition-colors`.
- Sticky Action Column: Far-right column pinned with clear, single-click clinical actions (e.g., *View Images*, *Draft Report*, *Check-in*).

### 3.4 Modals & Workspaces
- Diagnostic Reporting Workspace: Expanded wide dialog (`max-w-6xl` or multi-column layout) preventing clipped action toolbars.
- Strict modal layering: Dialog overlays use semi-transparent backdrop blur (`bg-slate-900/40 backdrop-blur-sm`).
- ESC key dismiss and click-outside protection on dirty form state.

---

## 4. Responsive Breakpoints & Viewports

RadAxis RIS is engineered for clinical workstations across the medical center:

1. **Large Diagnostic Workstation** (`1440 × 900` and above):
   - 2-column and 3-column dense data views.
   - Dual-pane reporting canvas alongside synchronized OHIF Viewer tabs.
2. **Standard Clinical Laptop / Desk Terminal** (`1366 × 768`):
   - Primary operational benchmark.
   - Fixed navigation sidebar, sticky table headers, non-overlapping modals.
3. **Clinical Tablet / Mobile Cart** (`1024 × 768`):
   - Collapsible navigation rail to preserve horizontal workspace.
   - Scrollable tab containers with fade indicators.
4. **Mobile / Handheld Porter View** (`375 × 667`):
   - Slide-out mobile drawer navigation.
   - Stacked patient summary cards, optimized tap targets (minimum 44 × 44px).

---

## 5. Accessibility (WCAG 2.1 AA) Compliance

- **Contrast Ratios**: All primary text maintains $\ge 4.5:1$ contrast against card and background surfaces.
- **Focus Rings**: Universal keyboard navigation supported via `focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2`.
- **Screen Reader Support**: All icon-only action triggers supply explicit `aria-label` attributes (e.g. `aria-label="Copy Accession Number"`).
- **No Reliance on Color Alone**: Every urgent or critical state couples color badges with clear textual status indicators.

