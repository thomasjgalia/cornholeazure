# Cornhole Tournament Manager — context for Claude

This app is the sibling of a golf tournament app (`golfazure`, repo:
`thomasjgalia/golfazure`) built by the same person, on the identical stack,
with the identical starting problems. That golf app just went through a long
session of security hardening, mobile-layout rework, and UI polish. This
document captures what was learned there so it doesn't have to be
rediscovered the hard way here. It is **not** a task list to blindly execute —
confirm scope and priorities with the user before making large changes,
the same way that session did (it used clarifying questions before any
big feature or architecture change, and got explicit go-ahead before every
push).

## Stack (identical to golfazure)

- Frontend: React 18 + TypeScript + Vite, Tailwind + shadcn/ui components,
  React Router v6.
- Backend: Azure Functions (Node/TypeScript, `@azure/functions` v4
  programming model) + `mssql` talking to Azure SQL. Deployed via Azure
  Static Web Apps as a *managed/linked* API (not a standalone Function App
  resource) — see `.github/workflows/azure-static-web-apps-*.yml`. Pushing
  to `main` triggers a full build + production deploy with no staging gate.
- `players` table is **shared with the golf app** (see the comment in
  `src/types.ts`). This matters: if the golf app already added an
  `is_admin` column to that table (it did, as part of the security work),
  it likely already exists here too — check with a `SELECT` before assuming
  you need a migration. Whoever is admin in one app's data should be
  treated as admin in both, since it's the same row.

## Priority 1 — there is no server-side authorization at all

Verified: all 16 API endpoints across `events.ts`, `matches.ts`,
`players.ts`, `teams.ts` are `authLevel: 'anonymous'` with zero permission
checks in the handler bodies. Anyone with the URL can create/edit/delete any
event, team, match, or player directly via `curl`, with no login required.
`src/lib/auth.tsx`'s "claimed profile" is purely a client-side `localStorage`
convenience with no `isAdmin` concept at all (confirmed — no `is_admin` /
`isAdmin` reference anywhere in the codebase) and nothing stops a request
from bypassing the UI entirely.

Also: `GET /api/players` explicitly selects and returns `profile_secret` in
plaintext for every player (see the `CAST(profile_secret AS NVARCHAR(MAX))`
in `players-list`). That's the exact field meant to authenticate a claim —
it's currently downloadable by anyone before they even try to log in.

### The fix that worked in golfazure (do this, adapted for this app)

1. A `POST /api/auth/claim` endpoint that looks up the player server-side,
   compares `profile_secret` there (never send it to the client), and
   returns a signed session token + the player's public fields (never
   including `profile_secret`).
