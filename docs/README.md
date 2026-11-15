# MCL Portal — Help Guides

These guides explain how to use the Marine Corps League Department of Florida Member Portal.

They only describe what is built in the portal today. Anything not built yet is marked **Planned — not available yet**.

> **Please read first: the portal is still being built.**
>
> - **Not live yet.** The portal's Firebase project is not set up yet, so the email sign-in link does not work. Until it is, the portal runs in **Local Demo Mode** and the sign-in page shows practice accounts instead. The owner's setup steps are in the [Firebase setup checklist](./admin-guide/firebase-setup.md).
> - **Ads are saved only on one computer.** Ad Book Studio keeps ads, event books, ad sizes, the Ad Book audit log, and admin notifications **only in the web browser on the computer you used**. This is true even after the portal goes live. Approvers on other computers can't see your ads yet. Saving ads to the Department's shared system is planned.
> - **The VAVS hours tracker is not built yet.**

## For members

| Guide | Status |
|-------|--------|
| [Signing in with an email link](./user-guide/signing-in.md) | Built; not live yet |
| [Building and submitting an ad](./user-guide/building-and-submitting-an-ad.md) | Built (saves on your computer only) |
| [When an ad is rejected or locked](./user-guide/rejected-or-locked-ads.md) | Built |
| [Logging VAVS hours](./user-guide/vavs-hours.md) | **Planned — not available yet** |

## For staff and administrators

| Guide | Who it is for | Status |
|-------|---------------|--------|
| [Roles: who can do what](./admin-guide/roles.md) | Administrators | Built |
| [Approving and rejecting ads](./admin-guide/ad-approvals.md) | Ad book approvers, administrators | Built (same computer only) |
| [Resetting a locked ad](./admin-guide/resetting-a-locked-ad.md) | Administrators | Built (same computer only) |
| [Notifications and audit log](./admin-guide/notifications-and-audit-log.md) | Administrators | Built (same computer only) |
| [Event books and ad sizes](./admin-guide/event-books-and-ad-sizes.md) | Ad book approvers, administrators | Built (same computer only) |
| [Registration lock-down and new members](./admin-guide/registration-lock-down.md) | Administrators | Built |
| [Detachment directory](./admin-guide/detachments.md) | Administrators | Built |
| [VAVS reps](./admin-guide/vavs-reps.md) | Detachment and Department VAVS reps | **Planned — not available yet** |

## For the site owner

| Guide | Status |
|-------|--------|
| [Firebase setup checklist (phone-first)](./admin-guide/firebase-setup.md) | One-time owner setup |

## What has changed

See the [release notes](./release-notes.md).

## For the people who keep these guides

- Write short sentences. Use numbered steps.
- Use the exact words shown on the screen, in **bold**.
- Only describe screens that exist in the code on `main`.
- For anything not built, put **Planned — not available yet** at the top and do not describe buttons or screens.
- Planning sources: `PROJECTPLAN.md`, `ROLES_AND_PERMISSIONS.md`, `OPEN_QUESTIONS.md`, and `features/*.md` in the repo root.
