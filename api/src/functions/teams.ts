import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuth, isRejection } from '../lib/auth'
import { listTeamsByEvent, createTeam, updateTeam, deleteTeam, teamPairExists } from '../lib/teamsTable'
import { getPlayer } from '../lib/playersTable'

// GET /api/teams?eventId=N
app.http('teams-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'teams',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const eventId = req.query.get('eventId')
      if (!eventId) {
        return { status: 400, jsonBody: { message: 'eventId query parameter is required' } }
      }
      const teams = await listTeamsByEvent(Number(eventId))

      // Embed player details, same shape the old SQL JOIN produced.
      const withPlayers = await Promise.all(
        teams.map(async (t) => {
          const [player1, player2] = await Promise.all([getPlayer(t.player1_id), getPlayer(t.player2_id)])
          return {
            id: t.id,
            event_id: t.event_id,
            player1_id: t.player1_id,
            player2_id: t.player2_id,
            is_reigning_champion: t.is_reigning_champion,
            created_at: t.created_at,
            player1: player1
              ? { playerid: player1.playerid, firstname: player1.firstname, lastname: player1.lastname, email: player1.email, phone: player1.phone, handicap: player1.handicap }
              : undefined,
            player2: player2
              ? { playerid: player2.playerid, firstname: player2.firstname, lastname: player2.lastname, email: player2.email, phone: player2.phone, handicap: player2.handicap }
              : undefined,
          }
        })
      )

      return { jsonBody: withPlayers }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

// POST /api/teams
app.http('teams-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'teams',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const session = requireAuth(req)
    if (isRejection(session)) return session
    try {
      const body = (await req.json()) as any
      const eventId = Number(body.event_id)
      const player1Id = Number(body.player1_id)
      const player2Id = Number(body.player2_id)

      if (await teamPairExists(eventId, player1Id, player2Id)) {
        return { status: 409, jsonBody: { message: 'This team already exists in this event' } }
      }

      const team = await createTeam({
        event_id: eventId,
        player1_id: player1Id,
        player2_id: player2Id,
        is_reigning_champion: !!body.is_reigning_champion,
      })
      return { jsonBody: team }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

// PUT /api/teams/{id}
app.http('teams-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'teams/{id:int}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const session = requireAuth(req)
    if (isRejection(session)) return session
    try {
      const id = Number(req.params.id)
      const body = (await req.json()) as any
      const team = await updateTeam(id, { is_reigning_champion: !!body.is_reigning_champion })
      if (!team) {
        return { status: 404, jsonBody: { message: 'Team not found' } }
      }
      return { jsonBody: team }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

// DELETE /api/teams/{id}
app.http('teams-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'teams/{id:int}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const session = requireAuth(req)
    if (isRejection(session)) return session
    try {
      const id = Number(req.params.id)
      await deleteTeam(id)
      return { jsonBody: { success: true } }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})
