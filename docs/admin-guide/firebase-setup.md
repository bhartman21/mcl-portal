# Firebase setup for the MCL Portal (owner checklist)

For: Billy (site owner). One-time setup. No coding needed.

This checklist connects the portal to its own Firebase project, so it can go live at **https://mcl-portal.web.app**. It is based on the repo `README.md` sections "One-time Firebase project setup (owner)", "First admin bootstrap (one time)" and "Deploy", and on `firebase.json`, `.firebaserc`, `storage.rules`, `firestore.rules`, `ci/github-workflows/` and the environment files on `main`.

Each step is marked:

- **Phone OK** — works in your phone's web browser.
- **Easier on a computer** — possible on a phone but fiddly. A phone tip is given where there is one.

> **Phone tip for every step:** Firebase, Google Cloud, and GitHub pages work best in **desktop mode**. In Chrome on Android: menu ⋮ → **Desktop site**. In Safari on iPhone: the **aA** button → **Request Desktop Website**. Turn your phone sideways for wider tables.

> **Keep secrets secret.** The repo is public. Never paste a key, the service account file, or any config value into GitHub issues, pull requests, chat, or email. They only go into **GitHub secrets** (Part 7).

---

## Before you start: read this about cost (Spark vs Blaze)

The planning docs say the free **Spark** plan is enough. **That is no longer true for this portal.** I checked the current Firebase docs on Nov 15, 2026:

