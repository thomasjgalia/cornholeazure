import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from '@/lib/api'

interface Identity {
  memberId: number
  displayName: string
}

interface SessionResponse {
  identity: Identity | null
  isAdmin: boolean
}

interface AuthContextType {
  identity: Identity | null
  isAdmin: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse>({ identity: null, isAdmin: false })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<SessionResponse>('/session')
      .then(setSession)
      .catch(() => setSession({ identity: null, isAdmin: false }))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ identity: session.identity, isAdmin: session.isAdmin, loading }}>
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
