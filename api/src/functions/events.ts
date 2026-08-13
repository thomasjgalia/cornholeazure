import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { requireAuth, isRejection } from '../lib/auth'
import { listEvents, getEvent, createEvent, updateEvent, deleteEvent } from '../lib/eventsTable'
import { createTeamsBatch, deleteTeamsForEvent } from '../lib/teamsTable'

app.http('events-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'events',
  handler: async (_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const events = await listEvents()
      return { jsonBody: events }
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
      const event = await getEvent(Number(req.params.id))
      if (!event) return { status: 404, jsonBody: { message: 'Event not found' } }
      return { jsonBody: event }
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
    const session = requireAuth(req)
    if (isRejection(session)) return session
    try {
      const body = (await req.json()) as any

      // Event row first, then all of its initial teams (champion +
      // participants) as one atomic batch - see teamsTable.createTeamsBatch.
      // If the batch fails, the event exists with zero teams rather than a
      // fully rolled-back nothing (Table Storage can't span two tables in
      // one transaction) - recoverable via the UI, a smaller failure
      // surface than partially-created teams.
      const newEvent = await createEvent({
        name: body.name,
        date: body.date,
        champion_gets_bye: !!body.champion_gets_bye,
      })

      const teamsToCreate: { event_id: number; player1_id: number; player2_id: number; is_reigning_champion: boolean }[] = []
      if (body.champion_team) {
        teamsToCreate.push({
          event_id: newEvent.id,
          player1_id: Number(body.champion_team.player1_id),
          player2_id: Number(body.champion_team.player2_id),
          is_reigning_champion: true,
        })
      }
      if (body.participant_teams?.length) {
        for (const team of body.participant_teams) {
          teamsToCreate.push({
            event_id: newEvent.id,
            player1_id: Number(team.player1_id),
            player2_id: Number(team.player2_id),
            is_reigning_champion: false,
          })
        }
      }
      if (teamsToCreate.length > 0) {
        await createTeamsBatch(teamsToCreate)
      }

      return { jsonBody: newEvent }
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
    const session = requireAuth(req)
    if (isRejection(session)) return session
    try {
      const id = Number(req.params.id)
      const body = (await req.json()) as any
      const event = await updateEvent(id, {
        name: body.name,
        date: body.date,
        champion_gets_bye: !!body.champion_gets_bye,
      })
      if (!event) return { status: 404, jsonBody: { message: 'Event not found' } }
      return { jsonBody: event }
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
    const session = requireAuth(req)
    if (isRejection(session)) return session
    try {
      const id = Number(req.params.id)
      // Teams live in their own table now - clean those up too rather than
      // leaving them behind as orphaned, unreachable data.
      // TODO(cascade): also clean up this event's matches once that table
      // migrates off SQL too.
      await deleteTeamsForEvent(id)
      await deleteEvent(id)
      return { jsonBody: { success: true } }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})
