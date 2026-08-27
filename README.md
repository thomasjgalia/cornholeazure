# SOL Cornhole

A loss-tracking double-elimination bracket tournament manager for the Sons of
Liberty's Friday cornhole tournament. Hosted at `cornhole.soldelco.com`.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite, Tailwind + shadcn/ui, React Router v6.
- **Backend:** Hono running on the same Cloudflare Worker that serves the built
  frontend as static assets (`worker/index.ts`).
- **Database:** Cloudflare D1 — but not a database of its own. This app binds
  to `soldelco`'s D1 database (see `wrangler.jsonc`) and reads/writes
  `cornhole_events`, `cornhole_teams`, `cornhole_matches`. Player identity is
  **not** stored here at all — it comes straight from SOLDelco's `members`
  table (`GET /api/players` is a read-only view over it).
- **Auth:** No login system of its own. It trusts the same signed
  `sol_identity` cookie SOLDelco issues (shared across `*.soldelco.com` via a
  `Domain=.soldelco.com` cookie attribute set on the SOLDelco side). Anyone
  can view; only a member with `is_admin` set on their `members` row can
  create/edit/delete anything. If you're not signed in as an admin, the header
  links to `soldelco.com/whoami` to pick an identity.

## Local development

```bash
npm install
npm run worker:dev   # builds the frontend, then wrangler dev --remote
```

`--remote` is deliberate — this app's whole point is reading the *real*
shared `members` table, so local dev talks to the real D1 database rather
than an isolated local copy. `.dev.vars` needs `IDENTITY_SECRET` set to the
**same value** as SOLDelco's production secret, or cookie verification will
never match.

```bash
npm run worker:deploy   # builds the frontend, then wrangler deploy
```

## Data model

Schema lives in the SOLDelco repo (`c:\Dev\SOLDelco\migrations\0004_cornhole.sql`)
since it owns the shared database — not duplicated here.

- `cornhole_events(id, name, date, champion_gets_bye, created_at)`
- `cornhole_teams(id, event_id, player1_id, player2_id, is_reigning_champion, created_at)`
  — `player1_id`/`player2_id` reference `members(id)` directly.
- `cornhole_matches(id, event_id, team1_id, team2_id, winner_id, loser_id, created_at)`

## The bracket algorithm

The live, tuned tournament logic lives entirely inside
`src/pages/BracketPage.tsx` (`getSuggestedMatches()` and the surrounding
component state) — it's computed fresh from the flat match list on every
load, not from a persisted bracket tree. Two other files in git history
(`bracketLogic.ts`, `tournamentLogic.ts`) look like bracket logic but are
**dead code** — nothing imports them outside their own test file. Don't
"clean up" `BracketPage.tsx` into one of those without checking with the
group first; a lot of tuning went into its current behavior (loss-tracking
elimination at 2 losses, resting the most recent winner, reigning-champion
bye handling).
