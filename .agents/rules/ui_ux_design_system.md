# UI/UX Design System — Light Mode SaaS Dashboard

**Source Reference**: Fundora Dashboard (Clean, Modern, Light-Mode SaaS Financial Dashboard)

This is a **mandatory AI Agent Rule**. Every component, page, and UI element generated within this product MUST adhere to this document. Do NOT deviate from these tokens, patterns, or principles unless the user explicitly requests an override.

---

## 0. Core Design Philosophy

| Principle | Description |
|:---|:---|
| **Clean & Airy** | Generous whitespace. Never crowd elements. Breathe. |
| **Soft & Approachable** | Large border-radius, very subtle shadows, no harsh edges. |
| **High Contrast Typography** | Text contrast is critical — dark text on light backgrounds. |
| **Structured Layout** | Everything aligns to a fixed grid. Chaos is unacceptable. |
| **Micro-interaction First** | Hover states, transitions, and active states on every interactive element. |
| **Light Mode Default** | Pure whites + off-white backgrounds. No dark backgrounds unless explicitly requested. |

---

## 1. Color System

### 1.1 Core Background Colors

```css
/* Application-level backgrounds */
--color-app-bg:        #EEF0F3;  /* Outermost app background — very light blue-gray */
--color-page-bg:       #F7F9FA;  /* Main content area background — near white */
--color-surface:       #FFFFFF;  /* Cards, modals, panels, dropdowns — pure white */
--color-surface-hover: #F9FAFB;  /* Subtle hover state on white surfaces */
```

**Tailwind**: `bg-[#EEF0F3]` / `bg-white` / `bg-gray-50`

### 1.2 Brand / Primary Color

The primary brand color is a **vibrant Royal Blue**, used for CTAs, active states, key data highlights, and interactive icons.

```css
--color-primary-50:   #EFF6FF;  /* Extremely light blue — subtle backgrounds */
--color-primary-100:  #DBEAFE;  /* Light blue — tag backgrounds, progress fills */
--color-primary-200:  #BFDBFE;  /* Used in light badge fills */
--color-primary-500:  #3B82F6;  /* Medium blue */
--color-primary-600:  #2563EB;  /* Primary buttons, active nav, key links (MAIN) */
--color-primary-700:  #1D4ED8;  /* Hover state for primary buttons */

/* The brand logo/icon uses a gradient */
--color-brand-gradient: linear-gradient(135deg, #2563EB 0%, #60A5FA 100%);
```

**Tailwind**: `text-blue-600` / `bg-blue-600` / `hover:bg-blue-700`

### 1.3 Text Colors & WCAG 2.1 AAA Contrast Rules

```css
--color-text-primary:    #111827;  /* H1, large headings, metric values (16.1:1 ratio) */
--color-text-secondary:  #374151;  /* H2, card titles, medium emphasis (9.0:1 ratio) */
--color-text-tertiary:   #4B5563;  /* Body text, descriptions, labels (7.0:1 ratio) */
--color-text-muted:      #6B7280;  /* Placeholders, hints, disabled text, captions (4.5:1 ratio) */
```

**MANDATORY CONTRAST RULE**: 
- Never use `text-gray-300` or `text-*-100/200` for text on light backgrounds.
- All headings and metrics must use `text-gray-900` or `text-gray-800`.
- All body text must use `text-gray-700` or `text-gray-600`.
- Minimum contrast ratio for any text is 4.5:1 (AA), target is 7:1+ (AAA).

### 1.4 Semantic / Status Banner Colors

