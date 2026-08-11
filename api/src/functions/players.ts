import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { getPool } from '../db'
import { requireAuth, isRejection } from '../lib/auth'

app.http('players-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'players',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const pool = await getPool()
      const result = await pool.request().query(
        `SELECT playerid, CAST(firstname AS NVARCHAR(MAX)) AS firstname, CAST(lastname AS NVARCHAR(MAX)) AS lastname,
         CAST(email AS NVARCHAR(MAX)) AS email, CAST(phone AS NVARCHAR(MAX)) AS phone, handicap,
         CAST(CASE WHEN profile_secret IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_secret, created_at, updated_at
         FROM players ORDER BY CAST(lastname AS NVARCHAR(MAX)) ASC, CAST(firstname AS NVARCHAR(MAX)) ASC`
      )
      return { jsonBody: result.recordset }
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
      const body = await req.json() as any
      const pool = await getPool()
      const result = await pool.request()
        .input('firstname', body.firstname)
        .input('lastname', body.lastname)
        .input('email', body.email || null)
        .input('phone', body.phone || null)
        .input('handicap', body.handicap != null ? Number(body.handicap) : null)
        .input('profile_secret', body.profile_secret || null)
        .query(
          `INSERT INTO players (firstname, lastname, email, phone, handicap, profile_secret)
           OUTPUT INSERTED.playerid, CAST(INSERTED.firstname AS NVARCHAR(MAX)) AS firstname, CAST(INSERTED.lastname AS NVARCHAR(MAX)) AS lastname,
           CAST(INSERTED.email AS NVARCHAR(MAX)) AS email, CAST(INSERTED.phone AS NVARCHAR(MAX)) AS phone, INSERTED.handicap,
           CAST(CASE WHEN INSERTED.profile_secret IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_secret, INSERTED.created_at, INSERTED.updated_at
           VALUES (@firstname, @lastname, @email, @phone, @handicap, @profile_secret)`
        )
      return { jsonBody: result.recordset[0] }
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
      const body = await req.json() as any
      const pool = await getPool()
      const result = await pool.request()
        .input('id', id)
        .input('firstname', body.firstname)
        .input('lastname', body.lastname)
        .input('email', body.email || null)
        .input('phone', body.phone || null)
        .input('handicap', body.handicap != null ? Number(body.handicap) : null)
        .input('profile_secret', body.profile_secret || null)
        .query(
          `UPDATE players SET firstname = @firstname, lastname = @lastname, email = @email,
           phone = @phone, handicap = @handicap, profile_secret = @profile_secret
           OUTPUT INSERTED.playerid, CAST(INSERTED.firstname AS NVARCHAR(MAX)) AS firstname, CAST(INSERTED.lastname AS NVARCHAR(MAX)) AS lastname,
           CAST(INSERTED.email AS NVARCHAR(MAX)) AS email, CAST(INSERTED.phone AS NVARCHAR(MAX)) AS phone, INSERTED.handicap,
           CAST(CASE WHEN INSERTED.profile_secret IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_secret, INSERTED.created_at, INSERTED.updated_at
           WHERE playerid = @id`
        )
      if (result.recordset.length === 0) {
        return { status: 404, jsonBody: { message: 'Player not found' } }
      }
      return { jsonBody: result.recordset[0] }
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
      const pool = await getPool()
      await pool.request()
        .input('id', id)
        .query('DELETE FROM players WHERE playerid = @id')
      return { jsonBody: { success: true } }
    } catch (err: any) {
      if (err.number === 547 || err.message?.includes('REFERENCE')) {
        return { status: 409, jsonBody: { message: 'Cannot delete: player is referenced by teams' } }
      }
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})
