# Feature Spec — VAVS Service Tracker

## Summary

Multi-user replacement for the ChatGPT **VAVS Service Tracker** sample. DoF members log volunteer hours, cash, and in-kind donations. Detachment and department VAVS reps monitor and edit within scope. Preserve sample fields, categories, totals, CSV, print, and reporting instructions. Add Auth, detachment directory, and **audit trail**.

**Reference:** https://florida-vavs-service-tracker.exact-morel-2433.chatgpt.site/  
**Phase:** 1 (after Phase 0 shell)  
**Priority:** MVP (with Ad Book)

## Actors

| Actor | Capability |
|-------|------------|
| Member | CRUD own entries for their detachment + period |
| Detachment VAVS rep | R/W all entries for assigned detachment(s); export/print scope |
| Department VAVS rep | R/W all DoF entries; export/print department |
| Department admin | Same as dept rep + user/detachment admin |
| Guest | No access to entries |

## User stories

1. As a member, I log a multi-day VA bingo shift with hours, miles, and tolls so my detachment gets credit.
2. As a member, I record an in-kind wheelchair donation with category and VA/non-VA recipient.
3. As a detachment VAVS rep, I correct a member’s mis-categorized hours and the system records that I changed it.
4. As a department VAVS rep, I export CSV for Jul–Dec 2026 for all detachments.
5. As any authorized user, I print a period report with instructions-consistent totals.

## Functional requirements

### FR-V-1 Reporting period

- Half-year periods: Jan 1–Jun 30 / Jul 1–Dec 31 + year (sample behavior).
- Store `start`/`end`; allow viewing custom print ranges without changing saved period.

### FR-V-2 Organization & detachment

- Organization label default: `Marine Corps League — Department of Florida` (editable only by admin — **inferred**; sample allowed free edit — **pushback:** free-edit org name on every client causes inconsistent exports; lock to department record).
- Detachment selected from **data-driven** `detachments` collection (not hard-coded HTML).
- Seed from sample list; #54 = Morris F Dixon Jr.; mark S/Sgt Ted Archambault `needsVerification: true` until its number is confirmed.

### FR-V-3 Activity worksheet fields

| Field | Type | Notes |
|-------|------|-------|
| date | date | Start; sort key |
| endDate | date | Inclusive; optional for single day |
| member | string | Member / description |
| vaHours | number ≥ 0 | |
| vaDollars | number ≥ 0 | Cash to VA |
| vetHours | number ≥ 0 | Non-VA veteran hours |
| vetDollars | number ≥ 0 | Non-VA cash |
| otherHours | number ≥ 0 | Non-veteran community service |
| otherCash | number ≥ 0 | Other cash donations |
| otherDollars | number ≥ 0 | **Tolls** on activity sheet |
| miles | number ≥ 0 | |
| notes | string | Group counts, purpose, etc. |

### FR-V-4 In-kind worksheet fields

| Field | Type | Notes |
|-------|------|-------|
| member | string | |
| category | enum | Exact sample list below |
| recipient | `va` \| `nonVA` \| `` | Checkboxes mutual exclusive in sample |
| estimatedCost | number ≥ 0 | |
| notes | string | |

**Categories (keep exact labels):**  
Personal Care and Hygiene; Clothing and Footwear; Comfort Items; Recreation and Entertainment; Electronics and Technology; Therapy and Rehabilitation; Hospitality and Common Areas; Holiday and Special Events; Veteran Recognition; Professional Services; Transportation; Medical and Adaptive Equipment; Homeless Veteran and Housing Support; Food and Nutrition; Business and Community Support.

### FR-V-5 Totals

Live cards matching sample:

- Tolls (sum activity `otherDollars`)
- Other community service hours
- Other cash donations
- VA volunteer hours / Non-VA volunteer hours
- Cash to VA / Cash to non-VA veterans
- In-kind VA / In-kind non-VA
- Miles
- Warn when in-kind has cost but no recipient

**Do not** convert hours or miles to money.

### FR-V-6 Reporting instructions

Embed sample guide content (VA Hospital vs Veterans not associated with VA; Notes 1–2 on detachment-sponsored and youth group hours). Read-only help panel.

### FR-V-7 Export & print

- **CSV:** org, detachment (or “ALL”), period, activity rows + totals, kind rows + totals; UTF-8 BOM; formula-injection safety like sample (`'` prefix for leading `=+@-`).
- **Print:** dialog — this week / month / current period / custom; filter activity by overlapping dates; include all in-kind (sample) unless product changes; print-summary stats + both sheets.

### FR-V-8 Audit trail

On create/update/delete by anyone other than the `ownerUid`, and **always** when actor has a VAVS rep/admin role:

- Write `vavsAuditLogs` with actor, role, timestamps, before/after snapshots (or JSON patch).

UI: reps can open “History” for an entry (MVP: table of logs filtered by entryId).

### FR-V-9 Backup import (optional MVP+)

Accept sample `VAVS-backup.json` shape for migration testing; map `name` string to `detachmentId` when possible.

## Non-functional

- Auth required.
- Mobile-usable worksheets (stack columns like sample `@media` if needed).
- Firestore indexes: `detachmentId + periodId`, `ownerUid + periodId`, `departmentId + periodId`.

## Data model

See `ARCHITECTURE.md` → `vavsEntries`, `vavsPeriods`, `vavsAuditLogs`, `detachments`.

## Acceptance criteria (MVP)

1. Member creates activity + in-kind rows; totals update; only their rows editable by them.
2. Detachment rep edits another member’s row in-scope; audit log created; member outside detachment cannot be edited.
3. Department rep CSV includes multiple detachments for one period.
4. Print produces Letter-friendly output with period heading and both worksheets.
5. All 15 in-kind categories available; recipient validation warning works.
6. Detachment picker shows #54 as Morris F Dixon Jr.; verification badge on Archambault visible to admins.
7. Reporting instructions visible without leaving the app.
8. Guest cannot read entries via client or rules.

## Out of scope (MVP)

- Automatic eligibility for Community/VAVS ribbon in RibbonRackBuilder (separate site)
- National multi-department rollup UI
- Offline sync / PWA
- Converting miles to reimbursement $

## Implementation notes for agents

- Prefer Angular Reactive Forms or signal forms + Bootstrap tables.
- Port validation limits from sample (`valid()` roughly ≤5000 rows).
- Golden test fixture: compute totals in unit tests against known rows.
- **Do not** store VAVS data only in localStorage for production path; local draft cache optional.