```css
/* Warning / Delayed — Amber */
--color-warning-text:   #78350F;   /* text-amber-900 (9.5:1 ratio) */
--color-warning-body:   #92400E;   /* text-amber-800 */
--color-warning-bg:     #FFFBEB;   /* bg-amber-50 */
--color-warning-border: #FDE68A;   /* border-amber-200 */

/* Success / Connected — Emerald */
--color-success-text:   #064E3B;   /* text-emerald-900 (10.2:1 ratio) */
--color-success-body:   #065F46;   /* text-emerald-800 */
--color-success-bg:     #ECFDF5;   /* bg-emerald-50 */
--color-success-border: #A7F3D0;   /* border-emerald-200 */

/* Danger / Error — Rose */
--color-danger-text:    #881337;   /* text-rose-900 (10.8:1 ratio) */
--color-danger-body:    #9F1239;   /* text-rose-800 */
--color-danger-bg:      #FFF1F2;   /* bg-rose-50 */
--color-danger-border:  #FECDD3;   /* border-rose-200 */

/* Info — Blue */
--color-info-text:      #1E3A8A;   /* text-blue-900 (11.5:1 ratio) */
--color-info-body:      #1E40AF;   /* text-blue-800 */
--color-info-bg:        #EFF6FF;   /* bg-blue-50 */
--color-info-border:    #BFDBFE;   /* border-blue-200 */
```

### 1.5 Border and Divider Colors

```css
--color-border-light:    #F3F4F6;  /* Extremely subtle card borders, table row dividers */
--color-border-default:  #E5E7EB;  /* Standard input borders, card outlines */
--color-border-medium:   #D1D5DB;  /* Hover state borders, focused inputs */
```

**Tailwind**: `border-gray-100` / `border-gray-200` / `border-gray-300`

### 1.6 Chart Colors

```css
/* Line Chart (Earning Overview) */
--color-chart-line-primary:  #2563EB;                  /* Line stroke — solid blue */
--color-chart-area-from:     rgba(37, 99, 235, 0.08);  /* Gradient area top fill */
--color-chart-area-to:       rgba(37, 99, 235, 0.00);  /* Gradient area bottom (transparent) */
--color-chart-dot-active:    #2563EB;                  /* Active data point — filled blue circle */
--color-chart-dot-ring:      #FFFFFF;                  /* White ring around active dot */

/* Bar Chart (Cash Flow) */
--color-chart-bar-inactive:  #E9ECF1;  /* Inactive bars — cool light gray */
--color-chart-bar-active-top:#4F8EF7;  /* Active bar top gradient — bright blue */
--color-chart-bar-active-bot:#2563EB;  /* Active bar bottom gradient — deeper blue */

/* Stacked Progress Bar (Spending Breakdown) */
--color-chart-progress-1:    #2563EB;  /* House Rent — solid blue */
--color-chart-progress-2:    #BFDBFE;  /* Foods — light blue */
--color-chart-progress-3:    #E5E7EB;  /* Others — light gray */
```

---

## 2. Typography

### 2.1 Font Stack (MANDATORY SOLE FONT FAMILY: Be Vietnam Pro)

```css
font-family: 'Be Vietnam Pro', sans-serif;
```

- **Platform Mandatory Font**: `Be Vietnam Pro` (weights: 300, 400, 500, 600, 700, 800, 900)
- **Strict Rule**: No other font families are permitted in the project (no Inter, Roboto, JetBrains Mono, etc.). All UI elements, numbers, metrics, code blocks, tables, and tooltips must use `Be Vietnam Pro`.
- Import via Google Fonts: `https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap`

### 2.2 Type Scale and Hierarchy

