# Release notes

What has changed in the portal, newest first. Dates are Eastern Time.

The portal is not live for members yet. These notes cover work saved to the project so far.

---

## November 16, 2026 — New header, read-only locked ads, full detachment list, cost cap

These changes were merged between 8:05 and 8:07 AM Eastern. The portal is still not live; you can try the app changes in **Local Demo Mode**.

**New header** (fixes #27 and #29)

- The header has three parts. The portal name on the left takes you home. **VAVS**, **Ad Book** and (for admins) **Admin** are in the middle. The bell and your account button are on the right.
- When you're signed in, a round button with your initials opens your account menu. It shows your name, your role, the **Theme** choices (**Light**, **Dark**, **Fun**) and **Sign Out**.
- When you're signed out, the header shows a **Sign In** button and a theme button.
- The Admin menu items are now **Users & Roles**, **Detachments**, **Activity** and **Registration Settings**.
- On a phone, the portal name and the menu button (☰) fit on one row.
- The **Ribbon Rack Builder** link is on the home page and at the bottom of every page, no longer in the header.
- In testing, a strip above the header says **Local Demo Mode: data stays in this browser**.

**Locked ads are read-only** (fixes #32)

- Opening a locked ad with **View** now shows it read-only. **Save Draft** and **Submit for Approval** are hidden. A box says: "**Submission limit reached.** This ad is locked. An administrator must reset it before it can be edited or submitted again."

**Detachment directory**

- The starter list now has the 52 Department of Florida detachments.
- SSgt. Ted Archambault is **#819** (Crystal River), already verified.
- #549, #1055, #1072 and #1476 are marked **Needs Verification**.

**Behind the scenes: cost cap** (for the site owner)

- The portal will use Firebase's pay-as-you-go plan with a $10-a-month budget. Email alerts go out at $2, $5, $8 and $10.
- A small helper called budget-guard turns billing off if the month reaches $10, so the site would go offline. Members won't see anything unless that happens.
- Setup steps are in the owner's Firebase setup checklist.

---

## November 14, 2026 (afternoon) — Ad Book rules, admin roles, and sign-in fixes

These changes were merged between 2:39 and 2:44 PM Eastern. The portal is still not live; you can try them in **Local Demo Mode**.

**Signing in**

- The **Continue with Google** button is gone. Members sign in with the email link only.
- If you open your sign-in link on a different device or browser, the page now asks you to confirm your email in **Confirm Email Address**, then **Finish Sign-In**.
- If the email saved on your device doesn't match the link, the same form appears with the address filled in, so you can fix it.
- The testing badge is now called **Local Demo Mode**.

**Ad Book Studio — for members**

- Each ad can be submitted up to **3 times**. Ads now show **Submission 1 of 3** and so on.
- If an ad is rejected on its 3rd submission, it is locked: "**Submission limit reached.** An administrator must reset this ad before it can be edited or submitted again."
- **Recall to Draft** is now **Withdraw to Draft**. It only works on a **submitted** ad, and it does not give the submission back.
- Approved ads can no longer be taken back by the member. An admin must undo the approval first.
- Only the ad's owner can delete it, and only while it is a draft.
- Members now only see program books that are **Open**.
- Once an ad is submitted, its picture is frozen. This takes effect when the portal is live.

**Ad Book Studio — for approvers and admins**

- Nobody can approve or reject their own ad. Admins may approve their own ad only with a written reason (**Approve My Own Ad**). The other admins get a notification.
- Admins can undo an approval or rejection with a reason (**Undo Review**).
- Admins can reset a locked ad (**Locked Ads** → **Reset Lock**). The ad goes back to draft with 0 of 3 submissions used.
- New **Notifications & Audit Log** page, and a bell icon at the top of the page for admins. Self-approvals, undos, and lock resets are recorded there.
- Approvers and admins can no longer delete members' ads.

**Administration**

- New top role: **Site Administrator**, for the site owner.
- New rules on who can give which roles. Nobody can change their own roles, and nobody can manage someone with a higher admin role.
- Once the portal is live, every role change is recorded.
- Detachments can now be edited (**Edit**). Saving a new number on an unverified detachment marks it verified.
- If the detachment list is empty, admins can press **Seed DoF Detachments**.

**Behind the scenes**

- Security rules in the database now enforce these same limits, ready for when the portal goes live.
- The home page and VAVS page now label Ad Book as Phase 1 and VAVS as Phase 2.
- Setup and deploy steps were written for the owner. The portal goes live once Firebase is set up.

**Still not done:** ads, books, sizes, notifications, and the Ad Book audit log are still saved only in your web browser. Saving them to the shared database, and uploading ad pictures to shared storage, is planned.

## November 14, 2026 (morning) — Decisions on ads and sign-in (planning only)

No change to the portal screens. The Department made these decisions:

- **Sign-in:** members will sign in with a link sent to their email. No password. (Google sign-in may come later.)
- **Ad limit:** each ad may be submitted up to 3 times. After the 3rd rejection, the ad will be locked. (Built that afternoon.)
- **Unlocking an ad:** a Department or National Admin will be able to reset a locked ad. Each reset will be recorded. (Built that afternoon.)
- **Deleting ads:** members may delete an ad only while it is a draft.
- **Ad Book first:** Ad Book Studio will be finished before the VAVS hours tracker (decided November 13).

## November 13, 2026 — First version of the portal screens

The first version of the portal was added. It can be tried in **Local Preview** on a computer. It is not connected to the live sign-in service or shared storage yet.

**For everyone**

- New home page with Marine Corps League colors and crest.
- Three color themes at the top of the page: **Light**, **Dark**, and **Fun**.
- A **Ribbon Rack** link that opens the separate Ribbon Rack Builder site.
- A list of **Active Florida Detachments** on the home page.

**Signing in**

- **Member Sign In** page with **Send Sign-In Link** (email link) and **Continue with Google**. These will work once the portal is connected to its sign-in service.
- **Registration Pending Approval** and **Account Suspended** screens.
- **Local Preview Sign-In** for testing with pretend roles.

**Ad Book Studio** (ads are saved only in your web browser for now)

- Make an ad: title, sponsor name, size, and artwork.
- Upload a picture, PDF, or Word (.docx) file, up to 10 MB.
- Fit, move, and drag your picture in a live preview.
- Save your ad as a PNG or PDF file.
- Save a draft, submit it, recall it, or delete a draft.
- Approvers: **Approval Queue** to approve or reject ads with notes.
- Approvers: program books with **Open**, **Locked**, and **Printed** status, ad placement and order, and Letter-size **Print / Save PDF**.
- Approvers: add and turn off ad sizes.

**Administration**

- **Users & Roles**: approve, suspend, or activate people, and give them roles.
- **Detachment Directory**: add detachments, confirm numbers, and turn detachments off or on.
- **Registration Settings**: switch between **Open (Auto-Approve)** and **Approval Required (Lock-Down)**.

**VAVS Tracker**

- A placeholder page only. Logging hours is **planned — not available yet.**

## November 9, 2026 — Project plan

- Planning documents were written. They describe the portal, its roles, and its features.
- Decided: Florida detachment #54 is the Morris F. Dixon Jr. Detachment.
- Decided: new members are approved automatically, with a switch to require approval.
