# Feature Spec — Ribbon Rack Builder (integration)

## Summary

Integrate the existing production **RibbonRackBuilder** into the portal after VAVS and Ad Book MVPs. Preserve ribbon images, rack layout, star calculation, Firestore `ribbon-profiles`, and **PIN behavior**. Add a **Ship’s Store shopping list** (printable / emailable). Convert surrounding chrome to Bootstrap **without** breaking rack display; keep legacy CSS for easy revert.

**References:**  
- Repo: https://github.com/bhartman21/RibbonRackBuilder  
- Live: https://bhartman21.github.io/RibbonRackBuilder/  

**Phase:** 3  
**Priority:** After VAVS + Ad Book MVPs  
**Security hardening:** Backlog (PIN plaintext / open reads accepted for now)

## Actors

| Actor | Capability |
|-------|------------|
| Anyone (incl. guest) | Build rack in browser; print rack; generate shopping list |
| Member | Same + save/load profiles with Profile ID + PIN (current model) |
| Department / national admin | Profile admin list (replace hard-coded email with roles) |

## User stories

1. As a Marine, I select my awards and see the correct rack with stars so I know how to mount ribbons.
2. As a Marine, I generate a shopping list of ribbons and devices to take/email to the Ship’s Store (they won’t take orders from our site).
3. As admin, I search saved profiles without relying on a single hard-coded Gmail address.
4. As developer, I can re-enable legacy chrome CSS in one import/flag if Bootstrap conversion regresses.

## Functional requirements

### FR-R-1 Preserve core builder

Port with behavior parity:

- Ribbon catalog from `RibbonDataService` (51 ribbons incl. Florida 75th).
- Categories MCL / MODD / convention / state; search; counts; marksmanship levels; gold frame toggle.
- `StarCalculatorService` rules unchanged.
- `RackVisualizerComponent` row packing (remainder on top, 3 per row) unchanged visually.
- PNG assets under `public/ribbons/` unchanged.

### FR-R-2 Profiles + PIN (as-is)

- Collection: **`ribbon-profiles`** (do not rename).
- Fields: existing `UserRackProfile`.
- Save requires profileId + memberName + PIN; load by profileId without PIN (current).
- **Do not** expand PIN pattern to VAVS/Ad Book.
- Document security debt in code comment + backlog.

### FR-R-3 Shopping list (NEW)

Generate from current selection:

| Line item type | How derived |
|----------------|-------------|
| Ribbon | Each selected ribbon name + quantity (usually 1 ribbon bar per award type; count may imply devices not extra ribbons — **clarify in UI copy**) |
| Star devices | From `StarCalculatorService` output (size + metal + count) |
| Special devices | FMF / bronze A if ever selected (**if present in model**) |
| Gold frame | If `isFramed` |
| Mounting hardware | Static checklist lines (user-confirmable): ribbon mounting bar(s), optional clutch backs — **inferred** placeholders until Ship’s Store list confirmed (OPEN_QUESTIONS) |

Actions:

- **Print** shopping list (`.no-print` hide builder chrome).
- **Copy** to clipboard.
- **Email:** `mailto:` with subject/body listing items (no server mail required for MVP).

**Pushback:** Do not fake an “Add to Ship’s Store cart” button — owner confirmed they don’t accept external orders.

### FR-R-4 Bootstrap conversion + legacy CSS

- Convert **page chrome** (portal header integration, form controls, buttons, admin tables) to Bootstrap 5.
- **Do not** change ribbon tile dimensions, star overlay positioning, or rack gap rules without screenshot approval.
- Preserve legacy stylesheet as `styles/ribbon-legacy.css` (copy of current builder/header/visualizer CSS).
- Git tag recommended: `ribbon-chrome-pre-bootstrap`.
- Feature flag or documented `styles.scss` import switch for revert.

### FR-R-5 Admin

- Move `/admin` ribbon profiles under portal roles (`departmentAdmin` / `nationalAdmin`).
- Retire sole reliance on `billy.hartman@gmail.com` hard-code (**Phase 3 AC**); temporary dual-check allowed during transition.

### FR-R-6 Cutover

- Keep GH Pages app live until portal `/ribbons` passes parity checklist.
- Add banner on old app: “Moved to …” when ready.
- Redirect optional.

## Acceptance criteria (Phase 3)

1. Existing profile IDs load/save against same Firestore documents.
2. Rack visual matches live site for a fixture award set (manual or screenshot).
3. Shopping list shows ribbons + computed stars/devices + mounting notes; print and mailto work.
4. Bootstrap used for forms/nav; rack CSS still sourced from legacy module unless flag disabled.
5. Documented revert steps restore pre-Bootstrap chrome in &lt; 15 minutes.
6. Admin route authorized via portal roles.
7. No Ship’s Store checkout integration.

## Non-functional

- Lazy-loaded `features/ribbon-rack` route.
- Bundle budget: watch ribbon PNG count (already on GH Pages).
- Keep Angular 21 aligned with portal root.

## Out of scope

- Hashing PINs / Auth-bound profiles (backlog)
- Ordering API
- Changing precedence order without MCL directive
- Rewriting PNGs

## Implementation notes for agents

- Prefer **copy into monorepo feature** over git submodule for MVP speed; attribute upstream repo in README.
- Shared portal header may wrap or replace `HeaderComponent`; ensure print styles still hide chrome.
- When linking detachments later, map `detachmentNumber` to portal `detachments` — not required for Phase 3 MVP.
- Unit-test `StarCalculatorService` after move (pure logic).
