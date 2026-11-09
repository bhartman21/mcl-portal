# Project Plan — MCL Portal

## Goals

Ship a single Angular 21 + Bootstrap 5 + Firebase portal for **MCL Department of Florida** members and staff that:

1. Replaces the ChatGPT VAVS sample with multi-user, role-scoped hours tracking + audit + CSV/print.
2. Replaces the Ad Studio sample with configurable sizes, books per event, and an approval workflow.
3. Integrates Ribbon Rack Builder (shopping list for Ship’s Store; Bootstrap chrome without breaking rack/ribbons; PIN kept as-is).

## Non-goals (MVP)

- National rollout / multi-department tenancy beyond DoF data seeding.
- Payment processing for ads (open question; out of MVP).
- Company advertiser self-serve accounts (post-MVP; design hooks only).
- Hardening Ribbon Rack PIN / Firestore rules for public profiles (backlog).
- Ship’s Store API/order integration (not possible; shopping list only).
- Rewriting ribbon PNG assets or rack row/star layout algorithms.

## Recommended repo

- **Name:** `mcl-portal` (alt: `mcl-dof-portal`, `mcl-member-tools`)
- **Strategy:** **New repo**; keep RibbonRackBuilder live until feature parity + redirect; reuse Firebase project `mcl-rack-builder` and collection `ribbon-profiles`.

---

## Phase overview

| Phase | Name | Outcome |
|-------|------|---------|
| **0** | Portal shell | Angular app, Bootstrap, Auth, roles, detachments, empty feature routes |
| **1** | MVP VAVS | Members log hours; reps edit scoped data with audit; CSV/print/instructions |
| **2** | MVP Ad Book | Draft ads, sizes config, submit/approve/reject, books per event, Storage images |
| **3** | Ribbon Rack integration | Port feature; shopping list; legacy CSS preserved; Bootstrap chrome |
| **4** | Polish & DoF rollout | Hardening, docs, training, decommission ChatGPT URLs |
| **5+** | Later | National, payments, company accounts, dashboards, ribbon security |

**Dependency order:** 0 → (1 ∥ 2) → 3 → 4 → 5+. Prefer finishing **1 and 2 before 3** (owner priority).

---

## Phase 0 — Portal shell + auth + roles + detachment directory

### Milestone

Runnable app on Firebase Hosting (or local `ng serve`) with login, role claims/docs, nav to stub feature pages, seeded Florida detachments.

### Tasks

- [ ] Create public GitHub repo `bhartman21/mcl-portal` (decided Nov 9, 2026). Never commit Firebase config or keys; use GitHub Actions secrets.
- [ ] `ng new` Angular 21 standalone app; add Bootstrap 5 + `@angular/fire` matching RibbonRackBuilder versions where practical.
- [ ] Wire Firebase project `mcl-rack-builder` (Auth, Firestore, Storage); config via environment/secret, not committed.
- [ ] Shared layout: header, footer, nav (VAVS, Ad Book, Ribbon Rack stubs), STYLE_GUIDE tokens mapped to Bootstrap SCSS variables.
- [ ] Auth: email link and/or Google (**open** — default email link to match RibbonRack).
- [ ] User profile document + role assignment model (see `ROLES_AND_PERMISSIONS.md`).
- [ ] Seed `detachments` collection from VAVS sample list; #54 = Morris F Dixon Jr. Detachment; S/Sgt Ted Archambault seeded with `needsVerification: true` (number unconfirmed).
- [ ] Admin UI (department admin only): list users, assign roles, edit detachments.
- [ ] Deploy pipeline (GitHub Actions → Firebase Hosting recommended).
- [ ] README in app repo with run/deploy steps.

### Acceptance criteria

1. Unauthenticated user sees landing + sign-in; cannot write VAVS/Ad collections.
2. New sign-in is auto-granted `member` while `settings/registration.mode == 'open'`; with `mode == 'approval'` the user sees a pending screen and cannot write.
3. Department admin can assign `detachmentVavsRep` scoped to a detachment id.
4. Detachment directory lists 43 DoF entries; UI marks entries with `needsVerification` for admins.
5. Routes `/vavs`, `/ad-book`, `/ribbons` exist as stubs with auth guards.
6. Theme matches STYLE_GUIDE (navy/scarlet/gold).

### Exit risks

- Reusing `mcl-rack-builder` mixes prod ribbon data with new collections — mitigate with clear collection prefixes and rules.
- Hard-coding admin to one email (current RibbonRack pattern) does **not** scale; Phase 0 must use role docs/custom claims.

---

## Phase 1 — MVP VAVS

**Spec:** `features/VAVS.md`

### Tasks

- [ ] Port Activity + In-kind field sets, categories, reporting instructions from sample.
- [ ] Member CRUD on own entries for selected period + detachment.
- [ ] Detachment VAVS rep: read/update/delete entries for their detachment(s); department rep: whole department.
- [ ] Audit log on every create/update/delete by a rep (and optionally all writes).
- [ ] Live totals matching sample semantics (tolls, hours, cash, in-kind VA/non-VA, miles).
- [ ] CSV export + print report (period/week/month/custom).
- [ ] Half-year reporting periods + year.
- [ ] Optional: import JSON backup from sample for migration testing.

### Acceptance criteria