| Role | Size | Weight | Color Token | Line Height | Tailwind |
|:---|:---|:---|:---|:---|:---|
| **Metric / Big Number** | 28–32px | 700 Bold | `--color-text-primary` | 1.1 | `text-3xl font-bold text-gray-900` |
| **Page Heading H1** | 22–24px | 600 Semibold | `--color-text-primary` | 1.3 | `text-2xl font-semibold text-gray-900` |
| **Card Title H2** | 14px | 500 Medium | `--color-text-tertiary` | 1.4 | `text-sm font-medium text-gray-500` |
| **Section Label** | 11px | 600 Semibold | `--color-text-muted` | 1.5 | `text-[11px] font-semibold tracking-wider text-gray-400 uppercase` |
| **Body regular** | 13–14px | 400 Normal | `--color-text-tertiary` | 1.5 | `text-sm font-normal text-gray-500` |
| **Body emphasized** | 13–14px | 500 Medium | `--color-text-secondary` | 1.5 | `text-sm font-medium text-gray-700` |
| **Caption / Small** | 11–12px | 400 Normal | `--color-text-muted` | 1.5 | `text-xs font-normal text-gray-400` |
| **Nav Item** | 13px | 500 Medium | `--color-text-tertiary` | 1.4 | `text-[13px] font-medium text-gray-500` |
| **Nav Item Active** | 13px | 600 Semibold | `#FFFFFF` | 1.4 | `text-[13px] font-semibold text-white` |
| **Chart Axis Labels** | 11px | 400 Normal | `--color-text-xmuted` | 1.4 | `text-[11px] text-gray-300` |

### 2.3 Special Text Patterns

```css
/* Percentage badge — inline next to metric */
/* "+1.5% up" in green background */
font-size: 12px;
font-weight: 600;
letter-spacing: 0.01em;

/* Section group header — "MAIN MENU", "FEATURES", "GENERAL" */
font-size: 10px;
font-weight: 600;
letter-spacing: 0.08em;  /* Wide tracking */
text-transform: uppercase;
color: #9CA3AF;
```

---

## 3. Layout and Spacing System

### 3.1 Base Spacing Scale

All spacing follows a **4px base unit** (multiples of 4).

```
4px  -> space-1  (xs — icon gaps, tiny insets)
8px  -> space-2  (sm — tight spacing inside components)
12px -> space-3  (md — standard gaps between inline elements)
16px -> space-4  (lg — padding inside compact components)
20px -> space-5
24px -> space-6  (xl — standard card padding, section gaps)
32px -> space-8  (2xl — gap between major sections)
48px -> space-12 (3xl — large section separators)
```

### 3.2 Application Shell

```
+-------------------------------------------------------------+
|  App Background: #EEF0F3  (padding ~16px all around)        |
|  +-------------------------------------------------------+  |
|  |  Main Window Card: bg-white, rounded-3xl, shadow-lg   |  |
|  |  +----------+------------------------------------+    |  |
|  |  |          |  TOP HEADER (height: ~72px)         |    |  |
|  |  | SIDEBAR  +------------------------------------+    |  |
|  |  | 240-260px|  MAIN CONTENT AREA (scrollable)     |    |  |
|  |  | fixed    |  padding: 24px 28px                 |    |  |
|  |  |          |                                     |    |  |
|  |  +----------+------------------------------------+    |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

### 3.3 Sidebar Dimensions

```css
/* Sidebar container */
width: 240px;           /* ~w-60 in Tailwind */
padding: 16px 12px;     /* p-4 / px-3 */
border-right: 1px solid #F3F4F6;

/* Logo area at top */
padding-bottom: 16px;
margin-bottom: 8px;

/* Search bar */
height: 36px;
margin-bottom: 20px;
border-radius: 8px;
background: #F7F9FA;
border: 1px solid #E5E7EB;

/* Nav Group label */
margin-top: 20px;
margin-bottom: 8px;
padding-left: 12px;

/* Nav Item spacing */
gap: 4px;           /* between items */
padding: 10px 12px; /* py-2.5 px-3 */
border-radius: 10px;
margin: 2px 0;

/* Upgrade Plan card at bottom */
background: #FFFFFF;
border: 1px solid #E5E7EB;
border-radius: 14px;
padding: 16px;
margin: 12px 0;
```

### 3.4 Header Dimensions

```css
/* Top header bar */
height: 72px;
padding: 0 28px;
display: flex;
align-items: center;
justify-content: space-between;
border-bottom: 1px solid #F3F4F6;

