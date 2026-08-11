const BASE = '/api'
const SESSION_STORAGE_KEY = 'cornhole_session'

export interface StoredSessionPlayer {
  playerid: number
  firstname: string
  lastname: string
  email?: string
  phone?: string
  handicap?: number
}

export interface StoredSession {
  token: string
  player: StoredSessionPlayer
}

export function getStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredSession
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export function setStoredSession(session: StoredSession) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY)
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const session = getStoredSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session) headers['X-Session-Token'] = session.token

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || res.statusText)
  }
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
