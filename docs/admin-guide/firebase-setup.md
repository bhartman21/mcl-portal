# Firebase setup for the MCL Portal (owner checklist)

For: Billy (site owner). One-time setup. No coding needed.

This checklist connects the portal to its own Firebase project, so it can go live at **https://mcl-portal.web.app**. It is based on the repo `README.md` sections "One-time Firebase project setup (owner)", "First admin bootstrap (one time)" and "Deploy", and on `firebase.json`, `.firebaserc`, `storage.rules`, `firestore.rules`, `ci/github-workflows/` and the environment files on `main`.

Each step is marked:

- **Phone OK** — works in your phone's web browser.
- **Easier on a computer** — possible on a phone but fiddly. A phone tip is given where there is one.

> **Phone tip for every step:** Firebase, Google Cloud, and GitHub pages work best in **desktop mode**. In Chrome on Android: menu ⋮ → **Desktop site**. In Safari on iPhone: the **aA** button → **Request Desktop Website**. Turn your phone sideways for wider tables.

> **Keep secrets secret.** The repo is public. Never paste a key, the service account file, or any config value into GitHub issues, pull requests, chat, or email. They only go into **GitHub secrets** (Part 9).

---

## Before you start: cost and the $10 cap

**Decision (Billy, Nov 15, 2026):** use the **Blaze** plan with a **$10/month budget, email alerts, and an automatic billing shutoff**. See `ARCHITECTURE.md`, section "Pricing plan and cost cap".

Why Blaze and not the free Spark plan:

