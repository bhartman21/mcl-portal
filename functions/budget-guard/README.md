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
| Roles | **Project Billing Manager** + **Browser** on the **project** only, plus **Cloud Run Invoker** on its own Cloud Run service (see "Roles" below) |
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

| `roles/run.invoker` (Cloud Run Invoker) | the function's own Cloud Run service (`budgetguard`, us-east1) | The Firebase CLI makes the runtime service account the Pub/Sub trigger's identity too (`eventTrigger.serviceAccountEmail`). Google's [Eventarc roles page](https://cloud.google.com/eventarc/docs/roles-permissions) says the trigger service account needs Cloud Run Invoker on the target service; without it, every push gets a 403 and the function never runs. The Firebase CLI grants this automatically only for the default compute service account, not for a custom one. Granted in setup step 5b. |

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
  eventarc.googleapis.com run.googleapis.com storage.googleapis.com \
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
- Do this **first** deploy yourself, as Owner, not from CI. On the first 2nd-gen event function, the Firebase CLI adds some one-time service-agent roles to the project IAM policy (see "One-time service agent roles" below), and the CLI asks for the container-image cleanup policy. A CI deployer can't do either without broad IAM rights.

### 5b. Let the function's identity invoke its own service (once, after the first deploy)

```bash
SERVICE=$(gcloud functions describe budgetGuard --region "$REGION" --project "$PROJECT_ID" \
  --format='value(serviceConfig.service)' | awk -F/ '{print $NF}')   # normally "budgetguard"
gcloud run services add-iam-policy-binding "$SERVICE" --region "$REGION" --project "$PROJECT_ID" \
  --member="serviceAccount:${SA}" --role="roles/run.invoker"
```

Without this, Pub/Sub pushes get a 403 and nothing shows in the function logs. The grant stays when you redeploy. IAM changes can take a few minutes, and Pub/Sub retries in the meantime.

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
- If nothing shows at all, step 5b (Cloud Run Invoker) is probably missing or hasn't taken effect yet.

Billing stays linked: `gcloud billing projects describe "$PROJECT_ID"` still shows `billingEnabled: true`.

### 7. Arm it

```bash
printf 'BUDGET_GUARD_TOPIC=%s\nBUDGET_GUARD_DRY_RUN=false\n' "$TOPIC" > "functions/budget-guard/.env.${PROJECT_ID}"
npm run deploy:functions
```

⚠️ Once it's armed, **don't publish an over-budget test message**: it really detaches billing. To test again, switch back to dry run first.

## CI deployer permissions (deploy-functions.yml)

This section is only needed if you use the optional manual workflow `ci/github-workflows/deploy-functions.yml` instead of deploying from your own machine. That workflow uses the same GitHub secret as the Hosting deploy, `FIREBASE_SERVICE_ACCOUNT`. Call the service account behind that key (or behind Workload Identity Federation, if you switch to it) the **CI deployer**, for example `firebase-deployer@<PROJECT_ID>.iam.gserviceaccount.com`.

It assumes you did the **first** deploy yourself (step 5). After that, CI only updates an existing 2nd-gen function with a Pub/Sub trigger and a custom runtime service account.

