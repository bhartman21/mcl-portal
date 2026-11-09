# MCL Portal — Planning Docs

Handoff documentation for building an **MCL Department of Florida (DoF) portal** focused on **VAVS hours tracking** and **Ad Book Studio**, with room to grow to national.

These docs are for coding agents and humans. Prefer implementing against the feature specs and `ARCHITECTURE.md`; treat sample ChatGPT sites as UX references, not as production code to copy blindly.

**Repo:** https://github.com/bhartman21/mcl-portal (public)

## Scope (decided Nov 9, 2026)

| In scope for `mcl-portal` | Out of scope (separate product) |
|---------------------------|----------------------------------|
| Portal shell (auth, roles, detachments, branding) | Ribbon Rack Builder integration / port |
| VAVS Service Tracker MVP | Bootstrap conversion of RibbonRackBuilder |
| Ad Book Studio MVP | Ship’s Store shopping list |
| Shared STYLE_GUIDE theme | Reusing Firebase project `mcl-rack-builder` |

**RibbonRackBuilder** stays its own standalone site and repo for now. The portal header/nav **may** include an **external link** to it; do not port, embed, or share its Firestore data from this project.

- Repo: https://github.com/bhartman21/RibbonRackBuilder  
- Live: https://bhartman21.github.io/RibbonRackBuilder/  
- Future notes: `features/RIBBON_RACK.md` (deferred) and PROJECTPLAN “Future / optional”

## Audience (decided)

| Who | What they use |
|-----|----------------|
| DoF MCL members (first rollout) | Log VAVS hours; create ad drafts |
| Detachment / Department VAVS reps | Monitor and edit hours for their scope; compile reports |
| Ad book editors / approvers | Review submitted ads; build program books |
| Department staff (later national) | Compile VAVS rollups; generate/approve ads for conventions |
| Public / guests | Limited: view marketing pages; later company advertisers (post-MVP) |
| All MCL members (external) | Ribbon racks via **RibbonRackBuilder** (separate site) |

## Product areas

1. **Portal shell** — auth, roles, detachment directory, shared nav/branding; optional external link to RibbonRackBuilder  
2. **VAVS Service Tracker** — volunteer hours, cash, in-kind; CSV/print; audit trail for rep edits  
3. **Ad Book Studio** — configurable ad sizes, submit → approve/reject workflow, books per event  

**Priority:** Phase 0 shell → Phase 1 MVP VAVS → Phase 2 MVP Ad Book → polish / later enhancements.

## Stack (decided)

- **Frontend:** Angular **21** (same major generation as RibbonRackBuilder for familiarity), **Bootstrap 5**
- **Backend:** Firebase Auth + Firestore + Storage (ad images)
- **Firebase project:** **new dedicated project** recommended, id **`mcl-portal`** (default Hosting URL `https://mcl-portal.web.app`). Exact id may differ if taken — see `ARCHITECTURE.md` / `OPEN_QUESTIONS.md`. **Do not** reuse `mcl-rack-builder` (keeps ribbon data/auth isolated).
- **Source:** GitHub `bhartman21/mcl-portal` (public; secrets via CI only)
- **Hosting:** Firebase Hosting **default URL** for launch (custom domain later optional)

## Repo strategy (decided)

This repo **`mcl-portal`** is the portal. RibbonRackBuilder remains a **separate** repo/site. Shared look-and-feel only via `STYLE_GUIDE.md` tokens — not shared Firebase or code modules for MVP.

## Doc map

| File | Purpose |
|------|---------|
| [PROJECTPLAN.md](./PROJECTPLAN.md) | Phases, milestones, checklists, acceptance criteria, risks |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Angular structure, routes, Firebase models, security rules outline, deploy |
| [ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md) | Roles + permission matrix |
| [STYLE_GUIDE.md](./STYLE_GUIDE.md) | MCL palette → Bootstrap 5 variables (shared visual language) |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | Decisions still needed from the owner |
| [features/VAVS.md](./features/VAVS.md) | VAVS feature spec |
| [features/AD_BOOK.md](./features/AD_BOOK.md) | Ad Book feature spec |
| [features/RIBBON_RACK.md](./features/RIBBON_RACK.md) | **Deferred** — reference for future work in RibbonRackBuilder repo |

## Reference apps

| App | URL / repo | Role |
|-----|------------|------|
| VAVS sample | https://florida-vavs-service-tracker.exact-morel-2433.chatgpt.site/ | UX + field/export reference (localStorage prototype) |
| Ad Book sample | https://booklet-ad-studio.sgtmajgna.chatgpt.site/ | Layout/print UX reference (client-only) |
| RibbonRackBuilder (related, separate) | https://github.com/bhartman21/RibbonRackBuilder · https://bhartman21.github.io/RibbonRackBuilder/ | Standalone ribbon site; external link only |

## Getting started (placeholder for implementers)

```bash
git clone https://github.com/bhartman21/mcl-portal.git
cd mcl-portal
# After Angular app scaffold (Phase 0):
npm install
# Configure Firebase from secrets / local env (never commit)
ng serve
```

Phase 0 defines Angular workspace generation and Firebase CLI setup against the **new** `mcl-portal` Firebase project (or renamed equivalent).

## Conventions in these docs

- **Decided** = owner confirmed.
- **Inferred** = from research or reasonable default; confirm if wrong.
- **Open** = listed in `OPEN_QUESTIONS.md`.
- **Deferred** = not in `mcl-portal` MVP roadmap (e.g. RibbonRackBuilder work).
- Pushback / risks are called out explicitly; do not paper over them.
