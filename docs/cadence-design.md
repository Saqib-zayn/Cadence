# Cadence — Design System

> Pass this file at the start of every Stitch prompt. Do not deviate from these values. Every screen in the app must use this system exactly.

---

## Colours

### Base
| Token | Hex | Usage |
|---|---|---|
| `background` | `#f8f8f6` | App background — every screen |
| `surface` | `#f0f0ed` | Cards, input fields, inactive areas |
| `surface-raised` | `#eaeae6` | Elevated cards, hover states |
| `border` | `#e2e2de` | Dividers, outlines, subtle borders |

### Text
| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#1a1a18` | Headings, primary labels |
| `text-secondary` | `#6b6b66` | Supporting text, metadata |
| `text-muted` | `#a0a09a` | Placeholders, disabled, timestamps |

### Accent — Scores & Feedback
All accent colours are deliberately muted and desaturated. No bright primaries anywhere.

| Token | Hex | Usage |
|---|---|---|
| `green-bg` | `#e8f0e8` | Score 75–100 background tint |
| `green-text` | `#3a6b3a` | Score 75–100 text / positive feedback |
| `green-mark` | `#c8dfc8` | Sentence-end pause highlight in transcript |
| `amber-bg` | `#f0ebe0` | Score 50–74 background tint |
| `amber-text` | `#7a5c1e` | Score 50–74 text / caution feedback |
| `amber-mark` | `#e8d5a8` | Mid-sentence pause highlight in transcript |
| `red-bg` | `#f0e8e8` | Score 0–49 background tint |
| `red-text` | `#8b3a3a` | Score 0–49 text / filler word labels |
| `red-mark` | `#f0c8c8` | Filler word highlight in transcript |

### Navigation
| Token | Value | Usage |
|---|---|---|
| `nav-icon-active` | `#1a1a18` | Active / current screen icon |
| `nav-icon-inactive` | `#a0a09a` | Inactive icons |
| `drawer-bg` | `#f0f0ed` | Slide-in drawer background |
| `drawer-overlay` | `rgba(0, 0, 0, 0.3)` | Overlay behind open drawer |

### Interactive
| Token | Hex | Usage |
|---|---|---|
| `btn-primary-bg` | `#1a1a18` | Primary button background |
| `btn-primary-text` | `#f8f8f6` | Primary button label |
| `btn-secondary-bg` | `#eaeae6` | Secondary button background |
| `btn-secondary-text` | `#1a1a18` | Secondary button label |
| `btn-disabled` | `#d4d4d0` | Disabled state |

---

## Typography

**Font family:** `Inter` — import from Google Fonts. Fallback: `system-ui, -apple-system, sans-serif`.

| Style | Size | Weight | Line height | Usage |
|---|---|---|---|---|
| `display` | 56px | 700 | 1.0 | Score number (large) |
| `heading-1` | 28px | 700 | 1.2 | Word of the round, screen titles |
| `heading-2` | 20px | 600 | 1.3 | Section headings, card titles |
| `body` | 16px | 400 | 1.6 | Body copy, transcript text |
| `body-medium` | 16px | 500 | 1.6 | Emphasis within body |
| `label` | 13px | 500 | 1.4 | Tags, badges, metadata |
| `caption` | 12px | 400 | 1.4 | Timestamps, helper text |

Letter spacing: `-0.01em` on headings. `0` on body. `0.02em` on labels and captions.

---

## Spacing

Base unit: `4px`. All spacing is a multiple of this.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Micro gaps |
| `space-2` | 8px | Tight internal padding |
| `space-3` | 12px | Component internal padding |
| `space-4` | 16px | Standard gap between elements |
| `space-5` | 20px | Card padding |
| `space-6` | 24px | Section spacing |
| `space-8` | 32px | Large section breaks |
| `space-10` | 40px | Screen-level padding |

**Horizontal padding by breakpoint:**
| Breakpoint | Screen padding | Usage |
|---|---|---|
| Mobile `< 768px` | `24px` | Base layout |
| Tablet `768px–1199px` | `48px` | Wider breathing room |
| Desktop `≥ 1200px` | `80px` | Full desktop layout |