| Role | Principal | Resource | Why |
|---|---|---|---|
| `roles/cloudfunctions.developer` (Cloud Functions Developer) | CI deployer | project | Create and update functions through the Cloud Functions API. Google's [Cloud Functions access control](https://cloud.google.com/functions/docs/reference/iam/roles) lists it as the deploy role. It also covers what the CLI reads during deploy: `resourcemanager.projects.get`, `serviceusage.services.get/list`, Artifact Registry repository reads for the cleanup-policy check, and the Cloud Run and Eventarc operations the Functions API runs ([permission list](https://cloud.google.com/iam/docs/roles-permissions/cloudfunctions)). |
| `roles/iam.serviceAccountUser` (Service Account User, i.e. actAs) | CI deployer | **service account** `budget-guard@<PROJECT_ID>.iam.gserviceaccount.com` only | Deploying needs Service Account User on the **runtime service account** ([same page](https://cloud.google.com/functions/docs/reference/iam/roles)). Grant it on that one service account, not the project. A project-wide grant would let CI act as every service account. |
| `roles/iam.serviceAccountUser` | CI deployer | **service account** that Cloud Build uses, by default `<PROJECT_NUMBER>-compute@developer.gserviceaccount.com` | The same page also requires Service Account User on the **Cloud Build service account**. New projects build with the Compute Engine default service account ([Cloud Run functions deploy](https://cloud.google.com/run/docs/deploy-functions)). |
| `roles/serviceusage.serviceUsageConsumer` (Service Usage Consumer) | CI deployer | project | On every deploy the CLI checks each required API with `services.get`, and sends the project as the quota project, so it needs `serviceusage.services.use`. A 403 here stops the deploy. This is the minimum from the firebase-tools maintainers ([firebase-tools #11005](https://github.com/firebase/firebase-tools/issues/11005)). |
| Firebase project read (`firebase.projects.get`) | CI deployer | project | The CLI reads the project's `adminSdkConfig` to set `FIREBASE_CONFIG`. The CI deployer already has this through **Firebase Hosting Admin** for the Hosting deploy (root README, "Deploy (GitHub Actions → Firebase Hosting)"). If you use a separate deployer, add `roles/firebase.viewer`. |

**Not needed**, even though they often appear in checklists:
- `roles/artifactregistry.writer`: Cloud Build pushes the image as the Cloud Build service account, not as the deployer. The deployer only reads the repository's cleanup policy, which Cloud Functions Developer covers. If the cleanup policy is missing, a non-interactive deploy deploys the function and then exits with an error. Set the policy once with `npx firebase functions:artifacts:setpolicy`, or let the step-5 interactive deploy set it.
- `roles/run.admin`: the Firebase CLI sets Cloud Run invoker IAM only for HTTPS, callable and scheduled functions, not for Pub/Sub triggers. The Cloud Functions API manages the Run service itself. budget-guard's own invoker grant is the one-time step 5b.
- `roles/eventarc.admin` and `roles/pubsub.editor`: the Cloud Functions service agent creates the Eventarc trigger and its subscription. The topic already exists (step 2).
- `serviceusage.services.enable` (Service Usage Admin): only needed if an API is still off. Step 1 turns them all on, including `storage.googleapis.com`, which the CLI checks for every 2nd-gen deploy. If CI ever stops with "API not enabled", enable that API as Owner. Don't widen the CI role.
- `serviceusage.services.generateServiceIdentity`: the CLI calls this for Pub/Sub and Eventarc on every 2nd-gen deploy, but it checks no IAM permission ([firebase-tools #11005](https://github.com/firebase/firebase-tools/issues/11005)).
- `resourcemanager.projects.setIamPolicy` (Project IAM Admin): only the first 2nd-gen event deploy edits the project policy (below), and you do that one in step 5.

```bash
DEPLOYER=firebase-deployer@${PROJECT_ID}.iam.gserviceaccount.com   # the account behind FIREBASE_SERVICE_ACCOUNT
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
BUILD_SA=${PROJECT_NUMBER}-compute@developer.gserviceaccount.com

gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${DEPLOYER}" \
  --role="roles/cloudfunctions.developer" --condition=None
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${DEPLOYER}" \
  --role="roles/serviceusage.serviceUsageConsumer" --condition=None
gcloud iam service-accounts add-iam-policy-binding "$SA" --project "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER}" --role="roles/iam.serviceAccountUser"
gcloud iam service-accounts add-iam-policy-binding "$BUILD_SA" --project "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER}" --role="roles/iam.serviceAccountUser"
```

### One-time service agent roles

These belong to Google-managed accounts, not the CI deployer. They're needed once per project, and your step-5 deploy as Owner normally takes care of them:

| Role | Principal | Resource | Source |
|---|---|---|---|
| `roles/iam.serviceAccountTokenCreator` | Pub/Sub service agent `service-<PROJECT_NUMBER>@gcp-sa-pubsub.iam.gserviceaccount.com` | project | Lets Pub/Sub mint the tokens for authenticated pushes. Google requires a manual grant only if the Pub/Sub service agent was enabled **on or before April 8, 2021**; newer projects have it by default ([Eventarc roles](https://cloud.google.com/eventarc/docs/roles-permissions), [Pub/Sub triggers](https://cloud.google.com/functions/docs/calling/pubsub)). The Firebase CLI also adds it on the first 2nd-gen event deploy. |
| `roles/run.invoker` and `roles/eventarc.eventReceiver` | Compute Engine default service account | project | Added by the Firebase CLI on the first 2nd-gen event deploy, for functions that use the default identity. budget-guard doesn't run as that account; its invoker grant is step 5b. |
| Eventarc Service Agent role | `service-<PROJECT_NUMBER>@gcp-sa-eventarc.iam.gserviceaccount.com` | project | Granted automatically when the first Eventarc resource is created; only restore it if someone removes it ([Eventarc roles](https://cloud.google.com/eventarc/docs/roles-permissions)). |

To grant the Pub/Sub one by hand (only for an older project, or if a deploy says it's missing):

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" --condition=None
```

If a deploy fails at the **build** step with a permission error, the Cloud Build service account (`$BUILD_SA`) is missing its build rights. Some projects create the Compute Engine default service account without Editor. Grant it `roles/cloudbuild.builds.builder` on the project ([Cloud Run functions deploy](https://cloud.google.com/run/docs/deploy-functions)).

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
