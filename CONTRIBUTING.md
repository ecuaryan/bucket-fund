# Contributing to BucketFund

How we ship changes safely: branches, CI, GitHub, and Vercel.

## Environments (no cross-pollution)

| Environment | Frontend | Database |
| ----------- | -------- | -------- |
| **Production** | [bucket-fund.vercel.app](https://bucket-fund.vercel.app) | Hosted Supabase (dashboard project) |
| **Local dev** | `npm run dev` (:5173) | Docker via `npm run db:start` |
| **CI** | Built in Actions (placeholder or local Supabase env) | Throwaway Supabase in the runner only |

Pushes and CI **do not** reset or seed production. Migrations reach production only when you run `supabase db push` (or equivalent) against the hosted project.

## Branch workflow

**Do not push directly to `main`.** Use a branch and open a pull request.

```bash
git checkout -b feat/my-change
# … edit, commit …
git push -u origin feat/my-change
gh pr create
```

Merge when all required checks are green.

### GitHub branch protection (`main`)

**Configured on this repo** (ruleset + classic protection):

- **Repository ruleset** [`main`](https://github.com/ecuaryan/bucket-fund/rules/16950243): PR required, three status checks, no force-push, no branch delete.
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
| `lint, unit test, build` | ESLint, Vitest unit tests, production build |
| `database RLS tests` | Local Supabase + `tests/db/*.test.ts` |
| `e2e smoke tests` | Local Supabase + Playwright (`tests/e2e/`) |

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

- **Frontend:** merges to `main` → Vercel (after checks, if configured).
- **SQL migrations:** `supabase db push` against the **hosted** project (manual, not automatic from CI today).
- **Edge Functions:** `supabase functions deploy` + secrets via dashboard or `supabase secrets set`.

See [README.md § Before connecting real Teller data](./README.md) for security TODOs.
