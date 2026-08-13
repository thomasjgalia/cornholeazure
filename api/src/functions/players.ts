import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuth, isRejection } from '../lib/auth'
import { PlayerRecord, listPlayers, createPlayer, updatePlayer, deletePlayer } from '../lib/playersTable'
import { listAllTeams } from '../lib/teamsTable'

// Never send profile_secret to the client - only a derived boolean saying
// whether one is set, so the UI can show that without ever seeing the value.
function toPublic(p: PlayerRecord) {
  const { profile_secret, ...rest } = p
  return { ...rest, has_secret: !!profile_secret }
}

// Replaces the delete-protection that used to come from a SQL foreign key -
// now that event_teams has also moved to Table Storage, this is enforced
// entirely in application code with no SQL connection needed anywhere.
async function isPlayerReferenced(id: number): Promise<boolean> {
  const teams = await listAllTeams()
  return teams.some((t) => t.player1_id === id || t.player2_id === id)
}

app.http('players-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'players',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const players = await listPlayers()
      return { jsonBody: players.map(toPublic) }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('players-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'players',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const session = requireAuth(req)
    if (isRejection(session)) return session
    try {
      const body = (await req.json()) as any
      const player = await createPlayer({
        firstname: body.firstname,
        lastname: body.lastname,
        email: body.email || null,
        phone: body.phone || null,
        handicap: body.handicap != null ? Number(body.handicap) : null,
        profile_secret: body.profile_secret || null,
      })
      return { jsonBody: toPublic(player) }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('players-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'players/{id:int}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const session = requireAuth(req)
    if (isRejection(session)) return session
    try {
      const id = Number(req.params.id)
      const body = (await req.json()) as any
      const player = await updatePlayer(id, {
        firstname: body.firstname,
        lastname: body.lastname,
        email: body.email || null,
        phone: body.phone || null,
        handicap: body.handicap != null ? Number(body.handicap) : null,
        profile_secret: body.profile_secret || null,
      })
      if (!player) {
        return { status: 404, jsonBody: { message: 'Player not found' } }
      }
      return { jsonBody: toPublic(player) }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('players-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'players/{id:int}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const session = requireAuth(req)
    if (isRejection(session)) return session
    try {
      const id = Number(req.params.id)
      if (await isPlayerReferenced(id)) {
        return { status: 409, jsonBody: { message: 'Cannot delete: player is referenced by teams' } }
      }
      await deletePlayer(id)
      return { jsonBody: { success: true } }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})
