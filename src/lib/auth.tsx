import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '@/lib/api'
import {
  getStoredSession,
  setStoredSession,
  clearStoredSession,
  StoredSession,
  StoredSessionPlayer,
} from '@/lib/api'

interface AuthContextType {
  claimedPlayer: StoredSessionPlayer | null
  claimProfile: (playerid: number, secret: string) => Promise<void>
  releaseProfile: () => void
  isProfileClaimed: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null)

  useEffect(() => {
    setSession(getStoredSession())
  }, [])

  async function claimProfile(playerid: number, secret: string) {
    const result = await api.post<{ token: string; player: StoredSessionPlayer }>(
      '/auth/claim',
      { playerid, secret }
    )
    const newSession: StoredSession = { token: result.token, player: result.player }
    setStoredSession(newSession)
    setSession(newSession)
  }

  function releaseProfile() {
    clearStoredSession()
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{
        claimedPlayer: session?.player ?? null,
        claimProfile,
        releaseProfile,
        isProfileClaimed: !!session,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
