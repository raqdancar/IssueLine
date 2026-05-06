// Provide session and navbar avatar state sourced from Supabase auth.

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

const resolveAvatarBucket = (session) =>
  session?.user?.user_metadata?.avatar_bucket || import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || 'avatars'

export const useSupabaseSession = () => {
  const [session, setSession] = useState(null)

  useEffect(() => {
    if (!supabase) return undefined

    let isMounted = true

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (isMounted) {
        setSession(data.session ?? null)
      }
    }

    void syncSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession)
      }
    })

    return () => {
      isMounted = false
      authListener?.subscription.unsubscribe()
    }
  }, [])

  const avatarPath = session?.user?.user_metadata?.avatar_path ?? null
  const avatarBucket = resolveAvatarBucket(session)
  const avatarQuery = useQuery({
    queryKey: ['navbar-avatar', session?.user?.id ?? 'guest', avatarBucket, avatarPath],
    enabled: Boolean(supabase && avatarPath),
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(avatarBucket).createSignedUrl(avatarPath, 60 * 60 * 24)
      if (error) return null
      return data?.signedUrl ?? null
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })

  const navAvatarUrl = avatarPath ? avatarQuery.data ?? null : null

  return {
    session,
    navAvatarUrl,
  }
}
