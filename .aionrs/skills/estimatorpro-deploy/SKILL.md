---
name: estimatorpro-deploy
description: Deploy EstimatorPro changes to GitHub Pages by staging, committing, and pushing to origin/main, then verifying the live site at rizqiyahya.github.io/estimatorpro. Use whenever the user finishes editing EstimatorPro project files, asks to deploy/publish/update/push the live site, or when local changes need to go live. Also use when the user is confused about why the live site hasn't updated or asks whether a problem relates to GitHub vs Supabase.
---

# EstimatorPro Deploy

Deploy the EstimatorPro web app to GitHub Pages safely and verify the live site.

## Critical Context (prevents recurring mistakes)

- **GitHub Pages** = static hosting for `https://rizqiyahya.github.io/estimatorpro`. The live site only reflects code that has been committed AND pushed to `origin/main`.
- **Supabase** = database backend only (requests, tasks, WBS data). It is NOT hosting. Do not confuse the two.
- The #1 recurring mistake: editing files locally but forgetting to `git commit` + `git push`, then wondering why the live site is unchanged.

## Project Facts

- Repo remote: `https://github.com/Rizqiyahya/estimatorpro.git`
- Branch: `main`
- Live URL: `https://rizqiyahya.github.io/estimatorpro`
- Files: static HTML/CSS/JS (no build step). Pushing is the only deploy step.

## Deploy Workflow

1. Locate the EstimatorPro repo (has a `.git` directory). The repo may live under a conversation-scoped temp dir, so search under `%APPDATA%\AionUi\aionui\conversations` for a folder named `estimatorpro` containing `.git`.
2. Run `git status --porcelain` to confirm there are changes.
3. Stage all: `git add -A`
4. Commit with a descriptive message in conventional-commit style (e.g. `feat: perbaiki layout Gantt chart`).
5. Push: `git push origin main`
6. Confirm the push output shows a hash update (e.g. `abc1234..def5678 main -> main`).
7. Remind the user: GitHub Pages rebuilds in 1-2 minutes; hard-refresh with `Ctrl+Shift+R` if the site still looks stale.

## Automation Script

Run `scripts/deploy.ps1` from PowerShell to do the whole workflow in one step:

```powershell
# From the skill's scripts directory (or pass -Path):
.\deploy.ps1 "feat: my change"          # custom commit message
.\deploy.ps1                            # auto-generated message
.\deploy.ps1 -Path "C:\...\estimatorpro" # explicit project path
```

The script auto-locates the repo, shows the diff, commits, pushes, and prints the live URL plus the rebuild reminder.

## Troubleshooting

- **Live site unchanged after push** → wait 1-2 min for Pages rebuild; then `Ctrl+Shift+R`. Not a Supabase issue.
- **"No changes to deploy"** → changes may already be committed/pushed, or the wrong directory was found. Pass `-Path` explicitly.
- **Push rejected (non-fast-forward)** → run `git pull --rebase origin main` first. Never force-push or reset hard.