/* Header action icon buttons */
icon-size: 20px;
button-padding: 8px;
button-border-radius: 8px;
button-hover-bg: #F3F4F6;
gap-between-icons: 4px;

/* User avatar */
width: 38px;
height: 38px;
border-radius: 50%;
margin-right: 8px;
```

### 3.5 Main Content Grid

```css
/* Dashboard grid */
display: grid;
grid-template-columns: 1fr 1fr 280px;  /* 2 flexible + 1 fixed right column */
gap: 20px;   /* ~gap-5 */
padding: 24px 28px;
```

---

## 4. Borders, Radius and Shadow System

### 4.1 Border Radius Reference

```css
--radius-xs:   4px;    /* Tiny elements — status dots, micro-badges */
--radius-sm:   6px;    /* Small tags, tooltip corners */
--radius-md:   8px;    /* Inputs, small buttons, dropdowns, table rows */
--radius-lg:   10px;   /* Nav items, secondary cards */
--radius-xl:   12px;   /* Standard buttons, select boxes */
--radius-2xl:  14px;   /* Small cards, list items */
--radius-3xl:  16px;   /* Main content cards */
--radius-4xl:  20px;   /* Large dashboard panels */
--radius-full: 9999px; /* Pills — status badges, metric badges, toggle buttons */
```

**Component to Radius mapping:**

| Component | Radius |
|:---|:---|
| App shell / Main card window | 20–24px (rounded-3xl) |
| Dashboard cards | 16px (rounded-2xl) |
| Buttons primary solid | 10–12px (rounded-xl) |
| Buttons pill/badge | 9999px (rounded-full) |
| Nav menu items | 10px |
| Search input | 8px (rounded-md) |
| Table rows | 8px (rounded-md) |
| Status badges | 9999px (rounded-full) |
| Chart tooltips | 10px |
| Dropdown menus | 10px |
| Logo icon container | 12px (rounded-xl) |

### 4.2 Shadow System

```css
/* No shadow — flat surfaces inside cards */
--shadow-none: none;

/* Hairline — very subtle, barely visible elevation */
--shadow-xs: 0px 1px 2px rgba(0, 0, 0, 0.04);

/* Card — standard dashboard card elevation */
--shadow-card: 0px 2px 8px rgba(0, 0, 0, 0.04),
               0px 0px 1px rgba(0, 0, 0, 0.03);

/* Float — active nav item, prominent elements */
--shadow-float: 0px 4px 12px rgba(0, 0, 0, 0.08);

/* Overlay — dropdowns, tooltips */
--shadow-overlay: 0px 8px 24px rgba(0, 0, 0, 0.08),
                  0px 0px 1px rgba(0, 0, 0, 0.04);

/* App shell — outermost container */
--shadow-app: 0px 16px 48px rgba(0, 0, 0, 0.10),
              0px 0px 2px rgba(0, 0, 0, 0.05);
```

> **RULE**: Never use solid black shadows or `box-shadow: 2px 2px 5px #000`. All shadows must be soft, diffuse, and use very low opacity. The goal is a sense of floating, not a printed border.

---

## 5. Component Specifications

### 5.1 Sidebar Navigation

#### Logical structure

```
[LOGO AREA]
  +-- App icon (gradient square, 36x36, rounded-xl)
  +-- App name (text-base font-semibold)

[SEARCH BAR]
  +-- Input with search icon + keyboard shortcut hint

[SECTION: MAIN MENU]  <- 10px uppercase gray label
  +-- Home (ACTIVE STATE)
  +-- Wallets
  +-- Analytics (with blue notification badge "20")
  +-- Transactions
  +-- Invoices

[SECTION: FEATURES]
  +-- Recurring
  +-- Subscriptions
  +-- Feedback

[SECTION: GENERAL]
  +-- Settings
  +-- Help Desk
  +-- Log out  <- Red color #EF4444

[UPGRADE CARD at bottom]
  +-- Plan name, description, CTA button
```

#### CSS Styles

