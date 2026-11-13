# Project Plan — MCL Portal

## Goals

Ship a single Angular 21 + Bootstrap 5 + Firebase portal for **MCL Department of Florida** members and staff that:

1. Replaces the ChatGPT VAVS sample with multi-user, role-scoped hours tracking + audit + CSV/print.
2. Replaces the Ad Studio sample with configurable sizes, books per event, and an approval workflow.

**RibbonRackBuilder** remains a **separate** site/repo. Portal may link to it externally only. See “Future / optional” at the end of this file.

## Non-goals (this project)

- Integrating, porting, or Bootstrap-converting RibbonRackBuilder.
- Ship’s Store shopping list or order API.
- Sharing Firebase project / `ribbon-profiles` with the ribbon site.
- National multi-department tenancy beyond DoF data seeding (later).
- Payment processing for ads (open policy; out of MVP).
- Company advertiser self-serve accounts (post-MVP; design hooks only).

## Repo & Firebase (decided)

- **GitHub:** public `bhartman21/mcl-portal`
- **Firebase:** **new** project recommended, id **`mcl-portal`** → default Hosting `https://mcl-portal.web.app` (exact project id may differ if taken). Do **not** reuse `mcl-rack-builder`.
- **Hosting:** Firebase Hosting default URL for launch.

---

## Phase overview

| Phase | Name | Outcome |
|-------|------|---------|
| **0** | Portal shell | Angular app, Bootstrap, Auth, roles, detachments, VAVS/Ad stub routes; external RibbonRack link optional |
| **1** | MVP Ad Book | Draft ads, sizes config, submit/approve/reject, books per event, Storage images |
| **2** | MVP VAVS | Members log hours; reps edit scoped data with audit; CSV/print/instructions |
| **3** | Polish & DoF rollout | Hardening, docs, training, decommission ChatGPT sample URLs |
| **4+** | Later enhancements | National, payments, company accounts, dashboards, etc. |

**Dependency order:** 0 → 1 (Ad Book) → 2 (VAVS) → 3 → 4+. Prefer finishing **both MVPs** before polish.

> **Order change (Nov 13, 2026, decided by Billy):** Ad Book Studio is now Phase 1 and VAVS is Phase 2, matching the first build commit, which built Ad Book screens first. Build agents should finish the Ad Book MVP, then move to VAVS.

---

## Phase 0 — Portal shell + auth + roles + detachment directory

### Milestone

Runnable app on Firebase Hosting (or local `ng serve`) with login, role claims/docs, nav to stub feature pages, seeded Florida detachments.

### Tasks

- [ ] Angular 21 standalone app; Bootstrap 5 + `@angular/fire`.
- [ ] Create / wire **new** Firebase project (preferred id `mcl-portal`: Auth, Firestore, Storage, Hosting); config via environment/secret, not committed.
- [ ] Shared layout: header, footer, nav (VAVS, Ad Book); optional external “Ribbon Rack” link to https://bhartman21.github.io/RibbonRackBuilder/
- [ ] STYLE_GUIDE tokens mapped to Bootstrap SCSS variables.
- [ ] Auth: email link and/or Google (**open** — default email link **inferred**).
- [ ] User profile document + role assignment model (see `ROLES_AND_PERMISSIONS.md`), including registration-mode lock-down switch.
- [ ] Seed `detachments`: #54 = **Morris F Dixon Jr.**; S/Sgt Ted Archambault with `needsVerification: true` (number unconfirmed).
- [ ] Admin UI: users, roles, detachments, registration mode.
- [ ] Deploy pipeline (GitHub Actions → Firebase Hosting).
- [ ] App README with run/deploy steps.

### Acceptance criteria

1. Unauthenticated user sees landing + sign-in; cannot write VAVS/Ad collections.
2. New sign-in is auto-granted `member` while `settings/registration.mode == 'open'`; with `mode == 'approval'` the user sees pending and cannot write.
3. Department admin can assign `detachmentVavsRep` scoped to a detachment id.
4. Detachment directory lists DoF entries; UI marks `needsVerification` for admins.
5. Routes `/vavs` and `/ad-book` exist as stubs with auth guards (no `/ribbons` in-app route).
6. Theme matches STYLE_GUIDE (navy/scarlet/gold).
7. Hosting serves from the new Firebase project’s default URL.

### Exit risks

