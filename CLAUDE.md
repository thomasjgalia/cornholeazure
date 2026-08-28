# SOL Cornhole — context for Claude

Migrated from Azure Static Web Apps (React SPA + Azure Functions + Azure
Table Storage) to Cloudflare Workers in August 2026, as the pilot for a
larger plan to move the sibling golf app off Azure too. See
`c:\Dev\SOLDelco`'s plan history for the full roadmap discussion and
rationale — this file just covers what's specific to working in this repo
post-migration.

## Architecture

- One Cloudflare Worker serves both the built Vite frontend (`dist/`, as
  static assets) and the API (`worker/index.ts`, Hono, routed only for
  `/api/*` via `run_worker_first` in `wrangler.jsonc` — everything else is
  asset-served with SPA fallback).
- **Shares its D1 database with `c:\Dev\SOLDelco`** (same `database_id` in
  both repos' `wrangler.jsonc`). This app owns `cornhole_events`,
  `cornhole_teams`, `cornhole_matches`; it reads (never writes) SOLDelco's
  `members` table for player identity. There is no player table here.
- **Auth**: no login of its own. Trusts SOLDelco's `sol_identity` cookie
  (shared via `Domain=.soldelco.com`, set on the SOLDelco side) and checks
  `members.is_admin` per request (`worker/auth.ts`). `worker/session.ts` is a
  byte-for-byte copy of SOLDelco's HMAC signing scheme
  (`src/lib/session.ts`) — if that ever changes, this needs to change with
  it, or cookie verification silently breaks.

## The one thing worth being careful about

`src/pages/BracketPage.tsx` contains the real, tuned tournament algorithm
(loss-tracking double elimination, computed fresh from the match list every
load — see the long comment above `getSuggestedMatches()` explaining the
"rest the most recent winner" logic). Two *other* files,
`src/lib/bracketLogic.ts` and `src/lib/tournamentLogic.ts`, look like they
might be the bracket logic (types match, one even has its own test suite)
but **neither is imported by anything the app actually runs** — confirmed by
grep and a full read of `BracketPage.tsx` during the migration. They're dead
code from an earlier refactor attempt (see the git history around
`TOURNAMENT_REFACTOR.md`, since deleted). Don't "consolidate" onto one of
them without explicit confirmation — a lot of remediation went into the
inline version working correctly.

## Deployment is manual — always do it, don't just commit

There is no CI/CD here (the old Azure Static Web Apps GitHub Actions
workflow was deleted during the migration and nothing replaced it). Pushing
to GitHub does **not** deploy anything. Treat "commit and push" and "ship
this" as the same request: after committing, always also run
`npm run worker:deploy` (build + `wrangler deploy`) so the change is
actually live, rather than leaving deploy as a separate step the user has to
ask for.

## Local dev

`npm run worker:dev` runs `wrangler dev --remote` — deliberately against the
real shared D1, not a local copy, since this app's whole reason for existing
is reading real SOL member data. `.dev.vars` needs `IDENTITY_SECRET` to
exactly match SOLDelco's production secret value.

## Stale docs, already cleaned up

`AUTH_SETUP.md`, `TOURNAMENT_REFACTOR.md`, `IMPLEMENTATION_STATUS.md`,
`requirements.md`, `azure_migration.md`, `supabase-schema.sql`,
`add-profile-secret.sql`, `check-matchup-progression.sql`, and the Azure
Static Web Apps GitHub Actions workflow were all deleted as part of the
Cloudflare migration — they described Supabase/Azure-era architecture that
no longer exists. If something references them, that something is also
stale.
