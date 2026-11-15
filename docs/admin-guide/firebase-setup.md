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
> **If the shutoff fires at $10, the portal goes offline.** Sign-in, ads, the database and image storage all stop. The site stays down **until you re-link billing** (see "If the shutoff fires: re-link billing" at the end of Part 5).
>
> Google warns that turning billing off can **shut things down roughly**: "Resources might be irretrievably deleted," and there is "no guarantee of service recovery." ([Google Cloud docs](https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications))
>
> **That is why the early alerts matter.** If you get the $2, $5 or $8 email, tell P.A.T. or B.O.B. right away, so the cause can be found and fixed before the shutoff is needed.
>
> Also: if billing is re-linked while the month is still at $10 or more, the shutoff fires again within hours. See the **Pending** note in Part 5.
>
> Google reports costs with a delay (often hours, sometimes more than a day). The bill can end up a little over $10 before the shutoff happens.

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
- **budget-guard (Part 5)** uses the ID in a few places, too. The function's code doesn't change, but:
  - B.O.B.'s setup steps (`functions/budget-guard/README.md`) start with a `PROJECT_ID=mcl-portal` line. Change it to your ID. The budget's project filter and the topic path (`projects/YOUR-PROJECT-ID/topics/budget-guard`) use it.
  - The settings file is named after the ID: `functions/budget-guard/.env.YOUR-PROJECT-ID` instead of `.env.mcl-portal`.
  - The robot account becomes `budget-guard@YOUR-PROJECT-ID.iam.gserviceaccount.com`.
  - The `FIREBASE_PROJECT_ID` GitHub secret (Part 9) is also used by the budget-guard deploy workflow.
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

Do this **before** creating Firestore and Storage, so the alerts are in place before anything can cost money. This Part sets up the budget and its email alerts. Part 5 connects the budget to the automatic shutoff.

