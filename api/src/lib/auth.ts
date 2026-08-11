import { createHmac, timingSafeEqual } from 'crypto'
import { HttpRequest, HttpResponseInit } from '@azure/functions'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export interface SessionPayload {
  playerid: number
  exp: number
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET is not configured')
  }
  return secret
}

function sign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('base64url')
}

export function signSession(playerid: number): string {
  const payload: SessionPayload = { playerid, exp: Date.now() + SESSION_TTL_MS }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = sign(body)
  return `${body}.${signature}`
}

export function verifySession(token: string): SessionPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, signature] = parts

  const expectedSignature = sign(body)
  const sigBuf = Buffer.from(signature)
  const expectedBuf = Buffer.from(expectedSignature)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (typeof payload.playerid !== 'number' || typeof payload.exp !== 'number') {
      return null
    }
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function getSession(req: HttpRequest): SessionPayload | null {
  const token = req.headers.get('x-session-token')
  if (!token) return null
  return verifySession(token)
}

export function requireAuth(req: HttpRequest): SessionPayload | HttpResponseInit {
  const session = getSession(req)
  if (!session) {
    return { status: 401, jsonBody: { message: 'Authentication required' } }
  }
  return session
}

export function isRejection(result: SessionPayload | HttpResponseInit): result is HttpResponseInit {
  return 'status' in result
}