There is no max-width container. The layout fills the full viewport at every size — content scales outward, not upward into a phone frame.

---

## Border radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 8px | Tags, badges, small chips |
| `radius-md` | 12px | Buttons, input fields |
| `radius-lg` | 16px | Cards |
| `radius-xl` | 24px | Nav bar, modal sheets |
| `radius-full` | 9999px | Pill badges, round icons |

---

## Shadows

Shadows are very subtle — the app is flat-leaning. Never use hard or dark shadows.

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 3px rgba(0,0,0,0.06)` | Cards, subtle lift |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Nav bar, floating elements |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.10)` | Modals, share card preview |

---

## Components

### Navigation — Side drawer (Claude-style)
There is no persistent navigation bar. The round card dominates the screen — nothing competes with it. All navigation lives in a slide-in drawer, invisible until needed.

**Trigger icon (every screen, top-left):**
- A quiet hamburger or panel icon, `nav-icon-inactive` colour, `24px` size
- Sits `24px` from the left edge, vertically centred in the `52px` top bar
- No background, no border — just the icon floating over the screen background

**Drawer behaviour:**
- Slides in from the left on tap, `200ms` ease-out transition
- `drawer-overlay` covers the main content behind it — tapping the overlay closes the drawer
- Closing transition: `180ms` ease-in back to the left

**Drawer appearance:**
- Width: `280px` on mobile, `320px` on tablet+
- Background: `drawer-bg` (`#f0f0ed`)
- Border radius: `radius-xl` (24px) on top-right and bottom-right corners only
- Shadow: `shadow-lg`
- Full viewport height

**Drawer contents (top to bottom):**
- App wordmark "Cadence" in `heading-2`, `text-primary` — `space-6` top padding
- Tagline in `caption`, `text-muted` — sits directly below the wordmark
- `space-6` gap then a `1px border` divider
- **Home** — house icon + label
- **Progress** — chart icon + label
- **Settings** — gear icon + label
- `1px border` divider
- **Past Rounds** — clock icon + label, `text-muted` colour, "Soon" pill badge in `surface-raised` — grayed out, not tappable in v1
- Pushed to the very bottom: app version number in `caption`, `text-muted`

**Drawer nav item style:**
- Height: `52px`, full drawer width
- Font: `body-medium` (16px / 500)
- Icon (`20px`) + label, left-aligned, `space-5` horizontal padding, `space-3` gap between icon and label
- Active screen row: `surface-raised` background, `text-primary`, `radius-md` inset with `4px` horizontal margin
- Inactive rows: transparent background, `text-secondary`

**Top bar (every screen):**
- Height: `52px`
- Left: drawer trigger icon
- Centre: screen title in `label` (13px / 500), `text-secondary` — e.g. "Progress", "Settings". Empty on the Home and Round screens — the content speaks for itself
- Right: one contextual icon maximum — share icon on Results screen, nothing on most screens
- No background, no border, no shadow — completely invisible, just floating icons

### Buttons
- Height: `52px`
- Border radius: `radius-md` (12px)
- Full width on mobile
- Font: `body-medium` (16px / 500)
- Primary: `btn-primary-bg` background, `btn-primary-text` label
- Secondary: `btn-secondary-bg` background, `btn-secondary-text` label
- No shadows on buttons — they sit flat
- Pressed state: 4% darker background

### Cards
- Background: `surface`
- Border radius: `radius-lg` (16px)
- Padding: `space-5` (20px)
- Border: `1px solid border`
- Shadow: `shadow-sm`

### Pill badges / tags
- Background: `surface-raised`
- Border radius: `radius-full`
- Padding: `4px 10px`
- Font: `label` (13px / 500)
- Difficulty tags use a slightly tinted version of the matching score colour:
  - Easy: `green-bg` background, `green-text` text
  - Medium: `amber-bg` background, `amber-text` text
  - Hard: `red-bg` background, `red-text` text

