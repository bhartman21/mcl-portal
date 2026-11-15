# budget-guard

`budget-guard` is the portal's only Cloud Function. When the project's **$10/month** Cloud Billing budget says actual cost has reached $10, it **detaches billing from the project**. That is Billy's decision of Nov 15, 2026: "Go with Blaze plus a $10 automatic billing shutoff and budget alerts". See ARCHITECTURE.md "Pricing plan and cost cap" and PROJECTPLAN.md Phase 0 "Cost cap".

It follows Google's [Disable billing usage with notifications](https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications) sample, with these changes: TypeScript, a dedicated least-privilege service account, a dry-run switch, and `>=` instead of `>`, so it triggers when cost *reaches* $10.

| | |
|---|---|
| Runtime | Cloud Functions 2nd gen (Cloud Run), Node.js 22, `firebase-functions` v7 |
| Region | `us-east1` |
| Function name | `budgetGuard` (Firebase codebase `budget-guard`, source `functions/budget-guard`) |
| Trigger | Pub/Sub topic **`budget-guard`** in the same project (param `BUDGET_GUARD_TOPIC`) |
| Runs as | `budget-guard@<PROJECT_ID>.iam.gserviceaccount.com` (dedicated service account, no keys) |
| Roles | **Project Billing Manager** + **Browser** on the **project** only (see "Roles" below) |
| Dry run | `BUDGET_GUARD_DRY_RUN` param, default `false`; `true` only logs |
| Secrets | None. It authenticates as its runtime service account through Application Default Credentials. |

## What it does

For each budget notification:

