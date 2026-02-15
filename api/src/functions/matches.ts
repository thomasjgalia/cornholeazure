import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getPool } from '../db'

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
      const pool = await getPool()
      const result = await pool.request()
        .input('eventId', Number(eventId))
        .query(
          `SELECT id, winner_id, loser_id, created_at
           FROM cornhole_event_matches
           WHERE event_id = @eventId AND winner_id IS NOT NULL`
        )
      return { jsonBody: result.recordset }
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
    try {
      const body = await req.json() as any
      const pool = await getPool()
      const result = await pool.request()
        .input('event_id', Number(body.event_id))
        .input('winner_id', Number(body.winner_id))
        .input('loser_id', Number(body.loser_id))
        .input('round', body.round ?? 0)
        .input('match_number', body.match_number ?? 0)
        .input('team1_id', body.team1_id ? Number(body.team1_id) : null)
        .input('team2_id', body.team2_id ? Number(body.team2_id) : null)
        .input('is_bye', body.is_bye ? 1 : 0)
        .query(
          `INSERT INTO cornhole_event_matches (event_id, winner_id, loser_id, round, match_number, team1_id, team2_id, is_bye)
           OUTPUT INSERTED.*
           VALUES (@event_id, @winner_id, @loser_id, @round, @match_number, @team1_id, @team2_id, @is_bye)`
        )
      return { jsonBody: result.recordset[0] }
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
    try {
      const id = Number(req.params.id)
      const pool = await getPool()
      await pool.request()
        .input('id', id)
        .query('DELETE FROM cornhole_event_matches WHERE id = @id')
      return { jsonBody: { success: true } }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})