1. Member A cannot edit Member B’s entries; detachment rep for A’s detachment can.
2. Department rep can export CSV for all DoF detachments for a period.
3. Totals match sample formulas for a golden fixture dataset.
4. Every rep edit creates an audit document with who/when/before/after (or field diffs).
5. Print and CSV include org, detachment, period, both worksheets.
6. Archambault entry stays separate from #54 Morris F Dixon Jr.

### Dependencies

Phase 0 roles + detachments.

---

## Phase 2 — MVP Ad Book

**Spec:** `features/AD_BOOK.md`

### Tasks

- [ ] Configurable ad sizes (seed: full, half, quarter, business card) with dimensions.
- [ ] Ad draft editor (photo/layout inspired by sample; Storage for images — not only base64 in Firestore).
- [ ] Workflow: `draft` → `submitted` → `approved` | `rejected` (with notes).
- [ ] `adBooks` (or `books`) per event/convention with status and page assembly.
- [ ] Approver queue for staff roles.
- [ ] Print / Save PDF via browser print for book preview (MVP).
- [ ] Anyone authenticated can create drafts (**inferred** for MVP; public company accounts later).

### Acceptance criteria

1. Member creates full/half/quarter/business-card ad; image in Storage; metadata in Firestore.
2. Submit moves status; editor cannot change approved content without resubmit (**inferred** policy).
3. Approver can approve/reject with notes; reject returns to editable state.
4. Approved ads can be added to an event book; print preview shows Letter pages.
5. Payment fields absent or marked “not collected” — no checkout.

### Dependencies

Phase 0 auth/roles; Storage rules.

### Pushback

Approval without payment means unpaid ads can be approved — process must be offline (cash/check). Document that risk; do not fake a payment system in MVP.

---

## Phase 3 — Ribbon Rack integration

**Spec:** `features/RIBBON_RACK.md`

### Tasks

- [ ] Port builder, rack-visualizer, ribbon-data, star-calculator, admin into portal (copy or library).
- [ ] Keep `ribbon-profiles` schema and PIN behavior.
- [ ] **Shopping list:** printable/emailable list of ribbons, star devices, mounting bar/frame notes for Ship’s Store (no cart API).
- [ ] Convert chrome (header, forms, buttons) to Bootstrap; **do not** change ribbon PNGs or rack display CSS without a dual-path.
- [ ] Preserve legacy styles: e.g. `src/styles/ribbon-legacy.css` + git tag `pre-bootstrap-ribbon-chrome`; document revert steps.
- [ ] Cutover plan for GH Pages URL (banner → redirect).

### Acceptance criteria

1. Existing profile IDs load/save against same Firestore collection.
2. Shopping list enumerates selected ribbons + computed devices + optional mount/frame line items; print + `mailto:` or copy.
3. Visual rack matches pre-port layout within agreed tolerance (screenshot diff optional).
4. Legacy CSS can be re-enabled via documented flag/import without rebuilding PNGs.
5. Admin guard uses portal roles (not only hard-coded email) — **or** keep email check temporarily (**open**); prefer roles.

### Dependencies

Phases 0–2 preferably shipped so ribbon work does not block VAVS/Ad MVP.

---

## Phase 4 — DoF rollout polish

- [ ] Training one-pager for VAVS reps and ad approvers.
- [ ] Seed production detachment list after confirming the Archambault detachment number.
- [ ] Monitoring: Auth error rates, Storage quotas.
- [ ] Decommission ChatGPT sample links (or point them to portal).
- [ ] Backup/export runbooks for VAVS periods.

### Acceptance criteria

Department staff complete one real reporting period export and one ad book print for a convention without engineering help.

---

## Phase 5+ — Later enhancements (backlog)

- National multi-department tenancy
- Company advertiser accounts + public draft entry
- Payments for ads
- Dashboards (hours by detachment, ad fill rate)
- Ribbon security: hash PINs, tighten Firestore rules, Auth-bound profiles
- Server-side PDF generation
- Offline PWA for VAVS

---

## Cross-cutting milestones

| Milestone | Definition of done |
|-----------|-------------------|
| M0 Shell live | Phase 0 AC met on Hosting |
| M1 VAVS MVP | Phase 1 AC met; DoF pilot detachment using it |
| M2 Ad MVP | Phase 2 AC met; one event book created |
| M3 Ribbons in portal | Phase 3 AC met; shopping list used by ≥1 member |
| M4 Production DoF | Phase 4 AC met |

## Risks (pushback)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Firebase project shared with live RibbonRack — bad rules wipe/expose data | High | Rules review before go-live; separate collections; staging project if possible (**open**) |
| PIN-in-Firestore remains weak | Med (accepted) | Document; backlog; do not expand PIN pattern to VAVS |
| Ad approval without payment | Med | Offline process; status ≠ paid |
| ChatGPT samples set UX expectations that conflict with Bootstrap | Low | Spec fields over pixels |
| Dual hosting (GH Pages + Firebase) confuses members | Med | Single canonical URL after M3 |
| Department-wide VAVS edit power is sensitive | High | Audit trail mandatory; optional soft-delete |

## Suggested timeline (inferred — not owner-committed)

| Phase | Effort (rough) |
|-------|----------------|
| 0 | 1–2 weeks |
| 1 | 2–3 weeks |
| 2 | 2–4 weeks |
| 3 | 2–3 weeks |
| 4 | 1 week |

Adjust for volunteer availability; do not treat as a contract.
