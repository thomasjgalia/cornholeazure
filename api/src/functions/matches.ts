import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuth, isRejection } from '../lib/auth'
import { listMatchesByEvent, createMatch, deleteMatch } from '../lib/matchesTable'

app.http('matches-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'matches',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const eventId = req.query.get('eventId')
      if (!eventId) {
        return { status: 400, jsonBody: { message: 'eventId query parameter is required' } }
      }
      const matches = await listMatchesByEvent(Number(eventId))
      // Same narrowed shape the old SQL query returned (id/winner/loser/created_at
      // only), and the same winner_id IS NOT NULL filter.
      const result = matches
        .filter((m) => m.winner_id != null)
        .sort((a, b) => a.id - b.id)
        .map((m) => ({ id: m.id, winner_id: m.winner_id, loser_id: m.loser_id, created_at: m.created_at }))
      return { jsonBody: result }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('matches-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'matches',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const session = requireAuth(req)
    if (isRejection(session)) return session
    try {
      const body = (await req.json()) as any
      const match = await createMatch({
        event_id: Number(body.event_id),
        winner_id: Number(body.winner_id),
        loser_id: Number(body.loser_id),
        round: body.round ?? 0,
        match_number: body.match_number ?? 0,
        team1_id: body.team1_id ? Number(body.team1_id) : null,
        team2_id: body.team2_id ? Number(body.team2_id) : null,
        is_bye: !!body.is_bye,
      })
      return { jsonBody: match }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('matches-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'matches/{id:int}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    const session = requireAuth(req)
    if (isRejection(session)) return session
    try {
      const id = Number(req.params.id)
      await deleteMatch(id)
      return { jsonBody: { success: true } }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})
