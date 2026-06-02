# Contributing to Bucket My Money

How we ship changes safely: branches, CI, GitHub, and Vercel.

## Environments (no cross-pollution)

| Environment | Frontend | Database |
| ----------- | -------- | -------- |
| **Production** | [bucketmymoney.com](https://bucketmymoney.com) | Hosted Supabase (dashboard project) |
| **Local dev** | `npm run dev` (:5173) | Docker via `npm run db:start` |
| **CI** | Built in Actions (placeholder or local Supabase env) | Throwaway Supabase in the runner only |

Pushes and CI **do not** reset or seed production. Migrations and Edge Functions
reach production via **[`deploy-supabase.yml`](./.github/workflows/deploy-supabase.yml)**
after green CI on `main` (see [README § Production Supabase deploy](./README.md#production-supabase-deploy-one-time-secrets)).

## Branch workflow

**Do not push directly to `main`.** Use a branch and open a pull request.

```bash
git checkout -b feat/my-change
# … edit, commit …
git push -u origin feat/my-change
gh pr create
```

Merge when all required checks are green.

### One PR at a time — always branch from current `main`

We ship **one open PR at a time**. After a PR merges, reset your local tree
before starting the next change so branches do not diverge and fight over the
same files (e.g. two PRs both editing `App.tsx`).

**After every merge (you or the agent):**

```bash
git checkout main
git pull origin main
# optional: delete the merged branch locally and on GitHub
git branch -d feat/my-change
git push origin --delete feat/my-change   # if still on remote
git checkout -b feat/next-thing           # new branch, never reuse the old one
```

**Do not:**

- Keep committing on a branch after its PR has merged.
- Open PR #2 from a branch that was cut **before** PR #1 merged (rebase onto
  `main` first, or cut a fresh branch from `main` and cherry-pick if needed).

**Agents:** before any new feature/fix, confirm `git branch --show-current` is
a **new** branch based on up-to-date `origin/main`, not a stale or merged branch.

### GitHub branch protection (`main`)

**Configured on this repo** (ruleset + classic protection):

- **Repository ruleset** [`main`](https://github.com/ecuaryan/bucket-my-money/rules/16950243): PR required, three status checks, no force-push, no branch delete.
- **Classic branch protection**: same three checks (strict), PR required (0 approvals), **including administrators**.

Required check names (must match [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) job names exactly):

- `lint, unit test, build`
- `database RLS tests`
- `e2e smoke tests`

**Workflow:** branch → push → open PR → wait for green CI → merge. Do not `git push origin main`.

To change rules: **Settings → Rules → Rulesets** or **Settings → Branches**.

### Vercel (production should wait for CI)

Vercel builds the static app quickly; GitHub Actions (Supabase + tests) takes longer. Without gating, production can update before CI finishes.

**Project → Settings → Git → Deployment Protection** (production):

- Enable **Wait for GitHub checks** (or equivalent).
- Require the same three check names as above.

Result: merge to `main` only after PR CI passes; production promotes only after checks pass on that commit.

Preview deployments for PRs are optional; use separate Supabase env vars for previews if you add real users later (avoid previews hitting production data).

## CI jobs

Every push to `main` and every pull request runs [`.github/workflows/ci.yml`](./.github/workflows/ci.yml):

| Job | What it runs |
| --- | ------------ |
| `lint, unit test, build` | ESLint, Vitest unit tests, production build (always full) |
| `database RLS tests` | Local Supabase + `tests/db/*.test.ts` when the diff can affect Postgres (RLS, RPCs, `src/lib`, migrations, etc.). Pure UI/docs changes skip the heavy steps but the job still reports so required checks pass. |
| `e2e smoke tests` | Local Supabase + Playwright (`tests/e2e/`) when the diff is not docs-only. Docs-only changes skip the heavy steps but the job still reports. |

A lightweight `detect changed scope` job classifies the git diff ([`scripts/ciChangedScope.mjs`](./scripts/ciChangedScope.mjs)); when uncertain, both expensive jobs run (fail-safe). Required check **names** are unchanged.

## Local commands

```bash
npm test              # unit tests (no Docker)
npm run test:db       # database tests (Docker + supabase start)
npm run test:e2e      # Playwright (first time: npx playwright install chromium)
npm run check:full    # lint + unit + db + build (not e2e)
```

Local Supabase env: `source scripts/env-local.sh` (see [README.md](./README.md)).

## When you change…

| Change | Add / run |
| ------ | --------- |
| RLS policies | Cases in `tests/db/rls.test.ts` or new file under `tests/db/` |
| `move_money` or money RPCs | `tests/db/move_money.test.ts` |
| Transaction visibility | `tests/db/transactions.test.ts` |
| Auth helpers | `src/lib/*.test.ts` |
| Login / home smoke | `tests/e2e/smoke.spec.ts` |

## Deploying backend changes

Frontend and hosted Supabase are **separate pipelines**. Vercel finishing does
not mean migrations are live yet.

### Production deploy sequence

```mermaid
sequenceDiagram
  participant Merge as Merge_to_main
  participant CI as CI_workflow
  participant Vercel
  participant Deploy as Deploy_Supabase
  participant Supabase

  Merge->>CI: push triggers CI
  Merge->>Vercel: production build (may wait for CI)
  CI->>CI: lint, unit, build
  CI->>CI: database RLS tests
  CI->>CI: e2e smoke tests
  alt CI success
    CI-->>Deploy: workflow_run completed
    Deploy->>Supabase: supabase db push
    Deploy->>Supabase: supabase functions deploy
  else CI failed
    Note over Deploy: Deploy Supabase skipped
  end
  Vercel-->>Merge: new frontend live
  Deploy-->>Supabase: migrations visible in dashboard
```

| Step | Workflow | What it touches |
| ---- | -------- | --------------- |
| 1 | [**CI**](./.github/workflows/ci.yml) | Lint, tests, build; local throwaway Supabase in the runner only |
| 2 | [**Deploy Supabase**](./.github/workflows/deploy-supabase.yml) | Hosted Postgres migrations + Edge Functions (runs only after green CI on `main`) |
| 3 | **Vercel** | Static frontend at [bucketmymoney.com](https://bucketmymoney.com) |

**Typical timing:** merge → CI runs several minutes → **Deploy Supabase** starts
when CI completes → check **Database → Migrations** in the Supabase dashboard
for the new file. The Vercel deployment can look “done” while CI or Deploy
Supabase is still running.

**PRs never touch production** — only merges to `main` trigger hosted deploys.

### If frontend and backend are out of sync

Symptoms: new UI calls a missing RPC, or Edge Function behavior is stale while
the site already updated.

| Check | Action |
| ----- | ------ |
| CI still running on `main` | Wait — Deploy Supabase has not started |
| CI failed | Fix and merge a follow-up; Deploy Supabase will not run |
| **Deploy Supabase** failed | Open that workflow run on GitHub; fix secrets or `db push` errors |
| Deploy succeeded | Confirm migration in Supabase → **Database → Migrations** |

One-time GitHub **production** environment secrets: [README § Production Supabase deploy](./README.md#production-supabase-deploy-one-time-secrets).

Manual fallback (hosted DB — use with care):

```bash
npx supabase link
npx supabase db push
npx supabase functions deploy
npx supabase unlink
```

Edge Function **secrets** (`TELLER_SIGNING_SECRET`, service role, etc.) stay in the
Supabase dashboard / `supabase secrets set` — deploy only ships function code.

See [README.md § Before connecting real Teller data](./README.md) for security TODOs.
See [README.md § Production database](./README.md#production-database) for hosted DB access.
