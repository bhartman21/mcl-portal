# Style Guide — MCL Portal (Bootstrap 5)

## Goal

One reconciled **navy / scarlet / gold** palette for the portal shell, VAVS, and Ad Book. Align visually with the separate [RibbonRackBuilder](https://bhartman21.github.io/RibbonRackBuilder/) site so members recognize MCL branding — **shared tokens only**, not shared CSS/code.

## Sources (research)

| Source | Navy | Scarlet / red | Gold | Surface |
|--------|------|---------------|------|---------|
| VAVS sample | `#172c40` | `#9c2938` | `#c19b57` | `#f5f4f0` |
| Ad Studio sample | `#142c49` / `#162840` | `#b73842` / `#a62d3b` | accent `#d99b36` | `#eef1f5` |
| RibbonRackBuilder (related site) | `#00264D` / `#001B3A` | `#CC0000` | `#CFB53B` | dark UI `#00264D` |

## Canonical tokens (recommended)

Reconciled for a **light administrative portal** (VAVS / Ad Book).

| Token | Hex | Use |
|-------|-----|-----|
| `--mcl-navy` | `#142c49` | Header, primary text on light, nav |
| `--mcl-navy-deep` | `#001B3A` | Optional dark footer / emphasis sections |
| `--mcl-scarlet` | `#A62D3B` | Primary CTAs, alerts, active tab |
| `--mcl-scarlet-bright` | `#CC0000` | Accent bar under header (dress-blues echo) |
| `--mcl-gold` | `#C19B57` | Accent borders, focus rings, badges |
| `--mcl-gold-bright` | `#CFB53B` | Highlights on dark navy |
| `--mcl-muted` | `#64717B` | Secondary text |
| `--mcl-line` | `#DCE1E4` | Borders |
| `--mcl-surface` | `#F5F4F0` | Page background |
| `--mcl-surface-cool` | `#EEF1F5` | Alternate panels |
| `--mcl-white` | `#FFFFFF` | Cards |

**Inferred choice:** Default portal chrome = **light** (`surface` + navy header + scarlet CTAs).

## Bootstrap 5 SCSS mapping

```scss
// styles/_variables.scss  (illustrative)
$primary:       #142c49;      // navy
$secondary:     #C19B57;      // gold
$danger:        #A62D3B;      // scarlet as brand CTA
$success:       #006B3F;      // inferred USMC green accent
$warning:       #CFB53B;
$info:          #162840;
$light:         #F5F4F0;
$dark:          #001B3A;

$body-bg:       $light;
$body-color:    #142c49;

$link-color:    #A62D3B;
$link-hover-color: #8F2532;

$border-color:  #DCE1E4;
$border-radius: 0.375rem;

$font-family-sans-serif: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
$headings-font-family: Georgia, "Times New Roman", serif;
```

```css
:root {
  --bs-primary: #142c49;
  --bs-danger: #A62D3B;
  --bs-secondary: #C19B57;
  --mcl-gold: #C19B57;
  --mcl-scarlet: #A62D3B;
  --mcl-navy: #142c49;
}
```

## App header layout (decided Nov 15, 2026)

Billy asked for a cleaner header after screenshots showed it overflowing when signed in at 1366px (user chip clipped, horizontal scroll, "Ribbon Rack" wrapping). The header has **three zones and nothing else**:

| Zone | Contents |
|------|----------|
| Left | Crest + "Marine Corps League" / "Department of Florida • Member Portal" (links home; no separate Home link) |
| Center | Primary links only: **VAVS**, **Ad Book** (short labels, icons optional, `text-nowrap`). Admins also get an **Admin** dropdown (Users & Roles, Detachments, Activity, Registration Settings). |
| Right | Admins: bell icon with unread badge (links `/admin/activity`). Signed in: one round **initials avatar button** that opens an account menu. Signed out: a theme icon button plus **Sign In**. |

**Account menu** (dropdown from the avatar, right-aligned): name and email, role label, status badge if pending or suspended, theme picker (Light / Dark / Fun as a 3-option segmented control), divider, **Sign Out**.

**Moved out of the bar:**
- The theme switcher goes into the account menu (signed out: a single icon button with a small Light/Dark/Fun menu).
- **Ribbon Rack** moves to the footer and the home-page card (it is an external site; it doesn't need top-level nav weight). Replaces the earlier "same nav weight" row in Component conventions.
- **Local Demo Mode** becomes a thin full-width strip above the header (gold text on navy-deep, one line, "Local Demo Mode: data stays in this browser"), shown only in demo mode.

**Behavior and checks:**
- Collapse to the hamburger below the `xl` breakpoint (1200px), not `lg`. In the collapsed menu, the order is primary links, Admin links, then account items and Sign Out.
- No horizontal scroll and no wrapped nav labels at 1200, 1280, 1366, and 1440px wide, signed out and signed in as each demo role (longest case: Department Admin with a long display name; truncate the name with an ellipsis in the menu only).
- Header height stays one row (about 64–72px) on desktop. The scarlet blood stripe stays.
- Keyboard: avatar and Admin menus open with Enter/Space, close with Esc, and focus returns to the button. `aria-expanded` is set on both. Bell has an aria-label with the unread count.
- Visual: keep navy bar, gold subtitle, scarlet active-link underline (replace the filled red "Home" pill).
- Decided in build (PR #28, B.O.B.): in the collapsed menu the bell sits beside the hamburger; Admin links show inline under a small "Admin" heading instead of a nested dropdown; avatar initials come from the first and last words of the display name (text in parentheses ignored), falling back to the first letter of the email; in dark mode the selected theme button is gold.

## Component conventions

| UI | Guidance |
|----|----------|
| App header | `bg` navy `#142c49`, optional top/bottom scarlet accent; white text; gold subtitle |
| External Ribbon Rack link | Footer and home-page card only (see App header layout); opens in a new tab with an external-link icon; do not imply in-app route |
| Primary button | Scarlet `#A62D3B` (custom `.btn-mcl` or remapped danger) — **don’t** ship default Bootstrap blue as primary brand |
| Secondary button | Outline navy |
| Cards / worksheets | White on `#F5F4F0`; gold top border optional on stat cards |
| Focus | Gold outline `#C19B57` |
| Tables | Compact; sticky header on VAVS worksheets |
| Print | Hide `.no-print` / `.d-print-none`; Letter for ads |

## Logo / seal

- Obtain DoF / MCL logo rights for header (**open**).
- Placeholder emblem acceptable until official artwork is provided.

## Accessibility

- Body text navy on `#F5F4F0`: OK contrast.
- Scarlet buttons: white label text.
- Touch targets ≥ 44px on mobile (Ad Studio sample pattern — keep).

## Do / Don’t

- **Do** use shared tokens from this file only.
- **Do** keep RibbonRackBuilder visually related via these tokens if/when that site is restyled later (in its own repo).
- **Don’t** import RibbonRackBuilder CSS or ribbon PNG assets into this portal.
- **Don’t** ship three different reds in the same view without reason.
