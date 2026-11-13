# Feature Spec — Ad Book Studio

## Summary

Multi-user replacement for the ChatGPT **Program Booklet Ad Studio** sample, expanded with configurable ad sizes, **event books**, Firebase Storage images, and an **approval workflow**. Payment is **out of MVP** (open policy question).

**Reference:** https://booklet-ad-studio.sgtmajgna.chatgpt.site/  
**Phase:** 2 (after Phase 0; parallelizable with VAVS)  
**Priority:** MVP (with VAVS)

## Actors

| Actor | Capability |
|-------|------------|
| Member (authenticated) | Create/edit drafts; submit; resubmit after reject |
| Company advertiser | Post-MVP (same flow when enabled) |
| Ad book approver / editor | Approval queue; approve/reject with notes; assemble books; print |
| Department admin | All approver powers + size config |
| Guest | No create (**inferred** Auth required) |

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

- **Submit:** validation (image required, size selected).
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