### Score number
- Font: `display` (56px / 700)
- Colour matches score tier:
  - 75–100: `green-text`
  - 50–74: `amber-text`
  - 0–49: `red-text`
- "/100" sits beside it in `text-muted`, `heading-2` size

### Transcript block
- Background: `surface`
- Border radius: `radius-lg`
- Padding: `space-5`
- Font: `body` (16px / 400), `text-primary`
- Filler words: `red-mark` background highlight, `red-text` colour, `radius-sm` on the highlight
- Mid-sentence pauses: `amber-mark` underline (3px, not full highlight)
- Sentence-end pauses: `green-mark` background, very subtle, just a breath of colour

### Score breakdown bar
- A single horizontal bar divided into five labelled segments
- Each segment fills proportionally to its score
- Segment colours: all use muted tones from the accent palette — no segment should be bright
- Labels sit below each segment in `caption` (12px)
- Bar height: `8px`
- Border radius: `radius-full` on the outer container, square joins between segments

---

## Layout principles

This app is a website, not a phone app embedded in a browser. At every screen size it fills the viewport naturally — the same way claude.ai, Linear, or Notion do. There is no phone frame, no centred container with dead space either side, no device mockup. The design scales outward as the screen gets larger.

### Mobile (`< 768px`)
- Single column layout
- `24px` horizontal padding
- Full-width cards and buttons
- Score, word, breakdown bar, transcript, feedback, buttons — all stacked vertically
- Top bar: hamburger left, contextual icon right

### Tablet (`768px–1199px`)
- Single column layout, content wider and more spacious
- `48px` horizontal padding
- Cards gain more internal padding (`space-6`)
- Typography scales up: `display` score → `72px`, `heading-1` → `32px`
- Buttons: full width still, but taller at `56px`
- Drawer width: `320px`

### Desktop (`≥ 1200px`)
- **Two-column layout** on content-heavy screens (Results, Progress)
- Left column (`45%`): Word, score, score delta, breakdown bar
- Right column (`55%`): Transcript, feedback points, buttons
- `80px` horizontal padding, `40px` gap between columns
- Typography scales further: `display` score → `88px`, `heading-1` → `36px`
- Cards gain significantly more internal padding (`space-8`)
- Buttons: fixed width `280px`, left-aligned in their column — no longer full width
- Top bar stretches full width — hamburger left, app wordmark "Cadence" centred, contextual icon right
- Drawer sits as a **persistent sidebar** on desktop (always visible, no overlay needed) — `260px` wide, full height, `border-right: 1px solid border`. No hamburger icon needed on desktop — the sidebar is always open.

### What never changes across breakpoints
- Background colour `#f8f8f6`
- All component colours, border radii, and shadow values
- The side drawer contents and structure
- The transcript annotation colours
- The overall calm, uncluttered feeling — more space is used for breathing room, not for adding more elements

---

## What to never do

- **NEVER add a bottom navigation bar, tab bar, or any element fixed to the bottom of the screen.** Navigation lives in a side drawer only. This rule has no exceptions.
- **NEVER add a styled top header bar.** The only top element on any screen is an invisible 52px bar with a floating hamburger icon. No background colour, no border, no shadow on this bar.
- Never use pure `#ffffff` white or `#000000` black anywhere
- Never use bright or saturated colours — all accents must feel like they belong on the `#f8f8f6` background
- Never use more than one accent colour family per screen (don't mix green and red highlights in the same component unless it's the transcript)
- Never use drop shadows heavier than `shadow-lg`
- Never use borders thicker than `1px`
- Never add a persistent bottom nav bar or tab bar — navigation lives in the side drawer only
- Never put more than one contextual action in the top-right — if you need more, they go in the drawer
- Never centre a narrow phone-width column in the middle of a wide desktop screen with empty space either side — the layout must expand to fill the viewport
- Never use a device frame or phone mockup container at any screen size
- Never scroll — if it doesn't fit, simplify