- Hard-coding admin to one email does **not** scale; Phase 0 must use role docs/custom claims.
- Creating Firebase project id `mcl-portal` may fail if taken — pick nearest available and record in env docs.

---

## Phase 1 — MVP Ad Book

**Spec:** `features/AD_BOOK.md`

### Tasks

- [ ] Configurable ad sizes (seed: full, half, quarter, business card) with dimensions.
- [ ] Ad draft editor (photo/layout inspired by sample; Storage for images — not only base64 in Firestore).
- [ ] Workflow: `draft` → `submitted` → `approved` | `rejected` (with notes).
- [ ] `adBooks` per event/convention with status and page assembly.
- [ ] Approver queue for staff roles.
- [ ] Print / Save PDF via browser print for book preview (MVP).
- [ ] Authenticated users can create drafts (**inferred**; company accounts later).

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

## Phase 2 — MVP VAVS

**Spec:** `features/VAVS.md`

### Tasks

- [ ] Port Activity + In-kind field sets, categories, reporting instructions from sample.
- [ ] Member CRUD on own entries for selected period + detachment.
- [ ] Detachment VAVS rep: R/W entries for their detachment(s); department rep: whole department.
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

## Phase 3 — DoF rollout polish

- [ ] Training one-pager for VAVS reps and ad approvers.
- [ ] Confirm Archambault detachment number; clear `needsVerification`.
- [ ] Monitoring: Auth error rates, Storage quotas.
- [ ] Point ChatGPT sample links to the portal (or retire them).
- [ ] Backup/export runbooks for VAVS periods.

### Acceptance criteria

Department staff complete one real reporting period export and one ad book print for a convention without engineering help.

---

## Phase 4+ — Later enhancements (backlog)

- National multi-department tenancy
- Company advertiser accounts + public draft entry
- Payments for ads
- Dashboards (hours by detachment, ad fill rate)
- Server-side PDF generation
- Offline PWA for VAVS
- **Guarded AI Image / Asset Assistant (reusable)**: Reusable Angular component + Firebase Cloud Function proxy (e.g. Gemini free tier / provider-agnostic) accepting 1–2 reference photos and structured, topic-locked prompts with per-user rate limits. Initially for Ad Book Studio artwork, designed cleanly so other portal features can reuse it later.

---

## Cross-cutting milestones

| Milestone | Definition of done |
|-----------|-------------------|
| M0 Shell live | Phase 0 AC met on Firebase Hosting default URL |
| M1 Ad MVP | Phase 1 AC met; one event book created |
| M2 VAVS MVP | Phase 2 AC met; DoF pilot detachment using it |
| M3 Production DoF | Phase 3 AC met |

## Risks (pushback)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Firebase project id `mcl-portal` unavailable | Low | Use alternate id; keep Hosting default URL; document in README |
| Ad approval without payment | Med | Offline process; status ≠ paid |
| ChatGPT samples set UX expectations that conflict with Bootstrap | Low | Spec fields over pixels |
| Department-wide VAVS edit power is sensitive | High | Audit trail mandatory; optional soft-delete |
| Accidental coupling to RibbonRack Firebase | High | Dedicated `mcl-portal` project; no `ribbon-profiles` in this app |

## Suggested timeline (inferred — not owner-committed)

| Phase | Effort (rough) |
|-------|----------------|
| 0 | 1–2 weeks |
| 1 (Ad Book) | 2–4 weeks |
| 2 (VAVS) | 2–3 weeks |
| 3 | 1 week |

Adjust for volunteer availability; do not treat as a contract.

---

## Future / optional: RibbonRackBuilder

**Out of scope for `mcl-portal`.** If pursued later, do the work **in the RibbonRackBuilder repo** (https://github.com/bhartman21/RibbonRackBuilder), not by folding it into this portal unless Billy revisits the decision.

Possible future work *there* (see deferred `features/RIBBON_RACK.md`):

- Ship’s Store **shopping list** (printable / emailable; no external order API — Ship’s Store does not accept orders from other sites).
- Optional Bootstrap conversion of chrome **preserving** rack/ribbon CSS (legacy stylesheet + git tag for revert).
- PIN / Firestore security hardening (backlog).
- Optional later “portal deep-link” or shared SSO — only if both products intentionally share Auth; default remains isolated Firebase projects.

Portal may keep a simple external nav link to https://bhartman21.github.io/RibbonRackBuilder/ indefinitely.
