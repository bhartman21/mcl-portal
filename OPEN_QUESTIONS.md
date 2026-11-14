# Open Questions — MCL Portal

Decisions still needed from Billy / DoF stakeholders. Planning docs mark interim defaults as **inferred** where noted.

## Top priority (block or strongly shape MVP)

1. ~~**Repo visibility & ownership**~~ **Decided (Nov 9, 2026):** public repo `bhartman21/mcl-portal`. Keep secrets out of the repo; inject via CI secrets.

2. ~~**Canonical production URL / hosting**~~ **Decided (Nov 9, 2026):** Firebase Hosting **default URL** for launch. A custom domain may be added later; keep app config domain-agnostic.

3. ~~**Default role on first login**~~ **Decided (Nov 9, 2026):** auto-approve. New sign-ins get `member` immediately. Registration-mode lock-down switch (`open` | `approval`) built in Phase 0.

4. **Ad payment (explicitly out of MVP — still need policy)**  
   How will staff know an approved ad is paid (cash/check/external)? Status field later? Honor system?

5. ~~**Detachment #54 duplicate**~~ **Decided (Nov 9, 2026):** #54 is the **Morris F Dixon Jr. Detachment**. S/Sgt Ted Archambault Detachment keeps a separate seed entry with `needsVerification: true` and **no number** until confirmed.

6. **Firebase project id (default, not a blocker)**  
   **Recommended (Nov 9, 2026 docs update):** create a **new** Firebase project with preferred id **`mcl-portal`** (Hosting `https://mcl-portal.web.app`) instead of reusing `mcl-rack-builder`, so RibbonRackBuilder’s data/auth stay isolated and the default URL reads correctly. Exact id may differ if taken — record the actual id in env/CI. Proceed with this default unless Billy objects.

## Product policy

7. ~~May unauthenticated users create ad drafts?~~ **Decided (Nov 14, 2026):** sign-in required. Members sign in with their email address and a sign-in link emailed to them (see question 14).

8. When companies are allowed: same Auth provider, or invite-only accounts?

9. ~~After reject, can the submitter resubmit freely?~~ **Decided (Nov 14, 2026):** an ad may be submitted at most **3 times** in total. After the 3rd rejection it is locked as `rejected`; only an ad book approver or department admin can grant another attempt (**inferred** escape hatch, confirm).

10. ~~Can a member delete an ad after submit?~~ **Decided (Nov 14, 2026):** delete only while `draft`; withdrawing a `submitted` ad returns it to `draft` (does not refund a submission attempt, **inferred**).

11. VAVS: can members export CSV for **only their** entries, or export is rep-only? (Inferred: members print/export own; reps export scope.)

12. VAVS in-kind: keep **undated** (sample) or require dates for period filtering?

13. Should department VAVS reps see **all detachments by default**, or pick one?

## Auth & identity

14. ~~Email-link only vs Google vs both?~~ **Decided (Nov 14, 2026, final):** Firebase's built-in, free **email sign-in link** (passwordless). The emailed one-time-code idea was dropped because it needs Cloud Functions, the Blaze plan, and a paid email service. Google sign-in may be added later.

15. Replace any temporary hard-coded admin bootstrap with role docs in Phase 0 (expected yes).

## Data & compliance

16. Retention policy for VAVS audit logs and ad images?

17. Staging Firebase project vs build against prod with emulators only?

## Branding

18. Official DoF / MCL logo files and usage rules for header?

19. Portal product name for UI (“MCL DoF Portal”, “Marine Corps League Member Tools”, other)?

## National later

20. When national expands: single Firebase project multi-tenant, or separate projects per department?

---

## Deferred (RibbonRackBuilder repo — not portal blockers)

Moved out of portal open questions (Nov 9, 2026: ribbon stays separate):

- Shopping-list line items / Ship’s Store catalog encoding  
- Shopping-list email vs PDF  
- Tie ribbon `profileId` to Auth `uid`  
- Ribbon PIN / profile PII hardening  
- Bootstrap conversion of ribbon chrome  

See `features/RIBBON_RACK.md` and PROJECTPLAN “Future / optional”.

---

## Resolved (for reference)

| Topic | Decision |
|-------|----------|
| Audience first | DoF members + staff; national later |
| Portal scope | **VAVS + Ad Book only**; RibbonRackBuilder separate |
| Stack | Angular 21 + Bootstrap 5 + Firebase |
| Firebase project | **New** `mcl-portal` recommended (not `mcl-rack-builder`) |
| Hosting | Firebase Hosting default URL |
| Repo | Public `bhartman21/mcl-portal` |
| Priority | Shell → Ad Book MVP (Phase 1) → VAVS MVP (Phase 2) → polish (reordered Nov 13, 2026) |
| Registration | Auto-approve members + lock-down switch |
| #54 | Morris F Dixon Jr.; Archambault needs verification |
| Ad layouts | Expand beyond full/half; configurable sizes |
| Ad approval | Required before book inclusion |
| Payment | Not in MVP |
| VAVS roles | Members log own; det/dept reps monitor & modify; audit trail |
