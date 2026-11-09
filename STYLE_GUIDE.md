# Style Guide — MCL Portal (Bootstrap 5)

## Goal

One reconciled **navy / scarlet / gold** palette for the portal shell, VAVS, and Ad Book, while **preserving Ribbon Rack visual accuracy** (ribbon PNGs + rack layout). Convert RibbonRack chrome to Bootstrap later without forcing rack tiles onto generic Bootstrap cards.

## Sources (research)

| Source | Navy | Scarlet / red | Gold | Surface |
|--------|------|---------------|------|---------|
| VAVS sample | `#172c40` | `#9c2938` | `#c19b57` | `#f5f4f0` |
| Ad Studio sample | `#142c49` / `#162840` | `#b73842` / `#a62d3b` | accent `#d99b36` | `#eef1f5` |
| RibbonRackBuilder | `#00264D` / `#001B3A` | `#CC0000` | `#CFB53B` | dark UI `#00264D` |

## Canonical tokens (recommended)

Reconciled for a **light administrative portal** (VAVS/Ad Book primary) with optional dark ribbon section.

| Token | Hex | Use |
|-------|-----|-----|
| `--mcl-navy` | `#142c49` | Header, primary text on light, nav |
| `--mcl-navy-deep` | `#001B3A` | Optional dark sections / ribbon page background |
| `--mcl-scarlet` | `#A62D3B` | Primary buttons, alerts, active tab (closer to Ad Studio / readable on white) |
| `--mcl-scarlet-bright` | `#CC0000` | Dress-blues accent bar (ribbon header border) |
| `--mcl-gold` | `#C19B57` | Accent borders, focus rings, badges |
| `--mcl-gold-bright` | `#CFB53B` | Highlights on dark navy |
| `--mcl-muted` | `#64717B` | Secondary text |
| `--mcl-line` | `#DCE1E4` | Borders |
| `--mcl-surface` | `#F5F4F0` | Page background (VAVS-like) |
| `--mcl-surface-cool` | `#EEF1F5` | Alternate panels (Ad Studio-like) |
| `--mcl-white` | `#FFFFFF` | Cards |

**Inferred choice:** Default portal chrome = **light** (`surface` + navy header + scarlet CTAs). Ribbon builder route may keep **dark** navy background via `ribbon-legacy.css` so rack contrast is unchanged.

## Bootstrap 5 SCSS mapping

Override before importing Bootstrap (or use CSS variables if on Bootstrap 5.3+):

```scss
// styles/_variables.scss  (illustrative)
$primary:       #142c49;      // navy
$secondary:     #C19B57;      // gold
$danger:        #A62D3B;      // scarlet as “brand danger/CTA”
$success:       #006B3F;      // inferred USMC green accent (ribbon gradients use similar)
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
$headings-font-family: Georgia, "Times New Roman", serif; // matches samples’ titles
```

Bootstrap CSS variables (runtime):

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
| App header | `bg` navy `#142c49`, optional top border 4–5px scarlet; white text; gold subtitle |
| Primary button | Scarlet `#A62D3B` (`.btn-danger` remapped **or** custom `.btn-mcl`) — **pushback:** don’t use Bootstrap default blue |
| Secondary button | Outline navy |
| Cards / worksheets | White on `#F5F4F0`; gold top border optional (VAVS stat cards) |
| Focus | Gold outline `#C19B57` / `#d99b36` |
| Tables | Compact; sticky header on VAVS worksheets |
| Print | Hide `.no-print` / `.d-print-none`; Letter pages for ads |

## Ribbon Rack exception

- **Do not** restyle `.ribbon`, star devices, or rack rows with Bootstrap utilities that change size/spacing of the rack.
- Chrome around the rack (page header, forms, shopping list panel) **may** use Bootstrap.
- Keep `ribbon-legacy.css` for rack + pre-Bootstrap chrome; document toggle in `features/RIBBON_RACK.md`.

## Logo / seal

- VAVS sample uses DoF logo `dof-logo.png` — obtain rights/source file for portal assets (**open**).
- RibbonRack uses ☆ emblem in header — acceptable placeholder until official MCL/DoF artwork is provided.

## Accessibility

- Min contrast for body text on `#F5F4F0`: navy `#142c49` OK.
- Scarlet buttons: ensure white label text.
- Touch targets ≥ 44px on mobile (Ad Studio sample did this — keep).

## Do / Don’t

- **Do** use shared tokens from this file only.
- **Do** mark temporary one-off colors in PR notes.
- **Don’t** ship three different reds in the same view without reason.
- **Don’t** replace ribbon PNGs with CSS-only approximations in production UI (gradients in data are fallbacks only).
