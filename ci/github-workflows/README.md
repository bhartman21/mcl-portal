# GitHub Actions workflows (staged)

`ci.yml` and `deploy.yml` belong in `.github/workflows/`. They are staged here because the
token that pushed this branch lacked GitHub's `workflow` scope, which is required to create
files under `.github/workflows/`.

To activate them (repo owner):

```bash
gh auth refresh -h github.com -s workflow   # once, if pushing from the CLI
git mv ci/github-workflows/ci.yml .github/workflows/ci.yml
git mv ci/github-workflows/deploy.yml .github/workflows/deploy.yml
git commit -m "ci: activate CI and deploy workflows" && git push
```

(Or create the two files in the GitHub web UI under `.github/workflows/`.)
