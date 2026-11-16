# GitHub Actions workflows (staged)

`ci.yml`, `deploy.yml` and `deploy-functions.yml` belong in `.github/workflows/`. They are staged here because the
token that pushed this branch lacked GitHub's `workflow` scope, which is required to create
files under `.github/workflows/`.

To activate them (repo owner):

```bash
gh auth refresh -h github.com -s workflow   # once, if pushing from the CLI
git mv ci/github-workflows/ci.yml .github/workflows/ci.yml
git mv ci/github-workflows/deploy.yml .github/workflows/deploy.yml
git mv ci/github-workflows/deploy-functions.yml .github/workflows/deploy-functions.yml
git commit -m "ci: activate CI and deploy workflows" && git push
```

(Or create the files in the GitHub web UI under `.github/workflows/`.)

What each one does:

- `ci.yml` runs on every PR and push to `main`. The app job runs lint, unit tests, rules tests and the production build. The `budget-guard` job runs the type check, tests and build in `functions/budget-guard`.
- `deploy.yml` runs on push to `main` and deploys **Hosting, Firestore rules and Storage rules only** (`--only hosting,firestore:rules,storage`). It never deploys Cloud Functions, so it works whether or not budget-guard is set up.
- `deploy-functions.yml` is manual only (Run workflow). It deploys just `functions:budget-guard`, with dry run on by default. See `functions/budget-guard/README.md`.
