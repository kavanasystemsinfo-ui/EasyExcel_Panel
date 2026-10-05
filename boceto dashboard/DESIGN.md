---
name: Executive Operational Clarity
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3e4941'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7a70'
  outline-variant: '#bdcabe'
  surface-tint: '#006d3f'
  primary: '#00673b'
  on-primary: '#ffffff'
  primary-container: '#0d824d'
  on-primary-container: '#e0ffe6'
  inverse-primary: '#76da9c'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#6e25df'
  on-tertiary: '#ffffff'
  tertiary-container: '#8748f9'
  on-tertiary-container: '#fcf5ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#92f7b7'
  primary-fixed-dim: '#76da9c'
  on-primary-fixed: '#00210f'
  on-primary-fixed-variant: '#00522e'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#eaddff'
  tertiary-fixed-dim: '#d2bbff'
  on-tertiary-fixed: '#25005a'
  on-tertiary-fixed-variant: '#5a00c6'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-tabular-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  data-tabular-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  data-tabular-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-dense: 0.5rem
  margin: 1.5rem
  margin-mobile: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

This design system establishes an executive, data-dense, and utilitarian aesthetic tailored for facilities, cleaning services, and multi-site operational command. Drawing from modern high-performance SaaS platforms while honoring the structural familiarity of spreadsheet architectures, it balances dense quantitative information with executive polish.

The visual narrative hinges on precision and dependability:
- **Operational Precision**: Every pixel communicates operational state, compliance, or schedule adherence without ornamental clutter.
- **Modern Executive Rigor**: Combining crisp tabular density with balanced typography, generous micro-spacing, and subtle boundaries rather than heavy borders.
- **Spreadsheet Affinity**: Structural elements such as bottom-docked or tabbed worksheet navigation, frozen column anchors, and inline editable states mirror the fluid speed of spreadsheet workflows, elevated into modern cloud tooling.
- **Trust & Compliance**: Visual status signaling is unambiguous, immediately separating operational stability (green/slate) from critical personnel risks, audit non-conformities, and equipment breakdowns.

## Colors

The color architecture is rooted in a refined emerald hue that modernizes traditional spreadsheet green into a commanding enterprise identity. Paired with deep slate navy for structural chrome and precise status tokens, the palette delivers immediate legibility across dense data sets.

### Semantic Tones & Intent
- **Primary (`#0D824D` / Active `#0A6A3E`)**: Core operational actions, active workbook tab indicators, file synchronization status, and primary commits.
- **Secondary (`#0F172A`)**: Sidebar chrome, executive headers, primary data typography, and prominent command bars.
- **Canvas & Surfaces**: Base canvas utilizes `#F8FAFC`, stepping up to pure white (`#FFFFFF`) for elevated cards, tabular grids, and modal dialogs. Subtle sectioning relies on surface containment (`#F1F5F9`) and border strokes (`#E2E8F0`).
- **AI Assist / Intelligence (`#7C3AED`, Container `#F3E8FF`)**: Dedicated to automated shift scheduling suggestions, anomaly detection in time logs, and conversational operational queries.

### Operational Status Matrix
- **Success / Conforme / Active**: `#16A34A` text on `#DCFCE7` background. Used for compliant audits, active contracts, and healthy machinery.
- **Warning / Próxima Revisión / Pendiente**: `#D97706` text on `#FEF3C7` background. Alerts operators to impending contract expirations, pending leaves, or upcoming maintenance intervals.
- **Danger / Baja / No Conforme**: `#DC2626` text on `#FEE2E2` background. Denotes critical audit failures, medical leaves, equipment breakdown, or missing shift allocations.
- **Info / En Trámite**: `#2563EB` text on `#DBEAFE` background. Identifies in-process onboarding, supplier contract reviews, or syncing operational states.

## Typography

The typography strategy leverages `Plus Jakarta Sans` for clean, assertive section framing and operational dashboard headers, while `Inter` handles all dense grid rows, form interactions, and tabular data.

### Tabular Figures & Grid Alignment
- All instances of metric displays, employee counters, shift timestamps, and inventory IDs strictly mandate `font-feature-settings: "tnum" 1, "cv05" 1, "ss01" 1`. This prevents baseline jitter across auto-updating table cells and KPI stat arrays.
- High-density data tables utilize `data-tabular-md` (`13px`) as the primary text size, ensuring clear readability across screens displaying 15+ column fields simultaneously.
- Header bands on cards use tight tracking (`letter-spacing: -0.01em`) to maintain an authoritative, engineered feel.

## Layout & Spacing

The layout is built upon a hybrid fluid-grid engine designed to handle both macro dashboard analytics and full-bleed operational sheets.

### Grid Architecture
- **Desktop (>= 1280px)**: A 12-column dynamic grid with a default `gutter` of `1rem` (16px) and outer `margin` of `1.5rem` (24px). When toggled into "Sheet View" (full data exploration for Vacaciones, Centros, or Turnos), gutters tighten to `gutter-dense` (`0.5rem` / 8px) to maximize horizontal real estate.
- **Tablet (768px - 1279px)**: 8-column layout. The persistent left navigation shifts into an icon-rail format (64px width) to preserve horizontal space for data grids.
- **Mobile (< 768px)**: 4-column flow. Operational tables automatically collapse non-essential columns behind a detail disclosure accordion, keeping primary employee identifiers and status badges pinned.