1. **Storage needs Blaze.** "Cloud Storage for Firebase (even default buckets) now requires projects to be on the pay-as-you-go Blaze pricing plan." This has applied since **February 3, 2026**. Ad images are stored in Storage. ([Firebase Storage FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024))
2. **Email-link sign-in on Spark allows only 5 sign-in emails per day** for the whole project. On Blaze the limit is 25,000 a day. ([Firebase Auth limits](https://firebase.google.com/docs/auth/limits))

Blaze needs a credit or debit card. It still includes the free usage amounts. A small DoF portal should cost **$0 a month**, but that is an estimate, not a promise. Your protection (Part 4 and Part 5):

- Email alerts at **$2, $5, $8 and $10** in a month.
- At **$10**, a small helper called **budget-guard** turns billing off for the project. That stops all charges.
- Firestore and Storage go in **`us-east1`** (Part 6). It gets Google Cloud Storage's "Always Free" amount.

> ### ⚠️ Read this: what the $10 shutoff does
>
> **If the shutoff fires at $10, the portal goes offline.** Sign-in, ads, the database and image storage all stop. The site stays down **until you re-link billing** (see "If the shutoff fires" in Part 4).
>
> Google warns that turning billing off can **shut things down roughly**: "Resources might be irretrievably deleted," and there is "no guarantee of service recovery." ([Google Cloud docs](https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications))
>
> **That is why the early alerts matter.** If you get the $2, $5 or $8 email, tell P.A.T. or B.O.B. right away, so the cause can be found and fixed before the shutoff is needed.
>
> Also: Google reports costs with a delay (often hours, sometimes more than a day). The bill can end up a little over $10 before the shutoff happens.

---

## Part 1 — Create the Firebase project

**1. Open the Firebase console.** — Phone OK
Go to https://console.firebase.google.com and sign in with the Google account that will own the portal.

**2. Start a new project.** — Phone OK
Press the button to create a new Firebase project. Firebase's docs call it "the button to create a new Firebase project". The exact label may differ: *Unverified*.

**3. Name it and check the project ID.** — Phone OK
- Type the project name: `mcl-portal`.
- Look just under the name box. Firebase shows the **project ID** it will use. Press the **Edit** (pencil) icon next to it and make sure it says exactly `mcl-portal`.
- **The project ID can never be changed later.** Check it carefully.
- **Do not** pick or reuse the existing `mcl-rack-builder` project. The portal must have its own project.

**4. If `mcl-portal` is taken.** — Phone OK
Firebase will say the ID is not available, or add letters and numbers to it (for example `mcl-portal-1a2b3`). That is fine. Pick the nearest ID you like (for example `mcl-portal-dof`) and **write it down**. Below, "YOUR-PROJECT-ID" means that ID. Then:
- The website address becomes `https://YOUR-PROJECT-ID.web.app` instead of `https://mcl-portal.web.app`.
- In GitHub secrets (Part 9), use your ID for `FIREBASE_PROJECT_ID`, `FIREBASE_AUTH_DOMAIN` and `FIREBASE_STORAGE_BUCKET`.
- Ask B.O.B. to change `.firebaserc` in the repo. Its `"default": "mcl-portal"` line must become your ID. Also ask for the examples in `.env.example` and the "planned project" line in `README.md` to be updated. The deploy itself uses the `FIREBASE_PROJECT_ID` secret, so it will work even before that change, but local tools use `.firebaserc`.
- Tell B.O.B. your ID before he sets up budget-guard (Part 5), so it points at the right project.
- Nothing else in the code needs to change. The committed config in `src/environments/` holds placeholders only.

**5. Accept terms and finish.** — Phone OK
- Accept the Firebase terms if asked and press **Continue**.
- **Gemini in Firebase** (AI help): optional. Off is fine.
- **Google Analytics**: turn it **off**. The portal does not use it.
- Press **Create project**. Wait until you see the project overview page.

New projects start on the free **Spark** plan.

---

## Part 2 — Add the Web app (this gives you the config values)

**6. Register a Web app.** — Phone OK
- On the project overview page, press the **Web** icon (it looks like `</>`). If you don't see it, press **Add app** first, then the Web icon.
- **App nickname:** `MCL Portal Web`. Only you see this name.
- If you see a box for "Also set up Firebase Hosting", you can leave it **unchecked**. The deploy sets up Hosting on its own. *Unverified* that this box still appears.
- Press **Register app**.

**7. Note where the config lives.** — Phone OK
Firebase now shows a block of code with `const firebaseConfig = { ... }`. You do **not** need to copy it now. You can always find it again at:
**gear icon ⚙ (next to Project Overview) → Project settings → General tab → scroll to "Your apps" → MCL Portal Web → "SDK setup and configuration" → Config.**

It contains six values. You will need them in Part 9:

| In the Firebase config | Looks like (placeholder) |
|------------------------|--------------------------|
| `apiKey` | `AIza...` (long text) |
| `authDomain` | `YOUR-PROJECT-ID.firebaseapp.com` |
| `projectId` | `YOUR-PROJECT-ID` |
| `storageBucket` | `YOUR-PROJECT-ID.firebasestorage.app` |
| `messagingSenderId` | a long number |
| `appId` | `1:<number>:web:<letters and numbers>` |

Then press **Continue to console**.

---

## Part 3 — Turn on email-link sign-in

**8. Open Authentication.** — Phone OK
Left menu: **Security → Authentication**. (Older layouts show **Build → Authentication**.) If asked, press **Get started**.

**9. Turn on Email link only.** — Phone OK
- Open the **Sign-in method** tab.
- Press **Email/Password**.
- Turn on **Email/Password**. Firebase requires this switch to be on before email links can work.
- Turn on **Email link (passwordless sign-in)**.
- Press **Save**.
- Do **not** turn on Google or any other provider. The plan says email link only for launch. The app also hides the Google button (`enableGoogleSignIn: false`).

**10. Check authorized domains.** — Phone OK
- Open the **Settings** tab → **Authorized domains**.
- You should already see `YOUR-PROJECT-ID.firebaseapp.com` and `YOUR-PROJECT-ID.web.app` (for example `mcl-portal.web.app`). Leave them.
- Press **Add domain** and type `localhost`, then **Add**. The README asks for this so B.O.B. can test on his own computer against the real project. New projects (created after April 28, 2025) no longer include it by default.
- A custom domain can be added here later.

---

## Part 4 — Upgrade to Blaze and set the $10 budget

Do this **before** creating Firestore and Storage, so the alerts are in place before anything can cost money.

**11. Upgrade to Blaze.** — Phone OK
- In the Firebase console, find the plan name **Spark** (usually at the bottom of the left menu) and press **Upgrade**. *Unverified:* the exact button location.
- Choose **Blaze (pay as you go)**. Link or create a **Cloud Billing account** and enter your card.
- The upgrade screen may offer a budget alert. You can skip it. You will make the real $10 budget in the next steps. (If you already made one, you can edit that one instead of making a second, so you don't get double emails.)
- You must be the project **Owner** to do this. The person who created the project is the Owner.

**12. Open Budgets & alerts.** — Phone OK (desktop mode)
- Go to https://console.cloud.google.com/billing/budgets
- If asked which billing account, pick the one you just linked.
- Or by menu: Google Cloud console menu ☰ → **Billing** → (if asked, **Go to linked billing account**) → under **Cost management**, **Budgets & alerts**.
- Press **Create budget**.

**13. Name the budget.** — Phone OK (desktop mode)
- In the **Define** section, choose **Alerts only**.
- **Name:** `mcl-portal $10 monthly`.
- Press **Next**.
- Why not **Spend cap**? Google's newer spend cap budgets only cover a few services (Gemini, Vertex AI, Cloud Run, Cloud Run functions). They do **not** cover Firestore, Storage or Hosting. So the portal uses budget-guard instead.

**14. Set the scope.** — Phone OK (desktop mode)
- **Time range:** **Monthly** (the default).
- **Projects:** select only **YOUR-PROJECT-ID** (for example `mcl-portal`).
- **Services:** leave all services selected.
- Leave the other settings as they are.
- Press **Next**.

**15. Set the amount.** — Phone OK
- **Budget type:** **Specified amount**.
- **Target amount:** `10`.
- Press **Next**.

**16. Set the four alerts.** — Easier on a computer (Phone OK with care)
Google starts you with three rows: 50%, 90% and 100%. Change them to these four. For each row, type the **Percent of budget**; the amount fills in by itself. Set **Trigger on** to **Actual** for all four.

| Percent of budget | Amount | Trigger on |
|-------------------|--------|------------|
| 20 | $2 | Actual |
| 50 | $5 | Actual |
| 80 | $8 | Actual |
| 100 | $10 | Actual |

Use **Add threshold** to add the fourth row. *Phone tip:* the rows are small. Turn the phone sideways and zoom in.

**17. Choose who gets the emails.** — Phone OK
- Under **Manage notifications**, leave **Email alerts to billing admins and users** ticked. You are the billing admin, so the emails come to you.
- To send them to a second address too (for example P.A.T.'s), Google offers **Link Monitoring email notification channels to this budget**. That is optional and takes extra setup. *Unverified* on a phone.

**18. Connect the Pub/Sub topic.** — Easier on a computer (Phone OK with care)
This is how the budget tells budget-guard about spending.
- Tick **Connect a Pub/Sub topic to this budget**.
- **Project:** press **Select a project** and choose **YOUR-PROJECT-ID**.
- Under **Select a Pub/Sub topic**, press **Create a topic**.
- **Topic ID:** type `BUDGET-TOPIC-NAME`. **This is a placeholder.** `ARCHITECTURE.md` and the README don't name the topic yet. Ask B.O.B. for the exact name **before** this step. It must match the topic budget-guard listens to, letter for letter.
- Press **Create topic**. It is then selected for you.
- If Google asks you to turn on (enable) the Pub/Sub API, say yes. *Unverified* whether that prompt appears.
- *Why it's easier on a computer:* this opens a small pop-up on top of the budget form, which can be hard to use on a phone.
- You can also come back later: open the budget from **Budgets & alerts**, tick the box, and **Save**.

**19. Save and check.** — Phone OK
- Press **Finish**.
- The budget now shows in the **Budgets & alerts** list.
- Google says the first email or Pub/Sub message can take **several hours**. Budgets count in US Pacific time and reset on the 1st of each month.

### If the shutoff fires: re-link billing

When budget-guard turns billing off, the portal is offline. To bring it back, first find out (with P.A.T. or B.O.B.) what caused the spending, then re-link billing:

**R1. Open billing accounts.** — Phone OK (desktop mode)
Go to https://console.cloud.google.com/billing/projects (Google Cloud console → **Billing** → **Manage billing accounts** → **My projects** tab).

**R2. Find the project.** — Phone OK (desktop mode)
Find **YOUR-PROJECT-ID**. Its billing column will say **Billing is disabled**.

**R3. Link billing again.** — Phone OK (desktop mode)
In that row, press the **Actions** menu (⋮) → **Change billing** → choose your billing account → **Set account**.
(Another way: in the Firebase console, upgrade the project to **Blaze** again, as in step 11.)

**R4. Wait and check.** — Phone OK
- Google says it can take **up to 24 hours** for things to start again, and some services may need a manual restart. Ask B.O.B. to check.
- Open https://mcl-portal.web.app and sign in to test.
- Some data might not come back. Google warns resources may be deleted while billing is off.
- *Unverified:* if the month's spending is still over $10, budget-guard might turn billing off again. Ask B.O.B. how budget-guard behaves before re-linking in the same month.

---

## Part 5 — Deploy the budget-guard shutoff (steps coming from B.O.B.)

> **🚧 Placeholder — steps coming from B.O.B.**
>
> budget-guard is the small Cloud Function that turns billing off when the month reaches $10. It is the only Cloud Function in the project (`ARCHITECTURE.md`, "Pricing plan and cost cap").
>
> B.O.B. will supply the steps to deploy it, the permissions it needs, and the exact Pub/Sub topic name for step 18. **Until this is done, the $10 budget only sends emails. It does not stop spending.**
>
> Phone OK or Easier on a computer: to be marked when the steps arrive.

**20. (Placeholder) Deploy budget-guard.** — To be marked
Wait for B.O.B.'s steps. You can carry on with Part 6 meanwhile.

---

## Part 6 — Create Firestore and Storage (both in us-east1)

**21. Create the Firestore database.** — Phone OK
- Left menu: **Databases & Storage → Firestore**. (Older layouts show **Build → Firestore Database**.)
- Press **Create database**.
- If asked for an edition, choose **Standard edition**.
- If asked for a **Database ID**, leave it as **`(default)`**. The security rules look for the database named `(default)`.
- **Location:** choose **`us-east1` (South Carolina)**. This is the decided region (`ARCHITECTURE.md`). It is close to Florida and matches Storage. **The location cannot be changed later.**
- Rules: choose **Start in production mode**. The deploy will replace these with the portal's real rules from `firestore.rules`.
- Press **Create**.

**22. Create Storage.** — Phone OK
- Left menu: **Databases & Storage → Storage**.
- Press **Get started**. If you haven't upgraded yet, Firebase asks you to upgrade first (step 11).
- **Location:** choose **`US-EAST1`**, the same as Firestore. It gets Google Cloud Storage's "Always Free" amount.
- Rules: choose **production mode** (locked) if asked. You will paste the real rules in Part 8.
- Press **Done**.
- On the **Files** tab, check the bucket name. It should be **`YOUR-PROJECT-ID.firebasestorage.app`**. Write it down for the `FIREBASE_STORAGE_BUCKET` secret.

---

## Part 7 — Create the deploy service account and its key

GitHub uses this robot account to publish the site and rules. This is done in the **Google Cloud console**, which uses the same Google account and project.

**23. Open Service Accounts.** — Phone OK
- Go to https://console.cloud.google.com/iam-admin/serviceaccounts
- At the top, make sure the project selector shows **YOUR-PROJECT-ID** (for example `mcl-portal`). If not, tap it and pick the project.

**24. Create the account.** — Phone OK
- Press **+ Create service account**.
- **Service account name:** `github-deploy`. The ID fills in as `github-deploy`.
- **Description:** `Deploys mcl-portal from GitHub Actions`.
- Press **Create and continue**.

**25. Give it roles.** — Phone OK
Under **Grant this service account access to project**, use **Select a role** and **+ Add another role** to add these roles. Type each name into the search box:

- **Firebase Admin**
- **Service Account User**

Then press **Continue**, then **Done**.

*Why these:* the README lists the smaller set **Firebase Hosting Admin**, **Firebase Rules Admin** and **Service Account User**, "or Firebase Admin". The deploy publishes Hosting, Firestore rules **and** Storage rules. I could not confirm that the smaller set is enough for the Storage part, so **Firebase Admin** is the safer choice (*Unverified until the first deploy runs*). If you prefer the smaller set and the deploy later fails with a "permission" error, add **Firebase Admin**.

**26. Make a JSON key.** — Easier on a computer
- In the list, press the **email address** of the new account. It looks like `github-deploy@YOUR-PROJECT-ID.iam.gserviceaccount.com`.
- Open the **Keys** tab.
- Press **Add key → Create new key**.
- Choose **JSON** and press **Create**.
- A file downloads, named something like `YOUR-PROJECT-ID-1a2b3c4d5e6f.json`. **You can only download it once.** If you lose it, delete the key on this page and make a new one.
- If you see "Service account key creation is disabled", your Google account is under an organization policy. Personal Gmail accounts normally don't have this. *Unverified* for your account. Tell P.A.T. if it happens.

**Why it's easier on a computer:** in Part 9 you must paste the **entire** contents of this file into GitHub. On a computer, open it in Notepad (Windows) or TextEdit (Mac), press Ctrl+A / Cmd+A to select all, then copy.

**Phone workaround** (*Unverified*, it depends on your phone):
- **iPhone:** the file goes to the **Files** app → **Downloads**. Tap it to open a preview, then press and hold the text and choose **Select All → Copy**. If the preview won't let you select text, use the computer route.
- **Android:** open **Files** / **Downloads** and open the file with a text editor app (for example Google's **Files** app's text viewer, or any free "text editor" app). Select all and copy.
- Copy the **whole** thing, from the first `{` to the last `}`.

**When you're done with Part 9, delete the downloaded file** from your phone or computer, and empty the trash. The copy in GitHub secrets is all that's needed.

---

## Part 8 — First Storage rules publish (one-time permission grant)

The portal's Storage rules read data from Firestore (`firestore.get(...)` in `storage.rules`). The first time such rules are published, Firebase asks you to **grant a permission**. The GitHub deploy runs unattended and can't press that button. So do the first publish yourself, in the console.

**27. Paste the Storage rules.** — Easier on a computer (Phone OK with care)
- Open the rules file on GitHub: https://github.com/bhartman21/mcl-portal/blob/main/storage.rules
- Press the **Copy raw file** button (two overlapping squares), or press **Raw**, then select all and copy. On a phone, **Raw** plus Select All is the easiest way.
- In the Firebase console: **Databases & Storage → Storage → Rules** tab.
- Select everything in the editor, delete it, and paste the copied rules.
- Press **Publish**.

**28. Accept the permission prompt.** — Phone OK
- After **Publish**, Firebase should show a message about letting Storage rules read Firestore. Press the button to **grant / attach the permission**. *Unverified:* the exact wording.
- If no prompt appears, do it by hand in Google Cloud: https://console.cloud.google.com/iam-admin/iam → tick **Include Google-provided role grants** → find **Cloud Storage for Firebase Service Agent** → pencil (edit) → **+ Add another role** → **Firebase Rules Firestore Service Agent** → **Save**. *Unverified* (from a third-party guide, not Firebase's own page).

You don't need to paste the Firestore rules. The GitHub deploy publishes `firestore.rules` itself, and Firestore rules don't need this grant.

---

## Part 9 — Add the 7 GitHub secrets

**29. Open the secrets page.** — Phone OK (desktop mode)
Go to https://github.com/bhartman21/mcl-portal/settings/secrets/actions
(Or: repo → **Settings** → **Secrets and variables** → **Actions**.) On a phone in normal mobile view, the **Settings** tab may be hidden. Use desktop mode.

**30. Add each secret.** — Phone OK, except the first one (Easier on a computer)
For each row, press **New repository secret**, type the **Name** exactly as shown (all capitals), paste the **Secret** value, and press **Add secret**.

| Name (type exactly) | Where the value comes from |
|---------------------|----------------------------|
| `FIREBASE_SERVICE_ACCOUNT` | The **entire contents** of the JSON key file from step 26, from `{` to `}`. |
| `FIREBASE_PROJECT_ID` | Your project ID, for example `mcl-portal`. Same as `projectId` in the config (step 7). |
| `FIREBASE_API_KEY` | `apiKey` from the config (step 7). |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` from the config, for example `mcl-portal.firebaseapp.com`. |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` from the config, for example `mcl-portal.firebasestorage.app`. It must match the bucket name on the Storage **Files** tab (step 22). |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` from the config. |
| `FIREBASE_APP_ID` | `appId` from the config. |

Tips:
- When copying from the config, copy only what's **inside** the quotes. Don't include the quotes or the comma.
- If the `storageBucket` value is missing or empty in the config, copy the bucket name from the Storage **Files** tab.
- You can't view a secret after saving it, only replace it. That's normal.
- Until **all seven** exist, the deploy skips with a notice ("Deploy skipped … Missing secrets") instead of failing.

---

## Part 10 — Turn on the GitHub workflows

The two automation files, `ci.yml` (checks) and `deploy.yml` (publishes the site), are parked in `ci/github-workflows/`. GitHub only runs them from `.github/workflows/`. They were parked because the command-line login that pushed them lacked GitHub's `workflow` permission. **The GitHub website doesn't have that limit**, so you can move them there.

**31. Move `deploy.yml`.** — Phone OK (desktop mode), easier on a computer
- Open https://github.com/bhartman21/mcl-portal/blob/main/ci/github-workflows/deploy.yml
- Press the **pencil** (Edit this file).
- Click into the **file name box** at the top, before `deploy.yml`. Press **Backspace** until `ci/` and `github-workflows/` are both gone. Each Backspace at the start removes one folder.
- Type `.github/workflows/` in front, so the path reads **`.github/workflows/deploy.yml`**. Don't forget the dot at the start of `.github`.
- Don't change the file's contents.
- Press **Commit changes…** and choose **Commit directly to the `main` branch**. Or choose a new branch and pull request if you'd like B.O.B. to review.

**32. Move `ci.yml` the same way.** — Phone OK (desktop mode)
Same steps for https://github.com/bhartman21/mcl-portal/blob/main/ci/github-workflows/ci.yml → **`.github/workflows/ci.yml`**.

Moving the files removes them from `ci/github-workflows/`. The leftover `ci/github-workflows/README.md` can be deleted later by B.O.B.

**Alternative:** let B.O.B. do it from the command line. It runs `gh auth refresh -h github.com -s workflow`, which shows an 8-character code. You open **https://github.com/login/device** on your phone, type the code, and approve. That approval works fine on a phone.

**Order tip:** do Part 9 (secrets) **before** Part 10. Then the first push to `main` deploys straight away. If you did Part 10 first, that's fine: see step 33.

---

## Part 11 — Run the first deploy

**33. Start the deploy.** — Phone OK
- Moving `deploy.yml` onto `main` starts a deploy by itself.
- To run it again by hand: https://github.com/bhartman21/mcl-portal/actions → **Deploy to Firebase Hosting** (left list) → **Run workflow** → **Run workflow**.
- Wait for a green check (a few minutes). A red X means it failed. Open it and send P.A.T. or B.O.B. a screenshot of the red step. **Don't** copy the whole log into public places, though GitHub hides secret values in logs.

---

## Part 12 — Make yourself the first site admin

There are no built-in admin emails. You promote yourself once, by hand.

**34. Sign in to the live site.** — Phone OK
- Open **https://mcl-portal.web.app** (or `https://YOUR-PROJECT-ID.web.app`).
- Press **Member Sign In**, type your email, press **Send Sign-In Link**.
- Open the email and tap the link **on the same phone and browser**. If you open it somewhere else, the page asks you to type your email again. That's expected.
- You're now signed in as an ordinary member. This creates your record in Firestore.

**35. Give yourself `siteAdmin` in Firestore.** — Phone OK (fiddly; easier on a computer)
- Firebase console → **Databases & Storage → Firestore** → **Data** tab.
- Tap the **`users`** collection. Tap your document. Its ID is a long code (your user ID). Check that its `email` field is yours.
- Find the **`roles`** field. It is an array that currently holds `"member"`.
- Edit it so it holds **two** text (string) items: `member` and `siteAdmin`. In the console, hover or tap the field, press the **pencil** (edit), then add an item. *Unverified:* the exact array-editing buttons. The item type must be **string**, and `siteAdmin` must be spelled exactly, with a capital A.
- Check that **`status`** is `active`. If it says `pending`, edit it to `active`.
- Press **Update** / **Save**.

This is the only time roles are edited outside the app. The console ignores the security rules, so be careful not to change anything else.

**36. Reload the portal.** — Phone OK
- Refresh https://mcl-portal.web.app (sign in again if asked).
- On your first load as an admin, the app writes the registration setting (`settings/registration` with mode `open`) and fills in the Florida detachments.
- If the detachment list is empty, go to **Admin → Detachment Directory** and press **Seed DoF Detachments**.
- From now on, give other people roles in the app: **Admin → Users & Roles**.

---

## Part 13 — Check that it all worked

**37. Quick checks.** — Phone OK

| Check | What you should see |
|-------|---------------------|
| Open https://mcl-portal.web.app | The portal home page, **without** a "Local Demo Mode" badge in the header. |
| Sign in | The sign-in email arrives and the link signs you in. |
| Header after step 35 | An **Admin** menu appears. |
| **Admin → Detachment Directory** | The Florida list, with #54 Morris F. Dixon Jr. and S/Sgt Ted Archambault marked as needing verification. |
| Firestore → Data | `users`, `settings` and `detachments` collections exist. |
| Storage → Rules | The rules you pasted are shown (they mention `ad-images`). |
| GitHub → Actions | Green checks on **Deploy to Firebase Hosting** (and **CI**). |
| Firebase console → Usage and billing | Near $0. |
| Google Cloud → Billing → **Budgets & alerts** | The `mcl-portal $10 monthly` budget, with alerts at $2, $5, $8 and $10 and a Pub/Sub topic connected. |

If you still see the "Local Demo Mode" badge, the site was built without the secrets. Check that all 7 secret names are spelled exactly right, then re-run the deploy (step 33).

---

## Phone summary

| Part | Phone? |
|------|--------|
| 1 Create project | Phone OK |
| 2 Web app | Phone OK |
| 3 Email link + domains | Phone OK |
| 4 Blaze upgrade (step 11) | Phone OK |
| 4 Budget name, scope, amount, emails (steps 12–15, 17, 19) | Phone OK (desktop mode) |
| 4 Four alert rows (step 16) | Easier on a computer, Phone OK with care |
| 4 Pub/Sub topic (step 18) | Easier on a computer, Phone OK with care |
| 4 Re-link billing (R1–R4, only if the shutoff fires) | Phone OK (desktop mode) |
| 5 budget-guard | Placeholder. To be marked when B.O.B.'s steps arrive |
| 6 Firestore, Storage | Phone OK |
| 7 Service account + roles | Phone OK |
| 7 JSON key (step 26) | **Easier on a computer**. Phone workaround above, *Unverified* |
| 8 Storage rules paste + grant | Easier on a computer, Phone OK with care |
| 9 GitHub secrets | Phone OK (desktop mode). The `FIREBASE_SERVICE_ACCOUNT` paste depends on step 26 |
| 10 Move workflows | Phone OK (desktop mode), easier on a computer |
| 11 Deploy | Phone OK |
| 12 First admin | Phone OK, fiddly |
| 13 Checks | Phone OK |

Nothing in this list **requires** a computer (budget-guard is not known yet). The one step most likely to defeat a phone is copying the whole JSON key file (step 26) into the `FIREBASE_SERVICE_ACCOUNT` secret. If your phone won't let you select and copy the file's text, do steps 26 and 30 (that one secret only) on a computer.

## What I could not verify

Marked *Unverified* above:
- The exact label of the "create project" button.
- Whether the "Also set up Firebase Hosting" box still appears.
- Where the **Upgrade** button sits.
- Whether a "turn on the Pub/Sub API" prompt appears when creating the topic (step 18).
- Adding extra email recipients from a phone (step 17).
- Whether budget-guard fires again if billing is re-linked while the month is still over $10.
- The wording of the Storage permission prompt, and the manual IAM role names.
- Whether the smaller README role set is enough.
- Firestore array-editing controls.
- Copying the key file on iPhone and Android.

Not decided yet (placeholders): the Pub/Sub topic name (`BUDGET-TOPIC-NAME`) and all budget-guard steps (Part 5).

Menu paths **Security → Authentication** and **Databases & Storage → Firestore / Storage** come from Firebase's own docs (updated Nov 12, 2026). The service-account key steps, the **Budgets & alerts** screens (Create budget, Alerts only, Scope, Specified amount / Target amount, Percent of budget, Trigger on, Add threshold, Email alerts to billing admins and users, Connect a Pub/Sub topic to this budget, Create a topic, Finish) and the re-link steps (My projects → Change billing → Set account) come from Google Cloud's docs, checked Nov 15, 2026.
