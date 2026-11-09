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

## Component conventions

| UI | Guidance |
|----|----------|
| App header | `bg` navy `#142c49`, optional top/bottom scarlet accent; white text; gold subtitle |
| External Ribbon Rack link | Same nav weight as internal links; open in same or new tab (**inferred** same tab); do not imply in-app route |
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