```css
/* Active Nav Item */
.nav-item-active {
  background: #111827;
  color: #FFFFFF;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.08);
}

/* Inactive Nav Item */
.nav-item-inactive {
  background: transparent;
  color: #6B7280;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s ease, color 0.15s ease;
}
.nav-item-inactive:hover {
  background: #F3F4F6;
  color: #111827;
}

/* Section Labels */
.nav-section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9CA3AF;
  padding: 16px 12px 8px;
}

/* Nav Badge — e.g., "20" on Analytics */
.nav-badge {
  background: #2563EB;
  color: #FFFFFF;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 9999px;
  min-width: 18px;
  text-align: center;
}

/* Log Out item */
.nav-item-danger { color: #EF4444; }

/* Upgrade Card */
.upgrade-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 14px;
  padding: 16px;
  margin-top: 12px;
}
.upgrade-card h4 { font-size: 14px; font-weight: 600; color: #111827; }
.upgrade-card p  { font-size: 12px; color: #6B7280; margin-top: 4px; }
.upgrade-card .cta {
  width: 100%;
  background: #2563EB;
  color: #FFFFFF;
  border: none;
  border-radius: 8px;
  padding: 9px 0;
  font-size: 13px;
  font-weight: 600;
  margin-top: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.upgrade-card .cta:hover { background: #1D4ED8; }
```

### 5.2 Top Header Bar

```css
.header {
  height: 72px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #FFFFFF;
  border-bottom: 1px solid #F3F4F6;
}

.header-title {
  font-size: 22px;
  font-weight: 600;
  color: #111827;
}

/* Icon action buttons: Help, Mail, Bell */
.header-icon-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #6B7280;
  cursor: pointer;
  transition: background 0.15s ease;
}
.header-icon-btn:hover { background: #F3F4F6; color: #111827; }

/* User profile section */
.header-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.header-user:hover { background: #F3F4F6; }
.header-user img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }
.header-user .name   { font-size: 13px; font-weight: 600; color: #111827; }
.header-user .handle { font-size: 11px; font-weight: 400; color: #9CA3AF; }
```

### 5.3 Dashboard Cards

```css
/* Base card */
.card {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 20px 22px;
  border: 1px solid #F3F4F6;
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.03);
}

/* Card Header Row */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.card-title {
  font-size: 13px;
  font-weight: 500;
  color: #6B7280;
  display: flex;
  align-items: center;
  gap: 6px;
}
.card-title .info-icon { width: 14px; height: 14px; color: #D1D5DB; }

/* Metric value inside card */
.card-metric {
  font-size: 30px;
  font-weight: 700;
  color: #111827;
  line-height: 1.15;
  margin-bottom: 4px;
}

/* Period selector dropdown pill — "This Month" */
.period-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 5px 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.period-selector:hover { background: #F9FAFB; }
```

### 5.4 Metric Trend Badge

The small badge next to metric values — e.g., "+1.5% up" in green, "-1.5% down" in red:

```css
.trend-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}
.trend-badge.up   { background: #ECFDF5; color: #10B981; }
.trend-badge.down { background: #FEF2F2; color: #EF4444; }
.trend-badge .arrow { font-size: 9px; }
```

### 5.5 Line Chart — Earning Overview

```
Container:
  height: 130px
  margin-top: 16px

Line rendering:
  - stroke color: #2563EB
  - stroke-width: 2.5px
  - curve type: smooth bezier (tension: 0.4 in Chart.js)

Area fill:
  - linear gradient, top to bottom
  - from: rgba(37, 99, 235, 0.08)
  - to:   rgba(37, 99, 235, 0.00) (transparent)

Data points:
  - normal: 4px solid circle, color #2563EB
  - active: 8px solid circle, color #2563EB + 2px white ring

Grid lines:
  - horizontal only
  - color: #F3F4F6
  - style: very faint, solid or dashed

Axis labels:
  - 11px, color: #9CA3AF
  - x-axis: month abbreviations (Jan, Feb, Mar...)
```