### Dense Rhythms
Spacing adheres to a strict 4px/8px modular scale. In tabular listings and spreadsheet tabs, vertical padding is compressed (`space-xs` to `space-sm`) to support high scanning speed, while outer KPI groupings utilize `space-lg` and `space-xl` to prevent visual fatigue.

## Elevation & Depth

Visual hierarchy relies on structural, low-contrast boundaries combined with crisp, directional ambient shadows. Avoid heavy blurred dropshadows or floating skeuomorphic depth.

### Surface Tiers
- **Layer 0 (Canvas Base)**: `#F8FAFC`. Houses the global frame, inactive sheet tabs, and workspace background.
- **Layer 1 (Card & Grid Containers)**: Pure `#FFFFFF`, defined by a 1px border stroke (`#E2E8F0`) and an ambient shadow: `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)`.
- **Layer 2 (Floating Toolbar / Fixed Headers / Filters)**: `#FFFFFF` with `backdrop-filter: blur(8px)`, elevated with `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`. Used for sticky column headers and table action bars.
- **Layer 3 (Modals, AI Operational Drawer & Menus)**: `#FFFFFF`, accented with a primary brand top-border or AI purple highlight, elevated via `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.08)`.

## Shapes

This design system uses a disciplined **Soft (`1`)** roundedness profile to maintain a crisp, structured data-tool feel. 

### Implementation Rules
- **Base Components (Inputs, Buttons, Badges, Table Rows)**: `0.25rem` (4px). Preserves linear continuity and crisp vertical gridlines.
- **Cards, Modals & Workbenches (`rounded-lg`)**: `0.5rem` (8px). Softens the larger analytical surfaces without sacrificing structural enterprise rigor.
- **Pills & Status Tags**: Fully rounded (`9999px`) reserved strictly for standalone status indicators, live cloud sync indicators, and operational count pills.

## Components

### 1. Data Grids & Worksheet Tabs
- **Excel-Style Tab Bar**: Anchored above or below the primary grid. Tabs feature `#F1F5F9` inactive states with `#64748B` typography, transitioning to a `#FFFFFF` active state with a solid 2px `#0D824D` top or bottom indicator line, bold slate text, and an inline record count badge (e.g., `Empleados (142)`).
- **Tabular Rows**: Height is standardized at 40px for normal density and 32px for high-density view. Alternating row fills are avoided; instead, use a 1px `#F1F5F9` bottom border and a subtle hover fill (`#F8FAFC`).
- **Frozen Columns**: Name, ID, or Center columns freeze horizontally with a subtle vertical boundary (`#CBD5E1`) and a 2px faded right shadow.

### 2. Status Badges & Sync Pills
- **Status Badges**: Composed of a 6px solid dot indicator alongside semantic uppercase text (11px, `label-sm`).
  - *Conforme / Activo*: Green palette with `#16A34A` dot.
  - *Próxima Revisión / Baja Temporal*: Amber palette with `#D97706` dot.
  - *No Conforme / Baja Médica*: Red palette with `#DC2626` dot.
  - *En Trámite*: Blue palette with `#2563EB` dot.
- **Cloud Sync Status Pill**: Displayed in the top navigation bar. Includes an animated pulse dot, an Excel workbook icon, text (`Excel Cloud Synced`), and a relative timestamp (`hace 2m`) using an emerald border stroke and transparent container.

### 3. KPI Stat Cards
- Enclosed in `rounded-lg` cards with a 1px `#E2E8F0` border.
- Layout features a subtle categorical overline (`label-sm`, slate), an oversized tabular metric (`headline-xl`, slate navy), and a bottom-aligned delta badge showcasing comparison against previous shift/audit periods.

### 4. Interactive Inputs & Fast Filters
- **Search & Quick-Filters**: Input height 36px with 1px `#CBD5E1` border, transitioning to a 1px `#0D824D` focus ring with a 2px `#DCFCE7` outer halo.
- **Filter Chips**: Compact toggle chips (e.g., `Centro: Hospital Norte ×`, `Turno: Noche ×`) with slate backgrounds (`#F1F5F9`) and emerald active outlines.

### 5. AI Operational Assistant (Modal / Side Drawer)
- Outlined with an ambient purple boundary (`#E9D5FF`).
- Contains a header badge (`IA Operativa EasyExcel`), conversational prompt area for natural-language queries (e.g., *"¿Qué limpiadores tienen contratos por vencer este mes en Centro Sur?"*), and interactive recommendation action chips (`Aplicar reasignación`, `Exportar .xlsx`).

### 6. Buttons
- **Primary**: Background `#0D824D`, foreground `#FFFFFF`, height 36px, `0.25rem` radius. On hover: `#0A6A3E`.
- **Secondary / Outline**: Background `#FFFFFF`, border 1px `#CBD5E1`, foreground `#0F172A`. On hover: `#F8FAFC`.
- **Destructive**: Background `#DC2626`, foreground `#FFFFFF`. Used for row deletions or audit non-compliance locks.