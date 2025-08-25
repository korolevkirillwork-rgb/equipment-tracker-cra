import * as React from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthCtx = {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const Ctx = React.createContext<AuthCtx | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null)
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let unsub: (() => void) | undefined

    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session ?? null)
      setUser(data.session?.user ?? null)
      setLoading(false)

      const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
        setSession(sess ?? null)
        setUser(sess?.user ?? null)
      })
      unsub = () => sub.subscription.unsubscribe()
    }

    init()
    return () => { if (unsub) unsub() }
  }, [])

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value: AuthCtx = { user, session, loading, signOut }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