```css
/* Chart Tooltip */
.chart-tooltip {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #111827;
  box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.08);
  white-space: nowrap;
}
.chart-tooltip .label { color: #6B7280; font-size: 11px; margin-bottom: 2px; }
.chart-tooltip .value { font-size: 14px; font-weight: 700; color: #111827; }
```

### 5.6 Bar Chart — Cash Flow

```css
/* Tab group above chart: Income / Expense / Savings */
.chart-tab-group { display: flex; gap: 8px; margin-bottom: 16px; }
.chart-tab {
  padding: 6px 14px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.chart-tab.active   { background: #111827; color: #FFFFFF; }
.chart-tab.inactive { background: transparent; color: #6B7280; }
.chart-tab.inactive:hover { background: #F3F4F6; }

/* Bars */
.bar-chart-bar {
  border-radius: 6px 6px 0 0;  /* only top corners rounded */
  width: 24px;
}
.bar-chart-bar.inactive { background: #E9ECF1; }
.bar-chart-bar.active   { background: linear-gradient(to top, #2563EB, #60A5FA); }

/* Axis labels */
.bar-chart-y-label { font-size: 11px; color: #9CA3AF; }
.bar-chart-x-label { font-size: 11px; color: #9CA3AF; }
```

### 5.7 Stacked Progress Bar — Spending Breakdown

```css
.spending-legend {
  display: flex;
  gap: 20px;
  margin-bottom: 10px;
}
.spending-legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.spending-legend-dot  { width: 8px; height: 8px; border-radius: 50%; }
.spending-legend-label { color: #111827; font-weight: 500; }
.spending-legend-value { color: #6B7280; font-size: 11px; }

/* Progress bar track */
.progress-bar-track {
  height: 8px;
  background: #F3F4F6;
  border-radius: 9999px;
  display: flex;
  overflow: hidden;
  margin-top: 8px;
}
.progress-bar-segment:first-child  { background: #2563EB; }
.progress-bar-segment:nth-child(2) { background: #BFDBFE; }
.progress-bar-segment:last-child   { background: #E5E7EB; }
```

### 5.8 Data Table — Recent Transactions

```css
.table-container { width: 100%; border-collapse: collapse; }

/* Header row */
.table-header th {
  font-size: 12px;
  font-weight: 500;
  color: #9CA3AF;
  text-align: left;
  padding: 10px 14px;
  background: #F9FAFB;
  border-bottom: 1px solid #F3F4F6;
}
.table-header th:first-child { border-radius: 8px 0 0 8px; }
.table-header th:last-child  { border-radius: 0 8px 8px 0; }

/* Data rows */
.table-row td {
  padding: 12px 14px;
  font-size: 13px;
  color: #374151;
  border-bottom: 1px solid #F9FAFB;
  vertical-align: middle;
}
.table-row:hover td { background: #F9FAFB; }

/* App icon in table */
.table-app-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
  margin-right: 10px;
}

/* Status badge: Success */
.status-badge-success {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 9999px;
  background: #ECFDF5;
  color: #10B981;
  font-size: 11px;
  font-weight: 600;
}
.status-badge-success::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34D399;
  display: inline-block;
}

/* Filter button */
.table-filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #6B7280;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  transition: background 0.15s ease;
}
.table-filter-btn:hover { background: #F3F4F6; }

/* Three-dot action button */
.table-action-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9CA3AF;
  cursor: pointer;
  transition: background 0.15s ease;
}
.table-action-btn:hover { background: #F3F4F6; color: #374151; }
```

### 5.9 Bill/Payment List — Right Sidebar Panel

