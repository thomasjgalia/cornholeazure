import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { signSession } from '../lib/auth'
import { getPlayer } from '../lib/playersTable'

app.http('auth-claim', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/claim',
  handler: async (req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = await req.json() as any
      const playerid = Number(body.playerid)
      const secret = typeof body.secret === 'string' ? body.secret.trim() : ''

      if (!playerid || !secret) {
        return { status: 400, jsonBody: { message: 'playerid and secret are required' } }
      }

      const player = await getPlayer(playerid)
      if (!player || !player.profile_secret || player.profile_secret.toLowerCase() !== secret.toLowerCase()) {
        return { status: 401, jsonBody: { message: 'Invalid player or secret' } }
      }

      const token = signSession(player.playerid)

      return {
        jsonBody: {
          token,
          player: {
            playerid: player.playerid,
            firstname: player.firstname,
            lastname: player.lastname,
            email: player.email,
            phone: player.phone,
            handicap: player.handicap,
          },
        },
      }
    } catch (err: any) {
      return { status: 500, jsonBody: { message: err.message } }
    }
  },
})