1. It decodes the message. If it isn't a budget notification (no numeric `costAmount` and `budgetAmount`), it logs an error and stops.
2. If `costAmount < budgetAmount`, it logs "under budget" and stops. Notifications at 20/50/80% end here.
3. It reads the project ID from the runtime environment (the project it's deployed to), then checks `projects.getBillingInfo`. If billing is already off, it logs that and stops. If the check fails, it assumes billing is on, as Google's sample does.
4. In dry run, it logs `DRY RUN ... would detach billing from projects/<id>` and stops.
5. Otherwise it calls Cloud Billing API v1 `projects.updateBillingInfo` with `billingAccountName: ""` (detach) and logs `billing DETACHED`. If the call fails, it logs the error and the run fails. Retries are off, and the next budget notification tries again.

Detaching billing stops every billed service in the project, including this function, until the owner re-links billing. Google warns that resources may not shut down cleanly. The $2/$5/$8 email alerts give time to react first.

## Roles (least privilege)

Detaching billing needs the permission to **unlink the project from its billing account**. Google's ["Enable, disable, or change billing for a project", Disable billing → Permissions required](https://cloud.google.com/billing/docs/how-to/modify-project#disable_billing_for_a_project) lists either of these:

- `billing.resourceAssociations.delete` on the **billing account**, via **Billing Account Administrator** (`roles/billing.admin`). This is what Google's sample grants. It controls the whole billing account: every linked project, payment settings and IAM.
- **or** `resourcemanager.projects.deleteBillingAssignment` on the **project**, via **Project Billing Manager** (`roles/billing.projectManager`) or Project Owner.

`budget-guard` uses the second option, granted on the `mcl-portal` project only:

| Role | Resource | Why |
|---|---|---|
| `roles/billing.projectManager` (Project Billing Manager) | project `mcl-portal` | Holds only `resourcemanager.projects.createBillingAssignment` and `deleteBillingAssignment` ([role reference](https://cloud.google.com/billing/docs/how-to/billing-access)). Used for `updateBillingInfo` with an empty account. |
| `roles/browser` (Browser) | project `mcl-portal` | `projects.getBillingInfo` needs `resourcemanager.projects.get` ([API reference](https://cloud.google.com/billing/docs/reference/rest/v1/projects/getBillingInfo)), so it can tell when billing is already off. Read-only project metadata. |

It gets nothing on the billing account. Re-linking billing would also need Billing Account User on the account, so **budget-guard can turn billing off but can never turn it back on or move the project to another account**.

The Disable billing table also lists Billing Account Viewer on the billing account. That's for seeing the project in the console's Billing pages, not for the API call. If a live detach ever logs `PERMISSION_DENIED`, the fallback is to add `roles/billing.viewer` (read-only) on the billing account. Don't use `roles/billing.admin`.

## Owner setup (Billy)

You need: Owner on the `mcl-portal` project, Billing Account Administrator on your Cloud Billing account, the [gcloud CLI](https://cloud.google.com/sdk/docs/install) (or Cloud Shell), Node 22, and this repo checked out. The project must already be on Blaze, linked to your billing account.

Set these once in your terminal. Find the billing account ID under **Billing → Account management**; it looks like `0X0X0X-0X0X0X-0X0X0X`.

```bash
PROJECT_ID=mcl-portal              # change if the project ID is different
REGION=us-east1
TOPIC=budget-guard
BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX
SA=budget-guard@${PROJECT_ID}.iam.gserviceaccount.com
gcloud config set project "$PROJECT_ID"
```

### 1. Enable the APIs

```bash
gcloud services enable \
  cloudbilling.googleapis.com billingbudgets.googleapis.com pubsub.googleapis.com \
  cloudfunctions.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  eventarc.googleapis.com run.googleapis.com \
  --project "$PROJECT_ID"
```

### 2. Create the Pub/Sub topic

```bash
gcloud pubsub topics create "$TOPIC" --project "$PROJECT_ID"
```

### 3. Create the $10/month budget, alerts at 20/50/80/100%, linked to the topic

In the console: go to **Billing → Budgets & alerts → Create budget**.
- **Name:** `mcl-portal $10/month`.
- **Scope:** Projects = **`mcl-portal` only**. This matters: the shutoff uses this budget's cost, so other projects must not count toward it.
- **Amount:** Specified amount, **$10**, monthly.
- **Thresholds:** 20%, 50%, 80%, 100%, all of type **Actual** ($2, $5, $8, $10).
- **Notifications:** keep "Email alerts to billing admins and users". Tick **"Connect a Pub/Sub topic to this budget"** and choose project `mcl-portal`, topic `budget-guard`.
- Click **Finish**. The console gives the billing service permission to publish to the topic.

Or with gcloud (threshold percents are fractions):

```bash
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT_ID" \
  --display-name="mcl-portal \$10/month" \
  --budget-amount=10USD \
  --calendar-period=month \
  --filter-projects="projects/${PROJECT_ID}" \
  --threshold-rule=percent=0.2 --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.8 --threshold-rule=percent=1.0 \
  --notifications-rule-pubsub-topic="projects/${PROJECT_ID}/topics/${TOPIC}"
```

### 4. Create the service account and grant the roles

```bash
gcloud iam service-accounts create budget-guard \
  --display-name="budget-guard (detaches billing at \$10/month)" --project "$PROJECT_ID"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA}" --role="roles/billing.projectManager" --condition=None
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA}" --role="roles/browser" --condition=None
```

So the grant is: **principal** `serviceAccount:budget-guard@mcl-portal.iam.gserviceaccount.com`, **roles** `roles/billing.projectManager` and `roles/browser`, **resource** project `mcl-portal`. Nothing is granted on the billing account.

### 5. Deploy the function (first in dry run)

From the repo root:

```bash
npm ci
npm run functions:install
npx firebase login                 # once
npx firebase use "$PROJECT_ID"
printf 'BUDGET_GUARD_TOPIC=%s\nBUDGET_GUARD_DRY_RUN=true\n' "$TOPIC" > "functions/budget-guard/.env.${PROJECT_ID}"
npm run deploy:functions           # = firebase deploy --only functions:budget-guard
```

- `functions/budget-guard/.env.<projectId>` holds the two non-secret settings and is gitignored. If the file is missing, the CLI asks for both values and offers the defaults (`budget-guard`, `false`).
- If the CLI asks how long to keep container images, any short period is fine (for example 1 day).
- Deploys of Hosting and rules (`npm run deploy:hosting` and the GitHub deploy workflow) never deploy this function. Deploy it only with the command above. Plain `firebase deploy` with no `--only` would deploy everything, including this function.

### 6. Test safely in dry run

With `BUDGET_GUARD_DRY_RUN=true` deployed, publish two fake notifications:

```bash
gcloud pubsub topics publish "$TOPIC" --project "$PROJECT_ID" \
  --message='{"budgetDisplayName":"mcl-portal $10/month (TEST)","costAmount":2.00,"budgetAmount":10.00,"currencyCode":"USD","alertThresholdExceeded":0.2}'
gcloud pubsub topics publish "$TOPIC" --project "$PROJECT_ID" \
  --message='{"budgetDisplayName":"mcl-portal $10/month (TEST)","costAmount":10.00,"budgetAmount":10.00,"currencyCode":"USD","alertThresholdExceeded":1.0}'

gcloud functions logs read budgetGuard --gen2 --region "$REGION" --project "$PROJECT_ID" --limit 20
```

(Or see **Firebase console → Functions → budgetGuard → Logs**.) What you should see:

- `budget-guard: under budget (2 of 10); no action.`
- `budget-guard: DRY RUN. Budget reached (10 >= 10); would detach billing from projects/mcl-portal. Nothing changed.`
- **No** `could not read billing status` warning. That warning would mean the Browser role or the Cloud Billing API is missing.

Billing stays linked: `gcloud billing projects describe "$PROJECT_ID"` still shows `billingEnabled: true`.

### 7. Arm it

```bash
printf 'BUDGET_GUARD_TOPIC=%s\nBUDGET_GUARD_DRY_RUN=false\n' "$TOPIC" > "functions/budget-guard/.env.${PROJECT_ID}"
npm run deploy:functions
```

⚠️ Once it's armed, **don't publish an over-budget test message**: it really detaches billing. To test again, switch back to dry run first.

## If billing gets detached: re-enabling safely

The spec says billed services stop "until Billy re-links billing". It doesn't say what happens if billing is re-linked while the month's cost is still at or over $10. **This is an open question for Billy.** Today's behavior, plainly:

- Budgets send notifications to the topic **several times a day** for the rest of the month, carrying the month-to-date `costAmount`.
- If you re-link billing while `costAmount` is still at or over the budget, the next notification detaches billing **again**, usually within hours. budget-guard has no override, by design.
- At the start of the next month `costAmount` resets, so re-linking then is safe.

To re-enable within the same month, change the budget first (it lives on the billing account, so editing it works even while the project has no billing), then re-link:

1. **Billing → Budgets & alerts → `mcl-portal $10/month`**, then either:
   - **raise the amount** above the current month-to-date cost (for example $20) and keep the topic connected, so the guard still protects the new limit; or
   - **untick "Connect a Pub/Sub topic"** for the rest of the month (no automatic shutoff, email alerts only).
2. **Billing → Account management → My projects**, find `mcl-portal`, then **Change billing** and pick your billing account.
3. At the start of next month, set the budget back to $10 and reconnect the topic if you disconnected it.

Switching to dry run instead also works, but it means a redeploy, which needs billing turned on. That leaves a window where an incoming notification could detach billing again. Prefer changing the budget.

## If the project ID isn't `mcl-portal`

The function doesn't hardcode the project ID. It reads it from the runtime (`projectID` from `firebase-functions/params`, falling back to `GOOGLE_CLOUD_PROJECT`/`GCLOUD_PROJECT`), and the service account `budget-guard@` is expanded by the Firebase CLI to `budget-guard@<projectId>.iam.gserviceaccount.com`. What does mention the ID:

| Where | What to change |
|---|---|
| `.firebaserc` | `"default": "mcl-portal"`. Set it to the real ID, or use `npx firebase use <id>`. |
| These setup steps | `PROJECT_ID=...` at the top. Every command uses the variable, including the budget's project filter and topic path `projects/<id>/topics/budget-guard`. |
| `functions/budget-guard/.env.<projectId>` | The file name includes the ID (for example `.env.my-other-id`). |
| GitHub secret `FIREBASE_PROJECT_ID` | Used by `deploy.yml` and `deploy-functions.yml`. |
| Budget display name | Cosmetic only. |

Nothing else changes. Unit tests use `mcl-portal` only as sample data, and one test checks that another project ID is used as given.

## Developer notes

```bash
npm run functions:install   # npm ci in functions/budget-guard
npm run functions:lint      # tsc type check (src + tests)
npm run functions:test      # vitest: under/at/over budget, already disabled, dry run, malformed, errors
npm run functions:build     # tsc -> functions/budget-guard/lib (gitignored)
```

Local emulator check (no real billing calls succeed without credentials):

```bash
printf 'BUDGET_GUARD_DRY_RUN=true\n' > functions/budget-guard/.env.local   # gitignored
npm run emulators:budget-guard
# in another terminal:
curl -s -X POST -H 'Content-Type: application/json' \
  http://127.0.0.1:8085/v1/projects/demo-mcl-portal/topics/budget-guard:publish \
  -d "{\"messages\":[{\"data\":\"$(printf '%s' '{"costAmount":10,"budgetAmount":10}' | base64 -w0)\"}]}"
```

The Cloud Billing client is `@googleapis/cloudbilling`. It's the stand-alone package for the same `cloudbilling` v1 API that `googleapis` exposes, about 1 MB instead of about 250 MB.