2. The token is a simple HMAC-signed payload (`{playerid, isAdmin, exp}`,
   base64url body + base64url HMAC-SHA256 signature, no JWT library needed —
   Node's built-in `crypto` is enough). Signing secret comes from an
   `AUTH_SECRET` app setting, generated with:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
3. **Critical, non-obvious gotcha that cost real debugging time in
   golfazure**: do **not** send this token in the standard `Authorization`
   header. Azure Static Web Apps' managed-Functions proxy reserves and
   overwrites that header for its own internal auth before your Function
   code ever sees it — the client's real token gets silently replaced with
   an unrelated platform-internal value, and every request 401s with no
   useful signal. Use a custom header instead (golfazure uses
   `X-Session-Token`) on both the client (`src/lib/api.ts`) and the server
   (reading `req.headers.get('x-session-token')`).
4. A small `requireAuth`/`requireAdmin` helper (reads the header, verifies
   the token, checks `isAdmin`) called at the top of every mutating handler,
   returning 401/403 as appropriate. Read-only endpoints that need to stay
   public (anything a spectator should see without logging in) can stay
   anonymous.
5. Explicit column allowlists on every `UPDATE` — good news here: unlike
   golfazure's original code, this app's `players-update`/`events-update`
   already use fixed, explicit column lists (`firstname = @firstname, ...`)
   rather than looping over arbitrary request-body keys, so it does **not**
   have the SQL-injection-via-dynamic-columns bug golfazero had to fix.
   Still worth double-checking `matches.ts`/`teams.ts` the same way.
6. Frontend: gate admin-only buttons on an `isAdmin` flag from the claimed
   session (same pattern as golf's `useAuth()`), and actually hide them for
   non-admins — golfazure had several places where destructive buttons were
   rendered for everyone with no server backing, which just meant they
   silently 403'd instead of working. Fix the UI to match reality rather
   than just relying on the server check.
7. First admin is bootstrapped via a direct SQL `UPDATE`, not an API —
   deliberately not self-service. Don't build an "grant admin" endpoint.

If you rebuild this, budget time for one likely surprise: a stale/rotated
`AUTH_SECRET` invalidates every existing session token (working as
intended), and the `Authorization`-header gotcha above is the kind of thing
that produces confusing, consistent-looking 401s that don't actually mean
what they appear to mean. If you get inexplicable 401s after wiring this up,
check the header name first before assuming the secret or the token is
wrong.

## Priority 2 — mobile layout: avoid `position: fixed` bottom bars

`src/App.tsx` here is still the original layout (`min-h-screen`, normal
document scroll, no bottom-bar mechanism). If this app grows a bottom action
bar anywhere (golf needed one on its Events, Players, and Scoring-equivalent
pages), don't use `position: fixed` + a manually-guessed `padding-bottom` on
the page above it. That fights with mobile browsers' own collapsing
toolbar and intermittently covers content — this was a real, recurring bug
in golfazure before it was fixed structurally.

The fix: make `App.tsx` a fixed-height flex column
(`h-screen h-dvh flex flex-col`) with the header and an optional bottom bar
as real flex siblings of a `flex-1 overflow-y-auto` scrolling content area,
and have pages publish their bottom-bar content into a shared context slot
(golf's version is `src/lib/bottomBar.tsx`, ~15 lines) instead of each page
rendering its own fixed overlay. The bar becomes a normal layout element
that always reserves its own space — nothing to cover, no padding to guess.
`BracketPage.tsx` in particular is worth checking on a real phone once this
app gets attention — dense bracket UIs are exactly the kind of layout that
tends to fight with viewport chrome.

## Priority 3 — PWA / installability (icon set already prepared)

`C:\Dev\cornhole\icon\` already has a complete, properly-sized icon set and
a `README.md` with the exact `<head>` snippet and a `manifest.json`
template — this is better than what golfazure shipped (which pragmatically
reused a single 1024×1024 favicon at declared-but-inaccurate sizes since no
proper set existed yet). To wire it up:

1. Copy everything from `icon/` into a new `public/` directory at the repo
   root (Vite's `publicDir` — files there are copied byte-for-byte into the
   build output, unhashed, which is required for manifest/icon references
   to have stable URLs).
2. Add the `<head>` tags from `icon/README.md` to `index.html`, plus
   `viewport-fit=cover` on the viewport meta tag if you also add
   safe-area-inset padding to the header/footer (needed for notched-device
   layout once the app-shell change above is in place).
3. Edit `icon/manifest.json`'s `start_url`/colors if needed, then move it
   into `public/`.

## Priority 4 — UI density (apply case-by-case, not wholesale)

Golf ended up compacting several list views: player cards went from a
multi-line block with email shown to a single tight row (name + handicap
only), event cards went from a lopsided button wrap to a clean 2×2 grid of
small buttons, and in both cases the destructive "Delete" action moved off
the list card into the edit dialog / details page rather than sitting next
to "Edit" where a mis-tap is one action away. If the equivalent
players/events/teams list here feels cluttered on a real phone, this is a
reasonable default direction — but check with the user first since it's a
visual/UX call, not a bug fix.

## Stale docs, worth verifying before trusting

`AUTH_SETUP.md`, `supabase-schema.sql`, `add-profile-secret.sql`, and
`azure_migration.md` at the repo root reference Supabase (SQL Editor, RLS
policies) — golfazure had the same category of leftover docs from before
its migration to Azure SQL, and they turned out to describe a database that
was no longer the one actually in use. Verify against the real Azure SQL
schema before following instructions in these files, especially anything
involving RLS or the Supabase dashboard.
