# Feature Spec — Ad Book Studio

## Summary

Multi-user replacement for the ChatGPT **Program Booklet Ad Studio** sample, expanded with configurable ad sizes, **event books**, Firebase Storage images, and an **approval workflow**. Payment is **out of MVP** (open policy question).

**Reference:** https://booklet-ad-studio.sgtmajgna.chatgpt.site/  
**Phase:** 1 (after Phase 0 shell; reordered ahead of VAVS on Nov 13, 2026)  
**Priority:** MVP (with VAVS)

## Actors

| Actor | Capability |
|-------|------------|
| Member (authenticated) | Create/edit drafts; submit; resubmit after reject (max 3 submissions per ad); withdraw a submitted ad; delete only drafts |
| Company advertiser | Post-MVP (same flow when enabled) |
| Ad book approver / editor | Approval queue; approve/reject with notes; assemble books; print |
| Department admin | All approver powers + size config |
| Guest | No create (sign-in required, decided Nov 14, 2026) |

## User stories

1. As a member, I upload a full-page ad image, crop it, and submit it for the 2026 DoF Convention book.
2. As an approver, I reject an ad with notes (“logo too low-res”); the member fixes and resubmits.
3. As an editor, I place approved quarter-page ads onto Letter pages and print a proof PDF via the browser.
4. As admin, I add a custom size “two-thirds” later without a code change (config collection).

## Functional requirements

### FR-A-1 Configurable sizes

Seed `adSizes`:

| id | Label | Approx live area (inferred from sample margins) | slotsPerPage (inferred) |
|----|-------|--------------------------------------------------|-------------------------|
| `full` | Full-page | 7.5 × 10 in | 1 |
| `half` | Half-page horizontal | 7.5 × 4.875 in | 2 |
| `quarter` | Quarter-page | ~3.625 × 4.875 in (**inferred**) | 4 |
| `business_card` | Business card | ~3.5 × 2 in (**inferred**) | 8 |

Exact inches are **configurable** in admin UI; table above is seed only — mark inferred dimensions for quarter/card until DoF confirms.

### FR-A-2 Ad editor

Inspired by sample:

- Project/ad title
- Choose size
- Upload image (jpeg/png/webp) → **Storage** (not only base64 in Firestore)
- Fit: cover / contain
- Position x/y (0–100)
- Desktop drag-to-reposition when cover (**nice-to-have** MVP)
- Preview frame matching size aspect ratio

**Pushback:** Do not rely on downloading giant JSON with embedded base64 as the only save path; use Storage + Firestore metadata. Optional “export project JSON” for offline handoff is fine as secondary.

### FR-A-3 Workflow states

```
draft → submitted → approved
                 ↘ rejected → draft (after edit)
```

- **Submit:** validation (image required, size selected). Increments `submissionCount`.
- **Submission limit (decided Nov 14, 2026):** max **3** submissions per ad. After the 3rd rejection the ad is locked as `rejected` (`locked: true`); member sees "submission limit reached". A department or national **administrator** can reset the lock (decided Nov 14, 2026): clears `locked`, sets `submissionCount` back to 0, ad returns to `draft`; reset is audited (who, when, reason).
- **Withdraw:** owner may withdraw a `submitted` ad back to `draft` (attempt is not refunded, **inferred**).
- **Delete:** owner may delete only while `draft`; never after approval.
- **Approve / Reject:** approver only; reject requires notes (min length **inferred** 5 chars).
- **Approved** ads are eligible for placement in a book.
- Editing approved ads: require “recall to draft” or new version — **inferred:** force resubmit path (status back to draft clears approval).

### FR-A-4 Books (events)

`adBooks` entity:

- Title, event name, event date, status (`draft` \| `open` \| `locked` \| `printed`)
- Department scope `dof` for MVP
- Approvers add approved ads to book / order pages
- Lock prevents new placements

### FR-A-5 Print / PDF

MVP: browser `window.print()` like sample (Letter, hide chrome, 0.5 in margins).  
Server PDF generation = backlog.

### FR-A-6 Payment

**Not in MVP.** UI must not claim payment collected. Optional future field `paymentStatus`. Document offline process for staff (OPEN_QUESTIONS).

## Data model

See `ARCHITECTURE.md` → `ads`, `adBooks`, `adSizes`, Storage `ad-images/...`.

## Acceptance criteria (MVP)

1. Authenticated user creates ads in all four seed sizes; image stored in Storage; metadata in Firestore.
2. Submit → appears in approver queue; owner cannot approve own ad unless also approver (**inferred** allow if dual-role — document).
3. Reject with notes returns ad to editable state; notes visible to owner.
4. Approve enables placement into an `open` book; `locked` book rejects new placements.
5. Print preview of a book shows Letter pages without app chrome.
6. Admin can deactivate a size or add a new size; editor only offers `active` sizes.
7. Unauthenticated users cannot create ads (rules + UI).
9. A 4th submission of the same ad is rejected by both UI and Firestore rules; `submissionCount` cannot be lowered by the owner.
10. Owner can delete a draft but not a submitted/approved/rejected ad; withdraw moves submitted → draft.
11. An administrator can reset a locked ad; the member can then submit up to 3 more times, and the reset appears in the audit log.
8. No payment checkout UI in MVP.

## Non-functional

- Max upload size: recommend **10 MB** (sample allowed 30 — pushback: lower for Storage cost/mobile).
- Images private by default; readable by owner + approvers; public download only if product later needs share links (**inferred** private).

## Out of scope (MVP)

- Payments / invoicing
- Company self-registration
- Drag-and-drop multi-ad page designer beyond simple ordering
- Bleed/crop marks for commercial press (may note in print footer)
- **Guarded AI Ad Assistant (Phase 4+ backlog)**: Reusable prompt-guarded image generator accepting 1–2 reference photos via a Firebase Cloud Function proxy (e.g. Google Gemini free tier or equivalent), locked to MCL Ad Book aspect ratios and subject matter.

## Implementation notes for agents

- Lazy route module `features/ad-book`.
- Use Angular Fire Storage upload with progress bar.
- Reuse STYLE_GUIDE header; Bootstrap cards for queue list.
- Seed sizes via admin script or first-run migration.
