import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getPool } from '../db'

app.http('events-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const pool = await getPool()
      const result = await pool.request().query(
        'SELECT id, CAST(name AS NVARCHAR(MAX)) AS name, [date], champion_gets_bye, created_at FROM cornhole_events ORDER BY [date] DESC'
      )
      return { jsonBody: result.recordset }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('events-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events/{id:int}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const id = Number(req.params.id)
      const pool = await getPool()
      const result = await pool.request()
        .input('id', id)
        .query('SELECT id, CAST(name AS NVARCHAR(MAX)) AS name, [date], champion_gets_bye, created_at FROM cornhole_events WHERE id = @id')
      if (result.recordset.length === 0) {
        return { status: 404, jsonBody: { message: 'Event not found' } }
      }
      return { jsonBody: result.recordset[0] }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('events-create', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'events',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = await req.json() as any
      const pool = await getPool()
      const transaction = pool.transaction()
      await transaction.begin()

      try {
        // Create event
        const eventResult = await transaction.request()
          .input('name', body.name)
          .input('date', body.date)
          .input('champion_gets_bye', body.champion_gets_bye ? 1 : 0)
          .query(
            `INSERT INTO cornhole_events (name, [date], champion_gets_bye)
             OUTPUT INSERTED.id, CAST(INSERTED.name AS NVARCHAR(MAX)) AS name, INSERTED.[date], INSERTED.champion_gets_bye, INSERTED.created_at
             VALUES (@name, @date, @champion_gets_bye)`
          )
        const newEvent = eventResult.recordset[0]

        // Create champion team if specified
        if (body.champion_team) {
          await transaction.request()
            .input('event_id', newEvent.id)
            .input('player1_id', Number(body.champion_team.player1_id))
            .input('player2_id', Number(body.champion_team.player2_id))
            .input('is_reigning_champion', 1)
            .query(
              `INSERT INTO cornhole_event_teams (event_id, player1_id, player2_id, is_reigning_champion)
               VALUES (@event_id, @player1_id, @player2_id, @is_reigning_champion)`
            )
        }

        // Create participant teams if specified
        if (body.participant_teams && body.participant_teams.length > 0) {
          for (const team of body.participant_teams) {
            await transaction.request()
              .input('event_id', newEvent.id)
              .input('player1_id', Number(team.player1_id))
              .input('player2_id', Number(team.player2_id))
              .input('is_reigning_champion', 0)
              .query(
                `INSERT INTO cornhole_event_teams (event_id, player1_id, player2_id, is_reigning_champion)
                 VALUES (@event_id, @player1_id, @player2_id, @is_reigning_champion)`
              )
          }
        }

        await transaction.commit()
        return { jsonBody: newEvent }
      } catch (innerErr) {
        await transaction.rollback()
        throw innerErr
      }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('events-update', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'events/{id:int}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const id = Number(req.params.id)
      const body = await req.json() as any
      const pool = await getPool()
      const result = await pool.request()
        .input('id', id)
        .input('name', body.name)
        .input('date', body.date)
        .input('champion_gets_bye', body.champion_gets_bye ? 1 : 0)
        .query(
          `UPDATE cornhole_events SET name = @name, [date] = @date, champion_gets_bye = @champion_gets_bye
           OUTPUT INSERTED.id, CAST(INSERTED.name AS NVARCHAR(MAX)) AS name, INSERTED.[date], INSERTED.champion_gets_bye, INSERTED.created_at
           WHERE id = @id`
        )
      if (result.recordset.length === 0) {
        return { status: 404, jsonBody: { message: 'Event not found' } }
      }
      return { jsonBody: result.recordset[0] }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})

app.http('events-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'events/{id:int}',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const id = Number(req.params.id)
      const pool = await getPool()
      await pool.request()
        .input('id', id)
        .query('DELETE FROM cornhole_events WHERE id = @id')
      return { jsonBody: { success: true } }
    } catch (err: any) {
      if (err.number === 547 || err.message?.includes('REFERENCE')) {
        return { status: 409, jsonBody: { message: 'Cannot delete: event has teams or matches' } }
      }
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})