1. **Storage needs Blaze.** "Cloud Storage for Firebase (even default buckets) now requires projects to be on the pay-as-you-go Blaze pricing plan." This has applied since **February 3, 2026**. Ad images are stored in Storage. ([Firebase Storage FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024))
2. **Email-link sign-in on Spark allows only 5 sign-in emails per day** for the whole project. On Blaze the limit is 25,000 a day. Five a day is not enough for members. ([Firebase Auth limits](https://firebase.google.com/docs/auth/limits))

**What this means:** to launch, the project has to be on **Blaze (pay as you go)**. That means adding a credit or debit card. Blaze still includes the same free usage. A small DoF portal will most likely stay inside the free amounts and cost **$0**, but that is not guaranteed. Protect yourself:

- When you upgrade, set a **budget alert** (for example $5 a month). The upgrade screen offers this. A budget alert sends you an email. It does **not** stop spending on its own.
- Put the Storage bucket in **US-EAST1, US-CENTRAL1, or US-WEST1** (Part 4). Only these regions get Google Cloud Storage's "Always Free" amount.

You can do Parts 1–3 on Spark and upgrade at Part 4. If you decide not to use Blaze, stop after Part 3 and tell P.A.T. The plan would need to change (for example, no ad image uploads).

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
- In GitHub secrets (Part 7), use your ID for `FIREBASE_PROJECT_ID`, `FIREBASE_AUTH_DOMAIN` and `FIREBASE_STORAGE_BUCKET`.
- Ask B.O.B. to change `.firebaserc` in the repo. Its `"default": "mcl-portal"` line must become your ID. Also ask for the examples in `.env.example` and the "planned project" line in `README.md` to be updated. The deploy itself uses the `FIREBASE_PROJECT_ID` secret, so it will work even before that change, but local tools use `.firebaserc`.
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

It contains six values. You will need them in Part 7:

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
- `localhost` is **no longer added automatically** for projects created after April 28, 2025. It is only needed if someone tests on their own computer against the real project. If B.O.B. asks for it, press **Add domain** and type `localhost`. You can skip it for launch.
- A custom domain can be added here later.

---

## Part 4 — Upgrade to Blaze, then create Firestore and Storage

**11. Upgrade to Blaze.** — Phone OK
- In the Firebase console, find the plan name **Spark** (usually at the bottom of the left menu) and press **Upgrade**. *Unverified:* the exact button location.
- Choose **Blaze (pay as you go)**. Link or create a **Cloud Billing account** and enter your card.
- When offered, **set a budget alert**, for example $5 per month.
- You must be the project **Owner** to do this. The person who created the project is the Owner.

**12. Create the Firestore database.** — Phone OK
- Left menu: **Databases & Storage → Firestore**. (Older layouts show **Build → Firestore Database**.)
- Press **Create database**.
- If asked for an edition, choose **Standard edition**.
- If asked for a **Database ID**, leave it as **`(default)`**. The security rules look for the database named `(default)`.
- **Location:** choose **`us-east1` (South Carolina)**. It is close to Florida and matches the Storage region below. `nam5 (United States)` also works. **The location cannot be changed later.**
- Rules: choose **Start in production mode**. The deploy will replace these with the portal's real rules from `firestore.rules`.
- Press **Create**.

**13. Create Storage.** — Phone OK
- Left menu: **Databases & Storage → Storage**.
- Press **Get started**. If you haven't upgraded yet, Firebase asks you to upgrade first (step 11).
- **Location:** choose **`US-EAST1`** (or `US-CENTRAL1` / `US-WEST1`). Only these three get the "Always Free" amount.
- Rules: choose **production mode** (locked) if asked. You will paste the real rules in Part 6.
- Press **Done**.
- On the **Files** tab, check the bucket name. It should be **`YOUR-PROJECT-ID.firebasestorage.app`**. Write it down for the `FIREBASE_STORAGE_BUCKET` secret.

---

## Part 5 — Create the deploy service account and its key

GitHub uses this robot account to publish the site and rules. This is done in the **Google Cloud console**, which uses the same Google account and project.

**14. Open Service Accounts.** — Phone OK
- Go to https://console.cloud.google.com/iam-admin/serviceaccounts
- At the top, make sure the project selector shows **YOUR-PROJECT-ID** (for example `mcl-portal`). If not, tap it and pick the project.

**15. Create the account.** — Phone OK
- Press **+ Create service account**.
- **Service account name:** `github-deploy`. The ID fills in as `github-deploy`.
- **Description:** `Deploys mcl-portal from GitHub Actions`.
- Press **Create and continue**.

**16. Give it roles.** — Phone OK
Under **Grant this service account access to project**, use **Select a role** and **+ Add another role** to add these roles. Type each name into the search box:

- **Firebase Admin**
- **Service Account User**

Then press **Continue**, then **Done**.

*Why these:* the README lists the smaller set **Firebase Hosting Admin**, **Firebase Rules Admin** and **Service Account User**, "or Firebase Admin". The deploy publishes Hosting, Firestore rules **and** Storage rules. I could not confirm that the smaller set is enough for the Storage part, so **Firebase Admin** is the safer choice (*Unverified until the first deploy runs*). If you prefer the smaller set and the deploy later fails with a "permission" error, add **Firebase Admin**.

**17. Make a JSON key.** — Easier on a computer
- In the list, press the **email address** of the new account. It looks like `github-deploy@YOUR-PROJECT-ID.iam.gserviceaccount.com`.
- Open the **Keys** tab.
- Press **Add key → Create new key**.
- Choose **JSON** and press **Create**.
- A file downloads, named something like `YOUR-PROJECT-ID-1a2b3c4d5e6f.json`. **You can only download it once.** If you lose it, delete the key on this page and make a new one.
- If you see "Service account key creation is disabled", your Google account is under an organization policy. Personal Gmail accounts normally don't have this. *Unverified* for your account. Tell P.A.T. if it happens.

**Why it's easier on a computer:** in Part 7 you must paste the **entire** contents of this file into GitHub. On a computer, open it in Notepad (Windows) or TextEdit (Mac), press Ctrl+A / Cmd+A to select all, then copy.

**Phone workaround** (*Unverified*, it depends on your phone):
- **iPhone:** the file goes to the **Files** app → **Downloads**. Tap it to open a preview, then press and hold the text and choose **Select All → Copy**. If the preview won't let you select text, use the computer route.
- **Android:** open **Files** / **Downloads** and open the file with a text editor app (for example Google's **Files** app's text viewer, or any free "text editor" app). Select all and copy.
- Copy the **whole** thing, from the first `{` to the last `}`.

**When you're done with Part 7, delete the downloaded file** from your phone or computer, and empty the trash. The copy in GitHub secrets is all that's needed.

---

## Part 6 — First Storage rules publish (one-time permission grant)

The portal's Storage rules read data from Firestore (`firestore.get(...)` in `storage.rules`). The first time such rules are published, Firebase asks you to **grant a permission**. The GitHub deploy runs unattended and can't press that button. So do the first publish yourself, in the console.

**18. Paste the Storage rules.** — Easier on a computer (Phone OK with care)
- Open the rules file on GitHub: https://github.com/bhartman21/mcl-portal/blob/main/storage.rules
- Press the **Copy raw file** button (two overlapping squares), or press **Raw**, then select all and copy. On a phone, **Raw** plus Select All is the easiest way.
- In the Firebase console: **Databases & Storage → Storage → Rules** tab.
- Select everything in the editor, delete it, and paste the copied rules.
- Press **Publish**.

**19. Accept the permission prompt.** — Phone OK
- After **Publish**, Firebase should show a message about letting Storage rules read Firestore. Press the button to **grant / attach the permission**. *Unverified:* the exact wording.
- If no prompt appears, do it by hand in Google Cloud: https://console.cloud.google.com/iam-admin/iam → tick **Include Google-provided role grants** → find **Cloud Storage for Firebase Service Agent** → pencil (edit) → **+ Add another role** → **Firebase Rules Firestore Service Agent** → **Save**. *Unverified* (from a third-party guide, not Firebase's own page).

You don't need to paste the Firestore rules. The GitHub deploy publishes `firestore.rules` itself, and Firestore rules don't need this grant.

---

## Part 7 — Add the 7 GitHub secrets

**20. Open the secrets page.** — Phone OK (desktop mode)
Go to https://github.com/bhartman21/mcl-portal/settings/secrets/actions
(Or: repo → **Settings** → **Secrets and variables** → **Actions**.) On a phone in normal mobile view, the **Settings** tab may be hidden. Use desktop mode.

**21. Add each secret.** — Phone OK, except the first one (Easier on a computer)
For each row, press **New repository secret**, type the **Name** exactly as shown (all capitals), paste the **Secret** value, and press **Add secret**.

| Name (type exactly) | Where the value comes from |
|---------------------|----------------------------|
| `FIREBASE_SERVICE_ACCOUNT` | The **entire contents** of the JSON key file from step 17, from `{` to `}`. |
| `FIREBASE_PROJECT_ID` | Your project ID, for example `mcl-portal`. Same as `projectId` in the config (step 7). |
| `FIREBASE_API_KEY` | `apiKey` from the config (step 7). |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` from the config, for example `mcl-portal.firebaseapp.com`. |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` from the config, for example `mcl-portal.firebasestorage.app`. It must match the bucket name on the Storage **Files** tab (step 13). |
| `FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` from the config. |
| `FIREBASE_APP_ID` | `appId` from the config. |

Tips:
- When copying from the config, copy only what's **inside** the quotes. Don't include the quotes or the comma.
- If the `storageBucket` value is missing or empty in the config, copy the bucket name from the Storage **Files** tab.
- You can't view a secret after saving it, only replace it. That's normal.
- Until **all seven** exist, the deploy skips with a notice ("Deploy skipped … Missing secrets") instead of failing.

---

## Part 8 — Turn on the GitHub workflows

The two automation files, `ci.yml` (checks) and `deploy.yml` (publishes the site), are parked in `ci/github-workflows/`. GitHub only runs them from `.github/workflows/`. They were parked because the command-line login that pushed them lacked GitHub's `workflow` permission. **The GitHub website doesn't have that limit**, so you can move them there.

**22. Move `deploy.yml`.** — Phone OK (desktop mode), easier on a computer
- Open https://github.com/bhartman21/mcl-portal/blob/main/ci/github-workflows/deploy.yml
- Press the **pencil** (Edit this file).
- Click into the **file name box** at the top, before `deploy.yml`. Press **Backspace** until `ci/` and `github-workflows/` are both gone. Each Backspace at the start removes one folder.
- Type `.github/workflows/` in front, so the path reads **`.github/workflows/deploy.yml`**. Don't forget the dot at the start of `.github`.
- Don't change the file's contents.
- Press **Commit changes…** and choose **Commit directly to the `main` branch**. Or choose a new branch and pull request if you'd like B.O.B. to review.

**23. Move `ci.yml` the same way.** — Phone OK (desktop mode)
Same steps for https://github.com/bhartman21/mcl-portal/blob/main/ci/github-workflows/ci.yml → **`.github/workflows/ci.yml`**.

Moving the files removes them from `ci/github-workflows/`. The leftover `ci/github-workflows/README.md` can be deleted later by B.O.B.

**Alternative:** let B.O.B. do it from the command line. It runs `gh auth refresh -h github.com -s workflow`, which shows an 8-character code. You open **https://github.com/login/device** on your phone, type the code, and approve. That approval works fine on a phone.

**Order tip:** do Part 7 (secrets) **before** Part 8. Then the first push to `main` deploys straight away. If you did Part 8 first, that's fine: see step 24.

---

## Part 9 — Run the first deploy

**24. Start the deploy.** — Phone OK
- Moving `deploy.yml` onto `main` starts a deploy by itself.
- To run it again by hand: https://github.com/bhartman21/mcl-portal/actions → **Deploy to Firebase Hosting** (left list) → **Run workflow** → **Run workflow**.
- Wait for a green check (a few minutes). A red X means it failed. Open it and send P.A.T. or B.O.B. a screenshot of the red step. **Don't** copy the whole log into public places, though GitHub hides secret values in logs.

---

## Part 10 — Make yourself the first site admin

There are no built-in admin emails. You promote yourself once, by hand.

**25. Sign in to the live site.** — Phone OK
- Open **https://mcl-portal.web.app** (or `https://YOUR-PROJECT-ID.web.app`).
- Press **Member Sign In**, type your email, press **Send Sign-In Link**.
- Open the email and tap the link **on the same phone and browser**. If you open it somewhere else, the page asks you to type your email again. That's expected.
- You're now signed in as an ordinary member. This creates your record in Firestore.

**26. Give yourself `siteAdmin` in Firestore.** — Phone OK (fiddly; easier on a computer)
- Firebase console → **Databases & Storage → Firestore** → **Data** tab.
- Tap the **`users`** collection. Tap your document. Its ID is a long code (your user ID). Check that its `email` field is yours.
- Find the **`roles`** field. It is an array that currently holds `"member"`.
- Edit it so it holds **two** text (string) items: `member` and `siteAdmin`. In the console, hover or tap the field, press the **pencil** (edit), then add an item. *Unverified:* the exact array-editing buttons. The item type must be **string**, and `siteAdmin` must be spelled exactly, with a capital A.
- Check that **`status`** is `active`. If it says `pending`, edit it to `active`.
- Press **Update** / **Save**.

This is the only time roles are edited outside the app. The console ignores the security rules, so be careful not to change anything else.

**27. Reload the portal.** — Phone OK
- Refresh https://mcl-portal.web.app (sign in again if asked).
- On your first load as an admin, the app writes the registration setting (`settings/registration` with mode `open`) and fills in the Florida detachments.
- If the detachment list is empty, go to **Admin → Detachment Directory** and press **Seed DoF Detachments**.
- From now on, give other people roles in the app: **Admin → Users & Roles**.

---

## Part 11 — Check that it all worked

**28. Quick checks.** — Phone OK

| Check | What you should see |
|-------|---------------------|
| Open https://mcl-portal.web.app | The portal home page, **without** a "Local Demo Mode" badge in the header. |
| Sign in | The sign-in email arrives and the link signs you in. |
| Header after step 26 | An **Admin** menu appears. |
| **Admin → Detachment Directory** | The Florida list, with #54 Morris F. Dixon Jr. and S/Sgt Ted Archambault marked as needing verification. |
| Firestore → Data | `users`, `settings` and `detachments` collections exist. |
| Storage → Rules | The rules you pasted are shown (they mention `ad-images`). |
| GitHub → Actions | Green checks on **Deploy to Firebase Hosting** (and **CI**). |
| Firebase console → Usage and billing | Near $0. Your budget alert is set. |

If you still see the "Local Demo Mode" badge, the site was built without the secrets. Check that all 7 secret names are spelled exactly right, then re-run the deploy (step 24).

---

## Phone summary

| Part | Phone? |
|------|--------|
| 1 Create project | Phone OK |
| 2 Web app | Phone OK |
| 3 Email link + domains | Phone OK |
| 4 Blaze, Firestore, Storage | Phone OK |
| 5 Service account + roles | Phone OK |
| 5 JSON key (step 17) | **Easier on a computer**. Phone workaround above, *Unverified* |
| 6 Storage rules paste + grant | Easier on a computer, Phone OK with care |
| 7 GitHub secrets | Phone OK (desktop mode). The `FIREBASE_SERVICE_ACCOUNT` paste depends on step 17 |
| 8 Move workflows | Phone OK (desktop mode), easier on a computer |
| 9 Deploy | Phone OK |
| 10 First admin | Phone OK, fiddly |
| 11 Checks | Phone OK |

Nothing in this list **requires** a computer. The one step most likely to defeat a phone is copying the whole JSON key file (step 17) into the `FIREBASE_SERVICE_ACCOUNT` secret. If your phone won't let you select and copy the file's text, do steps 17 and 21 (that one secret only) on a computer.

## What I could not verify

Marked *Unverified* above:
- The exact label of the "create project" button.
- Whether the "Also set up Firebase Hosting" box still appears.
- Where the **Upgrade** button sits.
- The wording of the Storage permission prompt, and the manual IAM role names.
- Whether the smaller README role set is enough.
- Firestore array-editing controls.
- Copying the key file on iPhone and Android.

Menu paths **Security → Authentication** and **Databases & Storage → Firestore / Storage** come from Firebase's own docs (updated Nov 12, 2026). The service-account key steps come from Google Cloud's docs.
