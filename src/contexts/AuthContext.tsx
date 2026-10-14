'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { authClient } from '@/lib/auth-client'
import type { AuthUser } from '@/lib/auth'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession()
  const u = data?.user
  const user: AuthUser | null = u ? { id: u.id, email: u.email, name: u.name } : null
  return (
    <AuthContext.Provider value={{ user, loading: isPending }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
