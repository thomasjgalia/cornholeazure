import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getPool } from '../db'

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
      const pool = await getPool()
      const result = await pool.request()
        .input('eventId', Number(eventId))
        .query(
          `SELECT t.*,
            p1.playerid AS player1_playerid, p1.firstname AS player1_firstname, p1.lastname AS player1_lastname,
            p1.email AS player1_email, p1.phone AS player1_phone, p1.handicap AS player1_handicap,
            p1.profile_secret AS player1_profile_secret,
            p2.playerid AS player2_playerid, p2.firstname AS player2_firstname, p2.lastname AS player2_lastname,
            p2.email AS player2_email, p2.phone AS player2_phone, p2.handicap AS player2_handicap,
            p2.profile_secret AS player2_profile_secret
           FROM cornhole_event_teams t
           LEFT JOIN players p1 ON t.player1_id = p1.playerid
           LEFT JOIN players p2 ON t.player2_id = p2.playerid
           WHERE t.event_id = @eventId`
        )

      const teams = result.recordset.map((row: any) => ({
        id: row.id,
        event_id: row.event_id,
        player1_id: row.player1_id,
        player2_id: row.player2_id,
        is_reigning_champion: row.is_reigning_champion,
        created_at: row.created_at,
        player1: row.player1_playerid ? {
          playerid: row.player1_playerid,
          firstname: row.player1_firstname,
          lastname: row.player1_lastname,
          email: row.player1_email,
          phone: row.player1_phone,
          handicap: row.player1_handicap,
          profile_secret: row.player1_profile_secret,
        } : undefined,
        player2: row.player2_playerid ? {
          playerid: row.player2_playerid,
          firstname: row.player2_firstname,
          lastname: row.player2_lastname,
          email: row.player2_email,
          phone: row.player2_phone,
          handicap: row.player2_handicap,
          profile_secret: row.player2_profile_secret,
        } : undefined,
      }))

      return { jsonBody: teams }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('teams-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'teams',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = await req.json() as any
      const pool = await getPool()
      const result = await pool.request()
        .input('event_id', Number(body.event_id))
        .input('player1_id', Number(body.player1_id))
        .input('player2_id', Number(body.player2_id))
        .input('is_reigning_champion', body.is_reigning_champion ? 1 : 0)
        .query(
          `INSERT INTO cornhole_event_teams (event_id, player1_id, player2_id, is_reigning_champion)
           OUTPUT INSERTED.*
           VALUES (@event_id, @player1_id, @player2_id, @is_reigning_champion)`
        )
      return { jsonBody: result.recordset[0] }
    } catch (err: any) {
      if (err.number === 2627 || err.number === 2601) {
        return { status: 409, jsonBody: { message: 'This team already exists in this event' } }
      }
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('teams-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'teams/{id:int}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const id = Number(req.params.id)
      const body = await req.json() as any
      const pool = await getPool()
      const result = await pool.request()
        .input('id', id)
        .input('is_reigning_champion', body.is_reigning_champion ? 1 : 0)
        .query(
          `UPDATE cornhole_event_teams SET is_reigning_champion = @is_reigning_champion
           OUTPUT INSERTED.*
           WHERE id = @id`
        )
      if (result.recordset.length === 0) {
        return { status: 404, jsonBody: { message: 'Team not found' } }
      }
      return { jsonBody: result.recordset[0] }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('teams-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'teams/{id:int}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const id = Number(req.params.id)
      const pool = await getPool()
      await pool.request()
        .input('id', id)
        .query('DELETE FROM cornhole_event_teams WHERE id = @id')
      return { jsonBody: { success: true } }
    } catch (err: any) {
      if (err.number === 547 || err.message?.includes('REFERENCE')) {
        return { status: 409, jsonBody: { message: 'Cannot delete: team is referenced by matches' } }
      }
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})