```css
.bill-list-card {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 18px;
  border: 1px solid #F3F4F6;
}

.bill-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

/* "+" add button */
.bill-add-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #F3F4F6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
}
.bill-add-btn:hover { background: #E5E7EB; }

/* Individual bill item */
.bill-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #F9FAFB;
  cursor: pointer;
  transition: background 0.15s ease;
}
.bill-item:hover {
  background: #F9FAFB;
  margin: 0 -8px;
  padding: 10px 8px;
  border-radius: 8px;
}
.bill-item-logo  { width: 36px; height: 36px; border-radius: 9999px; object-fit: cover; flex-shrink: 0; }
.bill-item-name  { font-size: 13px; font-weight: 500; color: #111827; }
.bill-item-date  { font-size: 11px; color: #9CA3AF; margin-top: 2px; }
.bill-item-price { font-size: 14px; font-weight: 600; color: #111827; }
.bill-item-status { font-size: 11px; font-weight: 500; color: #9CA3AF; text-align: right; }
.bill-item-chevron { color: #D1D5DB; font-size: 14px; margin-left: auto; }

/* "View All" button at bottom */
.view-all-btn {
  width: 100%;
  padding: 10px;
  margin-top: 12px;
  border: 1px solid #E5E7EB;
  border-radius: 10px;
  background: #FFFFFF;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  text-align: center;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.view-all-btn:hover { background: #F9FAFB; border-color: #D1D5DB; }
```

---

## 6. Interactive States and Micro-Interactions

### 6.1 Transition Defaults

```css
/* All interactive elements MUST have a transition */
transition-duration: 150ms;
transition-timing-function: ease;

/* Common transition patterns */
transition: background 150ms ease;
transition: color 150ms ease, background 150ms ease;
transition: transform 150ms ease, box-shadow 150ms ease;
transition: border-color 150ms ease;
```

### 6.2 Hover and Focus States

```css
/* Buttons — subtle upward float */
button:hover  { transform: translateY(-1px); }
button:active { transform: translateY(0px) scale(0.98); }

/* Interactive cards — very subtle lift */
.card.interactive:hover {
  box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.07);
  transform: translateY(-1px);
}

/* Input focus ring */
input:focus {
  outline: none;
  border-color: #2563EB;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.10);
}
```

---

## 7. Iconography

- **Style**: Line icons (stroke-based). NOT filled icons. Stroke weight: 1.5px.
- **Library**: Use `Lucide Icons` or `Heroicons`. Both are stroke-based, modern, and consistent.
- **Sizes**:
  - 16px — inline icons, nav icons
  - 20px — action buttons (header, filter)
  - 24px — feature section, large emphasis
- **Color**: Use `currentColor` so icons inherit parent text color automatically.

---

## 8. Implementation Checklist for Every New Component

Before finalizing any new component, verify every item below:

- [ ] Background uses `--color-surface` (`#FFFFFF`) or `--color-page-bg` (`#F7F9FA`) — never arbitrary gray values
- [ ] All border-radius values follow the component mapping table in Section 4.1
- [ ] Shadows are soft, diffuse, and low-opacity — see Section 4.2
- [ ] Font family is `Inter` and the type scale from Section 2.2 is respected
- [ ] All interactive elements have `transition: 150ms ease` applied
- [ ] Hover states are explicitly defined and implemented
- [ ] Icons are line-style (stroke), sized 16px / 20px / 24px as appropriate
- [ ] Status badges use `rounded-full` + semantic background colors from Section 1.4
- [ ] No hardcoded colors outside of this token system

---

## 9. Anti-Patterns — NEVER DO These

- NO dark backgrounds unless the user explicitly requests dark mode
- NO harsh drop shadows with low blur radius such as `box-shadow: 3px 3px 5px #000`
- NO square corners on cards or buttons — border-radius must always be applied
- NO colors outside the defined palette — use only system tokens
- NO mixed font families within the same interface
- NO text contrast below WCAG AA standard
- NO borders thicker than 1px on cards or panels
- NO filled/solid icon styles — always use stroke-based icons
- NO interactive elements without hover/focus states
- NO inline styles that bypass this design system — always use CSS classes or design tokens
