# MCL Portal — Planning Docs

Handoff documentation for building a combined **Marine Corps League (MCL) member portal** for the Department of Florida (DoF), with room to grow to national.

These docs are for coding agents and humans. Prefer implementing against the feature specs and `ARCHITECTURE.md`; treat sample ChatGPT sites as UX references, not as production code to copy blindly.

## Audience (decided)

| Who | What they use |
|-----|----------------|
| DoF MCL members (first rollout) | Log VAVS hours, build ribbon racks, create ad drafts |
| Detachment / Department VAVS reps | Monitor and edit hours for their scope; compile reports |
| Ad book editors / approvers | Review submitted ads; build program books |
| Department staff (later national) | Compile VAVS rollups; generate/approve ads for conventions |
| Public / guests | Limited: view marketing pages; later company advertisers (post-MVP) |
| All MCL members | Ribbon Rack Builder (existing capability preserved) |

## Product areas

1. **Portal shell** — auth, roles, detachment directory, shared nav/branding  
2. **VAVS Service Tracker** — volunteer hours, cash, in-kind; CSV/print; audit trail for rep edits  
3. **Ad Book Studio** — configurable ad sizes, submit → approve/reject workflow, books per event  
4. **Ribbon Rack Builder** — integrate existing Angular app; shopping list for Ship’s Store; Bootstrap conversion with reversible legacy CSS  

**Priority:** Phase 0 shell → MVP VAVS + MVP Ad Book → Ribbon Rack integration / Bootstrap / shopping list → later enhancements. Ribbon PIN security hardening is **backlog**, not MVP.

## Stack (decided)

- **Frontend:** Angular **21** (match [RibbonRackBuilder](https://github.com/bhartman21/RibbonRackBuilder)), **Bootstrap 5**
- **Backend:** Firebase Auth + Firestore + Storage (ad images); existing project id **`mcl-rack-builder`**
- **Source:** GitHub
- **Hosting:** see `ARCHITECTURE.md` (recommendation: Firebase Hosting for the combined SPA; keep GitHub Pages URL redirect or dual-publish for Ribbon Rack during transition)

## Recommended repo name & strategy

See also `PROJECTPLAN.md` Phase 0 and `OPEN_QUESTIONS.md`.

**Recommended name:** `mcl-portal`

Alternatives:

| Name | Notes |
|------|--------|
| **`mcl-portal`** (recommended) | Clear, short, grows beyond Florida |
| `mcl-dof-portal` | Emphasizes Florida-first; rename later for national |
| `mcl-member-tools` | Accurate but vague for staff/report workflows |

**Recommended strategy: new repo `mcl-portal`, do not rewrite history of RibbonRackBuilder.**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A. New repo `mcl-portal`** | Clean app shell; RibbonRack stays a stable submodule/package or copied feature with preserved `ribbon-profiles` Firestore collection; live GH Pages URL can keep serving old app until cutover | Two repos to maintain briefly | **Recommend** |
| B. Extend RibbonRackBuilder in place | One repo; Firebase already wired | Couples portal to a product named for one feature; messier base-href / branding; harder to keep “revertible” ribbon CSS story | Acceptable only if Billy prefers single repo |
| C. Monorepo with apps/ | Clean long-term | Heavier tooling for MVP | Later, not Phase 0 |

**Preserve:**

- Live URL `https://bhartman21.github.io/RibbonRackBuilder/` until cutover (redirect or “moved” banner).
- Firestore collection **`ribbon-profiles`** (do not rename or migrate in MVP).
- Firebase project **`mcl-rack-builder`** (add new collections alongside; update Auth authorized domains when adding Hosting).
- Legacy ribbon CSS: keep as `styles-ribbon-legacy.css` (or git tag `ribbon-pre-bootstrap`) so Bootstrap conversion is reversible without touching ribbon PNGs or rack layout math.

## Doc map

| File | Purpose |
|------|---------|
| [PROJECTPLAN.md](./PROJECTPLAN.md) | Phases, milestones, checklists, acceptance criteria, risks |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Angular structure, routes, Firebase models, security rules outline, deploy |
| [ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md) | Roles + permission matrix |
| [STYLE_GUIDE.md](./STYLE_GUIDE.md) | MCL palette → Bootstrap 5 variables |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | Decisions still needed from the owner |
| [features/VAVS.md](./features/VAVS.md) | VAVS feature spec |
| [features/AD_BOOK.md](./features/AD_BOOK.md) | Ad Book feature spec |
| [features/RIBBON_RACK.md](./features/RIBBON_RACK.md) | Ribbon Rack feature spec |

## Reference apps (research sources)

| App | URL / repo | Role |
|-----|------------|------|
| VAVS sample | https://florida-vavs-service-tracker.exact-morel-2433.chatgpt.site/ | UX + field/export reference (localStorage prototype) |
| Ad Book sample | https://booklet-ad-studio.sgtmajgna.chatgpt.site/ | Layout/print UX reference (client-only) |
| RibbonRackBuilder | https://github.com/bhartman21/RibbonRackBuilder · https://bhartman21.github.io/RibbonRackBuilder/ | Production baseline to integrate |

## Getting started (placeholder for implementers)

```bash
# After repo is created (not done by this planning task):
git clone https://github.com/bhartman21/mcl-portal.git
cd mcl-portal
npm install
# Configure src/environments or firebase-config from secrets (never commit)
ng serve
```

Phase 0 will define exact Angular workspace generation commands and Firebase CLI setup. Do **not** modify the existing RibbonRackBuilder repo until a cutover plan is approved.

## Conventions in these docs

- **Decided** = owner confirmed.
- **Inferred** = from research or reasonable default; confirm if wrong.
- **Open** = listed in `OPEN_QUESTIONS.md`.
- Pushback / risks are called out explicitly; do not paper over them.