**11. Upgrade to Blaze.** — Phone OK
- In the Firebase console, find the plan name **Spark** (usually at the bottom of the left menu) and press **Upgrade**. *Unverified:* the exact button location.
- Choose **Blaze (pay as you go)**. Link or create a **Cloud Billing account** and enter your card.
- The upgrade screen may offer a budget alert. You can skip it. You will make the real $10 budget in the next steps. (If you already made one, edit that one instead of making a second, so you don't get double emails.)
- You must be the project **Owner** to do this. The person who created the project is the Owner. You will also be the billing account's **Billing Account Administrator**, which Part 5 needs.

**12. Open Budgets & alerts.** — Phone OK (desktop mode)
- Go to https://console.cloud.google.com/billing/budgets
- If asked which billing account, pick the one you just linked.
- Or by menu: Google Cloud console menu ☰ → **Billing** → (if asked, **Go to linked billing account**) → under **Cost management**, **Budgets & alerts**.
- Press **Create budget**.

**13. Name the budget.** — Phone OK (desktop mode)
- In the **Define** section, choose **Alerts only**.
- **Name:** `mcl-portal $10/month`.
- Press **Next**.
- Why not **Spend cap**? Google's newer spend cap budgets only cover a few services (Gemini, Vertex AI, Cloud Run, Cloud Run functions). They do **not** cover Firestore, Storage or Hosting. So the portal uses budget-guard instead.

**14. Set the scope.** — Phone OK (desktop mode)
- **Time range:** **Monthly** (the default).
- **Projects:** select **only YOUR-PROJECT-ID** (for example `mcl-portal`). This matters: the shutoff acts on this budget's total, so other projects on your billing account must not count toward it.
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
- Leave **Connect a Pub/Sub topic to this budget** unticked for now. You connect it in step 21, after the topic exists.
- To send the emails to a second address too (for example P.A.T.'s), Google offers **Link Monitoring email notification channels to this budget**. That is optional and takes extra setup. *Unverified* on a phone.

**18. Save and check.** — Phone OK
- Press **Finish**.
- The budget now shows in the **Budgets & alerts** list.
- Google says the first email can take **several hours**. Budgets count in US Pacific time and reset on the 1st of each month.
- **Until Part 5 is finished, this budget only sends emails. It does not stop spending.**

---

## Part 5 — Turn on the budget-guard shutoff

budget-guard is a small robot (a Cloud Function, the project's only one). When the budget reports that this month's cost has **reached $10**, it turns billing off for the project. It can turn billing **off** but can never turn it back **on**, and it has no access to your billing account. It was written by B.O.B. Its full technical steps are in `functions/budget-guard/README.md`.

> **⏳ Depends on PR #34.** budget-guard's code is in pull request #34 (branch `feat/budget-guard`), which **has not merged yet**. Steps 19–23 only use the Google Cloud console and are safe to do any time after Part 4. **Wait for PR #34 to merge before steps 24–27.**

> **Some of this needs a computer.** Deploying budget-guard (steps 24 and 27) needs a terminal with Google's and Firebase's command-line tools. That can't be done from a phone's web browser. Do those steps on a computer, or ask B.O.B. to walk you through them. Everything else in this Part has a console route that works on a phone.

**19. Turn on (enable) 9 Google Cloud APIs.** — Phone OK (desktop mode), a bit slow
- Go to https://console.cloud.google.com/apis/library (Google Cloud console → **APIs & Services** → **Library**). Check that the project selector at the top shows **YOUR-PROJECT-ID**.
- For each API below, type its ID (in brackets) into the search box, open it, and press **Enable**. If it says **Manage** instead, it's already on.

| API | ID to search for |
|-----|------------------|
| Cloud Billing API | `cloudbilling.googleapis.com` |
| Cloud Billing Budget API | `billingbudgets.googleapis.com` |
| Cloud Pub/Sub API | `pubsub.googleapis.com` |
| Cloud Functions API | `cloudfunctions.googleapis.com` |
| Cloud Build API | `cloudbuild.googleapis.com` |
| Artifact Registry API | `artifactregistry.googleapis.com` |
| Eventarc API | `eventarc.googleapis.com` |
| Cloud Run Admin API | `run.googleapis.com` |
| Cloud Storage API | `storage.googleapis.com` (the Firebase tools check it on every budget-guard deploy) |

*Unverified:* the exact API titles shown in the Library. The IDs come from B.O.B.'s README.

**20. Create the topic `budget-guard`.** — Phone OK
A "topic" is the mailbox the budget drops its messages into for budget-guard.
- Go to https://console.cloud.google.com/cloudpubsub/topic/list (Google Cloud console → **Pub/Sub** → **Topics**), in project **YOUR-PROJECT-ID**.
- Press **Create topic**.
- **Topic ID:** `budget-guard` (exactly, all lower case, with the dash). budget-guard listens to this name.
- Leave the other settings as they are, and press **Create**.

**21. Connect the topic to the budget.** — Easier on a computer (Phone OK with care)
- Go back to **Budgets & alerts** (step 12) and open the **`mcl-portal $10/month`** budget.
- In the **Actions** section, under **Manage notifications**, tick **Connect a Pub/Sub topic to this budget**.
- **Project:** press **Select a project** and choose **YOUR-PROJECT-ID**.
- Under **Select a Pub/Sub topic**, choose **`budget-guard`**.
- Press **Save**. Google gives the billing system permission to post to the topic.
- *Why it's easier on a computer:* the topic picker is a small pop-up, which can be hard to use on a phone.

**22. Create budget-guard's robot account.** — Phone OK
This is a separate robot account from the GitHub deploy one in Part 7. It gets **no key**.
- Go to https://console.cloud.google.com/iam-admin/serviceaccounts, in project **YOUR-PROJECT-ID**.
- Press **+ Create service account**.
- **Service account name:** `budget-guard`. The ID fills in as `budget-guard`. Its email becomes `budget-guard@YOUR-PROJECT-ID.iam.gserviceaccount.com`.
- **Description:** `Turns billing off at $10/month`.
- Press **Create and continue**.
- Under **Grant this service account access to project**, add exactly these two roles:
  - **Project Billing Manager**
  - **Browser**
- Press **Continue**, then **Done**.
- **Don't** create a key for this account. **Don't** give it anything on the billing account. Its two roles are on the project only, which is why it can turn billing off but never back on.

**23. Check the two roles.** — Phone OK (desktop mode)
- Go to https://console.cloud.google.com/iam-admin/iam, in project **YOUR-PROJECT-ID**.
- Find `budget-guard@YOUR-PROJECT-ID.iam.gserviceaccount.com`. It should show **Project Billing Manager** and **Browser**.
- If a role is missing, press the **pencil** (edit) on that row → **+ Add another role** → pick it → **Save**. If the account isn't listed, press **Grant access**, paste its email as the principal, add both roles, and **Save**.

**24. Deploy budget-guard in "dry run" (practice) mode — the first deploy, by you.** — **Needs a computer.** Wait for PR #34 to merge.
- **This first deploy must be done by you, signed in as the project Owner, from a terminal on a computer.** It can't be done from a phone, and it can't be done by the GitHub workflow. On this first deploy, the Firebase tools add some one-time permissions to the project for Google's own helper accounts, and they ask you to set a clean-up rule for old container images. The GitHub robot account isn't allowed to do either. Only **later** deploys can use the GitHub workflow (step 33).
- In dry run, budget-guard only **writes down** what it would do. It never turns billing off.
- On a computer with Node.js 22, the Google Cloud CLI (`gcloud`) and a copy of the repo, follow **step 5 ("Deploy the function, first in dry run")** in `functions/budget-guard/README.md`. It signs you in to Firebase once, writes a small settings file `functions/budget-guard/.env.YOUR-PROJECT-ID` with `BUDGET_GUARD_DRY_RUN=true`, and runs `npm run deploy:functions`. That file holds two plain settings, not secrets, and is never uploaded to GitHub.
- When it asks how long to keep container images, any short period is fine (for example 1 day).
- B.O.B. can sit with you on a screen share while you run it, but you must be the one signed in.

**25. Let budget-guard receive its own messages (Cloud Run Invoker).** — Easier on a computer (Phone OK in desktop mode, with care). **Required, once, right after step 24.**
- **Why this matters:** without this permission, the budget's messages are turned away (Google's code for this is a "403" error) before budget-guard ever sees them. **Nothing shows up in budget-guard's logs, and the shutoff silently never runs.** You would only get the emails.
- budget-guard runs as a small Cloud Run service named **`budgetguard`** (no dash) in **`us-east1`**.
- Go to https://console.cloud.google.com/run, in project **YOUR-PROJECT-ID**.
- **Tick the checkbox** next to the service **`budgetguard`** (region `us-east1`). Don't click the service's name itself.
- In the information panel on the right, open the **Permissions** tab. If you don't see the panel, press **Show Info Panel** first.
- Press **Add principal**.
- **New principals:** `budget-guard@YOUR-PROJECT-ID.iam.gserviceaccount.com`
- **Assign roles:** **Cloud Run Invoker**.
- Press **Save**.
- It can take a few minutes to take effect. The permission stays when budget-guard is deployed again, so this is a one-time step.
- *Why it's easier on a computer:* the checkbox and the side panel are small on a phone. Turn it sideways in desktop mode.
- **Confirm the name first:** before granting, look under **Cloud Run → Services** and check that the service is listed as `budgetguard`. B.O.B. confirmed that's its normal name: the function is `budgetGuard`, and 2nd-gen functions run on a Cloud Run service named after the function in lower case. If the list shows a different name, use that service instead.
- These console steps follow Google's Cloud Run docs ("Control access on an individual service"). B.O.B.'s README gives a terminal command instead (step 5b). It looks up the service name automatically (normally `budgetguard`) and grants on whatever name it finds, so it works either way.

**26. Test it safely in dry run.** — Easier on a computer (console route works on a phone with care)
Send budget-guard two fake budget messages, one at $2 and one at $10, and check what it wrote down.
- Go to **Pub/Sub → Topics** (step 20) and open **`budget-guard`**.
- Open **Messages** and press **Publish message**.
- Paste this into **Message body**, exactly, then press **Publish**:

```
{"budgetDisplayName":"mcl-portal $10/month (TEST)","costAmount":2.00,"budgetAmount":10.00,"currencyCode":"USD","alertThresholdExceeded":0.2}
```

- Press **Publish message** again, paste this one, and press **Publish**:

```
{"budgetDisplayName":"mcl-portal $10/month (TEST)","costAmount":10.00,"budgetAmount":10.00,"currencyCode":"USD","alertThresholdExceeded":1.0}
```

- Check the log: **Firebase console → Functions → budgetGuard → Logs** (path from B.O.B.'s README; *Unverified* by me). After a minute or two you should see:
  - `budget-guard: under budget (2 of 10); no action.`
  - `budget-guard: DRY RUN. Budget reached (10 >= 10); would detach billing from projects/YOUR-PROJECT-ID. Nothing changed.`
  - **No** line saying `could not read billing status`. If you see it, the **Browser** role (step 22) or the Cloud Billing API (step 19) is missing. Tell B.O.B.
- **Troubleshooting: if nothing shows up in the logs at all,** the Cloud Run Invoker permission (step 25) is probably missing or hasn't taken effect yet. Check it, wait a few minutes (Pub/Sub keeps retrying), and look again.
- Check billing is still on: **Billing → Manage billing accounts → My projects**. YOUR-PROJECT-ID should still show your billing account, not "Billing is disabled".
- B.O.B.'s README also gives the terminal commands for this step.
- *Why it's easier on a computer:* the message text must be pasted exactly. It is easiest to copy it from this page on the same computer.

**27. Arm it (turn dry run off).** — **Needs a computer** (or B.O.B.'s help)
- Follow **step 7 ("Arm it")** in `functions/budget-guard/README.md`. It changes the settings file to `BUDGET_GUARD_DRY_RUN=false` and runs `npm run deploy:functions` again.
- Later deploys like this one *could* instead use the optional GitHub workflow **Deploy budget-guard (Cloud Function)**, with **Deploy in dry-run mode** unticked. That needs the extra roles in step 33 and has not been tested yet (*Unverified*). The computer route is the safe one.
- Now the shutoff is live.

> **⚠️ Once it's armed, never publish a test message of $10 or more.** budget-guard will really turn billing off and the portal will go offline. To test again, switch back to dry run first (redeploy as in step 24), then test (step 26), then arm it again (step 27). A $2 test message is harmless.

Other notes from B.O.B.:
- The normal GitHub site deploy (Part 11) **never** deploys budget-guard, and budget-guard's deploy never touches the website.
- budget-guard checks the budget's real numbers. If a notification is missing its numbers, it ignores it and writes an error to the log.

### If the shutoff fires: re-link billing

When budget-guard turns billing off, the portal is offline. You will have had the $2, $5 and $8 emails first.

> **⏳ Re-linking billing while still over $10 — Pending Billy's decision.**
>
> Budgets keep sending updates to budget-guard **several times a day** for the rest of the month. If you re-link billing while this month's cost is still $10 or more, the **next update turns billing off again, usually within hours**. budget-guard has no override, on purpose.
>
> B.O.B.'s safe way, within the same month: **change the budget first, then re-link billing.** Either:
> - **Option A:** raise the budget amount above this month's cost so far (for example to $20) and keep the topic connected, so the shutoff still protects you at the new limit; or
> - **Option B:** untick **Connect a Pub/Sub topic to this budget** for the rest of the month (email alerts only, no automatic shutoff).
>
> At the start of next month the cost resets to $0, so re-linking then is safe without changing anything. **Billy hasn't chosen between A and B yet.** Until he does, ask B.O.B. before re-linking within the same month.

**R1. Find out what happened.** — Phone OK
Tell P.A.T. or B.O.B. Find out what caused the spending before turning billing back on.

**R2. If it's still the same month: change the budget first.** — Phone OK (desktop mode). *Pending Billy's decision (A or B above).*
**Billing → Budgets & alerts → `mcl-portal $10/month`**. Either raise the **Target amount** (Option A) or untick **Connect a Pub/Sub topic to this budget** (Option B). Press **Save**. This works even while the project's billing is off, because the budget belongs to your billing account.

**R3. Re-link billing.** — Phone OK (desktop mode)
Go to https://console.cloud.google.com/billing/projects (Google Cloud console → **Billing** → **Manage billing accounts** → **My projects** tab). Find **YOUR-PROJECT-ID**; it will say **Billing is disabled**. In that row, press the **Actions** menu (⋮) → **Change billing** → choose your billing account → **Set account**.
(Another way: in the Firebase console, upgrade the project to **Blaze** again, as in step 11.)

**R4. Wait and check.** — Phone OK
- Google says it can take **up to 24 hours** for things to start again, and some services may need a manual restart. Ask B.O.B. to check.
- Open https://mcl-portal.web.app and sign in to test.
- Some data might not come back. Google warns resources may be deleted while billing is off.

**R5. Next month: put the budget back.** — Phone OK (desktop mode)
On or after the 1st, set the budget back to **$10** and, if you unticked it, tick **Connect a Pub/Sub topic to this budget** again (topic `budget-guard`). Press **Save**.

---

## Part 6 — Create Firestore and Storage (both in us-east1)

**28. Create the Firestore database.** — Phone OK
- Left menu: **Databases & Storage → Firestore**. (Older layouts show **Build → Firestore Database**.)
- Press **Create database**.
- If asked for an edition, choose **Standard edition**.
- If asked for a **Database ID**, leave it as **`(default)`**. The security rules look for the database named `(default)`.
- **Location:** choose **`us-east1` (South Carolina)**. This is the decided region (`ARCHITECTURE.md`). It is close to Florida and matches Storage. **The location cannot be changed later.**
- Rules: choose **Start in production mode**. The deploy will replace these with the portal's real rules from `firestore.rules`.
- Press **Create**.

**29. Create Storage.** — Phone OK
- Left menu: **Databases & Storage → Storage**.
- Press **Get started**. If you haven't upgraded yet, Firebase asks you to upgrade first (step 11).
- **Location:** choose **`US-EAST1`**, the same as Firestore. It gets Google Cloud Storage's "Always Free" amount.
- Rules: choose **production mode** (locked) if asked. You will paste the real rules in Part 8.
- Press **Done**.
- On the **Files** tab, check the bucket name. It should be **`YOUR-PROJECT-ID.firebasestorage.app`**. Write it down for the `FIREBASE_STORAGE_BUCKET` secret.

---

## Part 7 — Create the deploy service account and its key

GitHub uses this robot account to publish the site and rules. This is done in the **Google Cloud console**, which uses the same Google account and project.

**30. Open Service Accounts.** — Phone OK
- Go to https://console.cloud.google.com/iam-admin/serviceaccounts
- At the top, make sure the project selector shows **YOUR-PROJECT-ID** (for example `mcl-portal`). If not, tap it and pick the project.

**31. Create the account.** — Phone OK
- Press **+ Create service account**.
- **Service account name:** `github-deploy`. The ID fills in as `github-deploy`.
- **Description:** `Deploys mcl-portal from GitHub Actions`.
- Press **Create and continue**.

**32. Give it roles.** — Phone OK
Under **Grant this service account access to project**, use **Select a role** and **+ Add another role** to add these roles. Type each name into the search box:

- **Firebase Admin**

Then press **Continue**, then **Done**.

**Don't** add **Service Account User** here. B.O.B. confirmed the website deploy (`deploy.yml`: Hosting plus the Firestore and Storage rules) doesn't need it. `firebase.json` only has the plain `/index.html` rewrite. Giving it on the whole project would let GitHub act as every robot account in the project.
- *Caveat for later:* if a Hosting rewrite to a Cloud Function or Cloud Run service is ever added to `firebase.json`, `github-deploy` will need **Service Account User** on **that service's runtime account only**. Grant it on the single account, as in step 33, not on the project.

*Why Firebase Admin:* the README lists the smaller set **Firebase Hosting Admin**, **Firebase Rules Admin** and **Service Account User**, "or Firebase Admin". (Leave out its Service Account User, as explained above.) The deploy publishes Hosting, Firestore rules **and** Storage rules. I could not confirm that the smaller set is enough for the Storage part, so **Firebase Admin** is the safer choice (*Unverified until the first deploy runs*). If you prefer the smaller set and the deploy later fails with a "permission" error, add **Firebase Admin**.

**33. Optional: extra roles for the GitHub budget-guard workflow.** — Phone OK (desktop mode), easier on a computer
**Only needed if you'll use the optional GitHub workflow `deploy-functions.yml` (Deploy budget-guard) for later deploys.** Skip it if you deploy budget-guard from your computer (steps 24 and 27). That workflow has **not been tested** against a real project yet (*Unverified*). It uses the same `FIREBASE_SERVICE_ACCOUNT` secret, so these roles go to **`github-deploy@YOUR-PROJECT-ID.iam.gserviceaccount.com`**. This list comes from B.O.B.'s README, section "CI deployer permissions (deploy-functions.yml)".

**If you deploy budget-guard only from a terminal (steps 24 and 27), skip this whole step.** `github-deploy` then needs neither Service Account User grant, and none of the other roles below.

| Role (as shown in the console) | Granted on | How |
|--------------------------------|-----------|-----|
| **Cloud Functions Developer** (`roles/cloudfunctions.developer`) | the project | IAM page (below) |
| **Service Usage Consumer** (`roles/serviceusage.serviceUsageConsumer`) | the project | IAM page (below) |
| **Service Account User** (`roles/iam.serviceAccountUser`) | **only** the account `budget-guard@YOUR-PROJECT-ID.iam.gserviceaccount.com` | one service account (below) |
| **Service Account User** (`roles/iam.serviceAccountUser`) | **only** the Cloud Build account, by default `PROJECT-NUMBER-compute@developer.gserviceaccount.com` | one service account (below) |
| Firebase project read (`firebase.projects.get`) | the project | Nothing to do. **Firebase Admin** (step 32) already covers it, as Firebase Hosting Admin would. |

**On the project** (the first two rows):
- Go to https://console.cloud.google.com/iam-admin/iam, in project **YOUR-PROJECT-ID**.
- Find the `github-deploy@…` row and press the **pencil** (edit principal).
- Press **+ Add another role**, pick **Cloud Functions Developer**. Do it again for **Service Usage Consumer**.
- Press **Save**.

**On a single service account** (the two Service Account User rows):
- Go to https://console.cloud.google.com/iam-admin/serviceaccounts, in project **YOUR-PROJECT-ID**.
- Press the **email address** of the account you're granting on. First `budget-guard@…`, then the Cloud Build account `PROJECT-NUMBER-compute@developer.gserviceaccount.com`. Your **project number** is on the Google Cloud console **Dashboard** / Welcome page, and in Firebase **Project settings → General**.
- Open the **Permissions** tab. Under **Principals with access to this service account**, press **Grant access**.
- **New principals:** `github-deploy@YOUR-PROJECT-ID.iam.gserviceaccount.com`
- **Select a role:** **Service Account User**.
- Press **Save**.
- `github-deploy` gets **Service Account User** on these two accounts only: `budget-guard@YOUR-PROJECT-ID.iam.gserviceaccount.com` and `PROJECT-NUMBER-compute@developer.gserviceaccount.com`, and only if you want GitHub to deploy budget-guard. It never gets it on the whole project. This lets GitHub act as those two accounts only.
- Granting on a single service account follows Google's IAM docs ("Manage access to service accounts").

Notes:
- If a workflow run stops with "API not enabled", turn that API on yourself as Owner (step 19). Don't give GitHub more roles.
- If a run fails at the **build** step with a permission error, the Cloud Build account may be missing its build rights. B.O.B.'s README says to give `PROJECT-NUMBER-compute@developer.gserviceaccount.com` the **Cloud Build Service Account** role (`roles/cloudbuild.builds.builder`) on the project. Ask B.O.B. first.
- Also move `deploy-functions.yml` into `.github/workflows/` (Part 10).

**34. Make a JSON key.** — Easier on a computer
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

**35. Paste the Storage rules.** — Easier on a computer (Phone OK with care)
- Open the rules file on GitHub: https://github.com/bhartman21/mcl-portal/blob/main/storage.rules
- Press the **Copy raw file** button (two overlapping squares), or press **Raw**, then select all and copy. On a phone, **Raw** plus Select All is the easiest way.
- In the Firebase console: **Databases & Storage → Storage → Rules** tab.
- Select everything in the editor, delete it, and paste the copied rules.
- Press **Publish**.

**36. Accept the permission prompt.** — Phone OK
- After **Publish**, Firebase should show a message about letting Storage rules read Firestore. Press the button to **grant / attach the permission**. *Unverified:* the exact wording.
- If no prompt appears, do it by hand in Google Cloud: https://console.cloud.google.com/iam-admin/iam → tick **Include Google-provided role grants** → find **Cloud Storage for Firebase Service Agent** → pencil (edit) → **+ Add another role** → **Firebase Rules Firestore Service Agent** → **Save**. *Unverified* (from a third-party guide, not Firebase's own page).

You don't need to paste the Firestore rules. The GitHub deploy publishes `firestore.rules` itself, and Firestore rules don't need this grant.

---

## Part 9 — Add the 7 GitHub secrets

**37. Open the secrets page.** — Phone OK (desktop mode)
Go to https://github.com/bhartman21/mcl-portal/settings/secrets/actions
(Or: repo → **Settings** → **Secrets and variables** → **Actions**.) On a phone in normal mobile view, the **Settings** tab may be hidden. Use desktop mode.

**38. Add each secret.** — Phone OK, except the first one (Easier on a computer)
For each row, press **New repository secret**, type the **Name** exactly as shown (all capitals), paste the **Secret** value, and press **Add secret**.

| Name (type exactly) | Where the value comes from |
|---------------------|----------------------------|
| `FIREBASE_SERVICE_ACCOUNT` | The **entire contents** of the JSON key file from step 34, from `{` to `}`. |
| `FIREBASE_PROJECT_ID` | Your project ID, for example `mcl-portal`. Same as `projectId` in the config (step 7). |
| `FIREBASE_API_KEY` | `apiKey` from the config (step 7). |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` from the config, for example `mcl-portal.firebaseapp.com`. |
| `FIREBASE_STORAGE_BUCKET` | `storageBucket` from the config, for example `mcl-portal.firebasestorage.app`. It must match the bucket name on the Storage **Files** tab (step 29). |
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

**39. Move `deploy.yml`.** — Phone OK (desktop mode), easier on a computer
- Open https://github.com/bhartman21/mcl-portal/blob/main/ci/github-workflows/deploy.yml
- Press the **pencil** (Edit this file).
- Click into the **file name box** at the top, before `deploy.yml`. Press **Backspace** until `ci/` and `github-workflows/` are both gone. Each Backspace at the start removes one folder.
- Type `.github/workflows/` in front, so the path reads **`.github/workflows/deploy.yml`**. Don't forget the dot at the start of `.github`.
- Don't change the file's contents.
- Press **Commit changes…** and choose **Commit directly to the `main` branch**. Or choose a new branch and pull request if you'd like B.O.B. to review.

**40. Move `ci.yml` the same way.** — Phone OK (desktop mode)
Same steps for https://github.com/bhartman21/mcl-portal/blob/main/ci/github-workflows/ci.yml → **`.github/workflows/ci.yml`**.

**After PR #34 merges (optional):** there will be a third file, `ci/github-workflows/deploy-functions.yml` (the optional budget-guard deploy; its extra roles are in step 33). Move it the same way to **`.github/workflows/deploy-functions.yml`** only if B.O.B. says to use it. It only runs when someone presses **Run workflow**.

Moving the files removes them from `ci/github-workflows/`. The leftover `ci/github-workflows/README.md` can be deleted later by B.O.B.

**Alternative:** let B.O.B. do it from the command line. It runs `gh auth refresh -h github.com -s workflow`, which shows an 8-character code. You open **https://github.com/login/device** on your phone, type the code, and approve. That approval works fine on a phone.

**Order tip:** do Part 9 (secrets) **before** Part 10. Then the first push to `main` deploys straight away. If you did Part 10 first, that's fine: see step 41.

---

## Part 11 — Run the first deploy

**41. Start the deploy.** — Phone OK
- Moving `deploy.yml` onto `main` starts a deploy by itself.
- To run it again by hand: https://github.com/bhartman21/mcl-portal/actions → **Deploy to Firebase Hosting** (left list) → **Run workflow** → **Run workflow**.
- Wait for a green check (a few minutes). A red X means it failed. Open it and send P.A.T. or B.O.B. a screenshot of the red step. **Don't** copy the whole log into public places, though GitHub hides secret values in logs.

---

## Part 12 — Make yourself the first site admin

There are no built-in admin emails. You promote yourself once, by hand.

**42. Sign in to the live site.** — Phone OK
- Open **https://mcl-portal.web.app** (or `https://YOUR-PROJECT-ID.web.app`).
- Press **Member Sign In**, type your email, press **Send Sign-In Link**.
- Open the email and tap the link **on the same phone and browser**. If you open it somewhere else, the page asks you to type your email again. That's expected.
- You're now signed in as an ordinary member. This creates your record in Firestore.

**43. Give yourself `siteAdmin` in Firestore.** — Phone OK (fiddly; easier on a computer)
- Firebase console → **Databases & Storage → Firestore** → **Data** tab.
- Tap the **`users`** collection. Tap your document. Its ID is a long code (your user ID). Check that its `email` field is yours.
- Find the **`roles`** field. It is an array that currently holds `"member"`.
- Edit it so it holds **two** text (string) items: `member` and `siteAdmin`. In the console, hover or tap the field, press the **pencil** (edit), then add an item. *Unverified:* the exact array-editing buttons. The item type must be **string**, and `siteAdmin` must be spelled exactly, with a capital A.
- Check that **`status`** is `active`. If it says `pending`, edit it to `active`.
- Press **Update** / **Save**.

This is the only time roles are edited outside the app. The console ignores the security rules, so be careful not to change anything else.

**44. Reload the portal.** — Phone OK
- Refresh https://mcl-portal.web.app (sign in again if asked).
- On your first load as an admin, the app writes the registration setting (`settings/registration` with mode `open`) and fills in the Florida detachments.
- If the detachment list is empty, go to **Admin → Detachment Directory** and press **Seed DoF Detachments**.
- From now on, give other people roles in the app: **Admin → Users & Roles**.

---

## Part 13 — Check that it all worked

**45. Quick checks.** — Phone OK

| Check | What you should see |
|-------|---------------------|
| Open https://mcl-portal.web.app | The portal home page, **without** a "Local Demo Mode" badge in the header. |
| Sign in | The sign-in email arrives and the link signs you in. |
| Header after step 43 | An **Admin** menu appears. |
| **Admin → Detachment Directory** | The Florida detachment list, including #54 Morris F. Dixon Jr. (The plan now lists 51 detachments, with S/Sgt Ted Archambault as #819. Until the app is updated, it may still show Archambault as needing verification, with no number.) |
| Firestore → Data | `users`, `settings` and `detachments` collections exist. |
| Storage → Rules | The rules you pasted are shown (they mention `ad-images`). |
| GitHub → Actions | Green checks on **Deploy to Firebase Hosting** (and **CI**). |
| Firebase console → Usage and billing | Near $0. |
| Google Cloud → Billing → **Budgets & alerts** | The `mcl-portal $10/month` budget, with alerts at $2, $5, $8 and $10 and the `budget-guard` topic connected. |
| Firebase console → Functions | **budgetGuard** is listed (after step 27), and the dry-run test lines from step 26 are in its logs. |

If you still see the "Local Demo Mode" badge, the site was built without the secrets. Check that all 7 secret names are spelled exactly right, then re-run the deploy (step 41).

---

## Phone summary

| Part | Phone? |
|------|--------|
| 1 Create project | Phone OK |
| 2 Web app | Phone OK |
| 3 Email link + domains | Phone OK |
| 4 Blaze upgrade (step 11) | Phone OK |
| 4 Budget name, scope, amount, emails, finish (steps 12–15, 17, 18) | Phone OK (desktop mode) |
| 4 Four alert rows (step 16) | Easier on a computer, Phone OK with care |
| 5 Enable 9 APIs (step 19) | Phone OK (desktop mode) |
| 5 Create topic (step 20) | Phone OK |
| 5 Connect topic to budget (step 21) | Easier on a computer, Phone OK with care |
| 5 budget-guard account + roles, check (steps 22–23) | Phone OK |
| 5 First deploy, dry run (step 24) | **Needs a computer.** You, as Owner, from a terminal. Not the GitHub workflow. Waits for PR #34 |
| 5 Cloud Run Invoker grant (step 25) | Easier on a computer, Phone OK in desktop mode with care (Cloud Run console) |
| 5 Dry-run test (step 26) | Easier on a computer. Console route works on a phone with care |
| 5 Arm it (step 27) | **Needs a computer** (terminal). Later, possibly the GitHub workflow, *Unverified* |
| 5 Re-link billing (R1–R5, only if the shutoff fires) | Phone OK (desktop mode). Same-month choice is *Pending Billy's decision* |
| 6 Firestore, Storage | Phone OK |
| 7 Service account + roles | Phone OK |
| 7 Optional GitHub budget-guard roles (step 33) | Phone OK (desktop mode), easier on a computer. Only if that workflow is used |
| 7 JSON key (step 34) | **Easier on a computer**. Phone workaround above, *Unverified* |
| 8 Storage rules paste + grant | Easier on a computer, Phone OK with care |
| 9 GitHub secrets | Phone OK (desktop mode). The `FIREBASE_SERVICE_ACCOUNT` paste depends on step 34 |
| 10 Move workflows | Phone OK (desktop mode), easier on a computer |
| 11 Deploy | Phone OK |
| 12 First admin | Phone OK, fiddly |
| 13 Checks | Phone OK |

**Two steps truly need a computer:** the first budget-guard deploy (step 24), which you must do yourself as Owner, and arming it (step 27). They need a terminal, which a phone's browser can't run. B.O.B. can help on a screen share. Everything else can be done on a phone. The step most likely to defeat a phone is copying the whole JSON key file (step 34) into the `FIREBASE_SERVICE_ACCOUNT` secret. If your phone won't let you select and copy the file's text, do steps 34 and 38 (that one secret only) on a computer.

## What I could not verify

Marked *Unverified* above:
- The exact label of the "create project" button.
- Whether the "Also set up Firebase Hosting" box still appears.
- Where the **Upgrade** button sits.
- Adding extra email recipients from a phone (step 17).
- The exact API titles in the API Library (step 19). Searching by ID works either way.
- The **Firebase console → Functions → budgetGuard → Logs** path (step 26). It comes from B.O.B.'s README, not from Google's docs.
- The optional GitHub "Deploy budget-guard" workflow and its extra roles (step 33). It's untested.
- The wording of the Storage permission prompt, and the manual IAM role names.
- Whether **Firebase Hosting Admin** plus **Firebase Rules Admin** alone would be enough in place of Firebase Admin.
- Firestore array-editing controls.
- Copying the key file on iPhone and Android.

Not tested by anyone yet: a real budget-guard deploy or a real shutoff. B.O.B. tested on the emulator only, because the Firebase project doesn't exist yet.

**Pending Billy's decision:** how to re-link billing within the same month while still over $10 (Option A: raise the budget, or Option B: disconnect the topic). See Part 5.

Sources:
- Menu paths **Security → Authentication** and **Databases & Storage → Firestore / Storage** come from Firebase's own docs (updated Nov 12, 2026).
- From Google Cloud's docs, checked Nov 15, 2026:
  - the service-account key steps;
  - the **Budgets & alerts** screens (Create budget, Alerts only, Scope, Specified amount / Target amount, Percent of budget, Trigger on, Add threshold, Email alerts to billing admins and users, Connect a Pub/Sub topic to this budget, Finish);
  - the API Library **Enable** button;
  - Pub/Sub **Create topic** and **Messages → Publish message**;
  - IAM **Grant access** / **Add another role**;
  - Cloud Run service **Permissions → Add principal**;
  - service account **Permissions → Principals with access to this service account → Grant access**;
  - the re-link steps (My projects → Change billing → Set account).
- budget-guard's topic name, roles, deploy steps, the Cloud Run Invoker grant, the CI deployer roles, test messages, and re-link behavior come from `functions/budget-guard/README.md` (commit 427034f) and PR #34 (B.O.B.).
