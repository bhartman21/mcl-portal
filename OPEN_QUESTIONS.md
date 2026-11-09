# Open Questions — MCL Portal

Decisions still needed from Billy / DoF stakeholders. Planning docs mark interim defaults as **inferred** where noted.

## Top priority (block or strongly shape MVP)

1. ~~**Repo visibility & ownership**~~ **Decided (Nov 9, 2026):** public repo `bhartman21/mcl-portal`. Keep secrets (Firebase config, service keys) out of the repo; inject via CI secrets.

2. **Canonical production URL / hosting**  
   Accept recommendation (Firebase Hosting on `mcl-rack-builder`) or prefer custom domain (e.g. `portal.mclflorida.org` — example only)? Who controls DNS?

3. **Default role on first login**  
   Auto-grant `member`, or require department admin approval before any VAVS/Ad write?

4. **Ad payment (explicitly out of MVP — still need policy)**  
   How will staff know an approved ad is paid (cash/check/external)? Status field later? Honor system?

5. **Detachment #54 duplicate**  
   Which display name is correct for #54 (Morris F Dixon Jr vs S/Sgt Ted Archambault), or are both valid under different numbers? Blocks clean directory seeding.

## Product policy

6. May **unauthenticated** users create ad drafts, or Auth required? (Inferred: Auth required for MVP.)

7. When companies are allowed: same Auth provider, or invite-only accounts?

8. After **reject**, can submitter edit and resubmit freely? (Inferred: yes.)

9. Can a member delete an ad after **submit** or only while **draft**? (Inferred: withdraw submit → draft.)

10. VAVS: can members export CSV for **only their** entries, or export is rep-only? (Inferred: members print/export own; reps export scope.)

11. VAVS in-kind: keep **undated** (sample) or require dates for period filtering?

12. Should department VAVS reps see **all detachments by default**, or pick one?

## Auth & identity

13. Email-link only (match RibbonRack) vs Google vs both?

14. Tie Ribbon `profileId` to Auth `uid` eventually, or keep forever-separate PIN profiles?

15. Replace hard-coded admin email with roles in Phase 0 or Phase 3?

## Ribbon / Ship’s Store

16. Exact shopping-list line items beyond ribbons + stars (mounting bars, frames, devices SKUs)? Any official Ship’s Store catalog PDF to encode?

17. Email shopping list via `mailto:` only, or also generate PDF attachment? (Inferred: print + mailto/copy for MVP.)

## Data & compliance

18. Retention policy for VAVS audit logs and ad images?

19. PII (email/phone on ribbon profiles) — any DoF privacy requirements?

20. Staging Firebase project vs build against prod with emulators only?

## Branding

21. Official DoF / MCL logo files and usage rules for header?

22. Portal product name for UI (“MCL DoF Portal”, “Marine Corps League Member Tools”, other)?

## National later

23. When national expands: single Firebase project multi-tenant, or separate projects per department?

---

## Resolved (for reference)

| Topic | Decision |
|-------|----------|
| Audience first | DoF members + staff; national later |
| Stack | Angular 21 + Bootstrap 5 + Firebase (existing `mcl-rack-builder`) |
| Priority | Shell → VAVS MVP + Ad Book MVP → Ribbon integration |
| Ribbon PIN | Keep as-is; security backlog |
| Ribbon CSS | Bootstrap chrome OK; preserve legacy CSS; don’t break ribbons/rack |
| Ad layouts | Expand beyond full/half; configurable sizes |
| Ad approval | Required before book inclusion |
| Payment | Not in MVP |
| VAVS roles | Members log own; det/dept reps monitor & modify; audit trail |
| Shopping list | For Ship’s Store (no external order API) |
