// Provide auth form state and Supabase auth actions for the UI shell.

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { recordLoginAudit } from '@/lib/authAuditApi.js'

const initialFormValues = {
  email: '',
  password: '',
  confirmPassword: '',
}

const resolveAuthRedirectUrl = () => {
  const configuredUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim()
  if (configuredUrl) return configuredUrl
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/auth/verified`
  }
  return undefined
}

export const useAuthActions = ({ t, onSignedIn, onSignUpSuccess } = {}) => {
  const [formValues, setFormValues] = useState(initialFormValues)
  const [status, setStatus] = useState({ state: 'idle', message: '' })
  const [saving, setSaving] = useState(false)

  const handleChange = useCallback((event) => {
    const { name, value } = event.target
    setFormValues((previous) => ({ ...previous, [name]: value }))
  }, [])

  const handleSignIn = useCallback(async () => {
    if (!supabase) return false

    if (!formValues.email.trim() || !formValues.password.trim()) {
      setStatus({ state: 'error', message: t('app.emailPasswordRequired') })
      return false
    }

    setSaving(true)
    setStatus({ state: 'loading', message: t('app.validatingCredentials') })

    const credentials = {
      email: formValues.email.trim().toLowerCase(),
      password: formValues.password,
      options: {
        emailRedirectTo: resolveAuthRedirectUrl(),
      },
    }

    const { data, error } = await supabase.auth.signInWithPassword(credentials)

    if (error) {
      setStatus({ state: 'error', message: error.message })
      setSaving(false)
      return false
    }

    if (data.user) {
      setStatus({
        state: 'success',
        message: t('app.signedInAs', { email: data.user.email }),
      })
      setFormValues(initialFormValues)
      await recordLoginAudit(supabase, data.user)
      onSignedIn?.(data.user)
    }

    setSaving(false)
    return true
  }, [formValues.email, formValues.password, onSignedIn, t])

  const handleSignUp = useCallback(async () => {
    if (!supabase) return false

    if (!formValues.email.trim() || !formValues.password.trim()) {
      setStatus({ state: 'error', message: t('app.emailPasswordRequired') })
      return false
    }

    if (formValues.password !== formValues.confirmPassword) {
      setStatus({ state: 'error', message: t('app.passwordsDoNotMatch') })
      return false
    }

    setSaving(true)
    setStatus({ state: 'loading', message: t('app.creatingAccount') })

    const credentials = {
      email: formValues.email.trim().toLowerCase(),
      password: formValues.password,
    }

    const { data, error } = await supabase.auth.signUp(credentials)

    if (error) {
      setStatus({ state: 'error', message: error.message })
      setSaving(false)
      return false
    }

    if (data?.user) {
      setStatus({
        state: 'success',
        message: t('app.accountCreatedCheckInbox'),
      })
      setFormValues(initialFormValues)
      onSignUpSuccess?.(data.user)
    }

    setSaving(false)
    return true
  }, [formValues.confirmPassword, formValues.email, formValues.password, onSignUpSuccess, t])

  const handleSignOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setStatus({ state: 'idle', message: t('app.signedOut') })
  }, [t])

  return {
    formValues,
    status,
    saving,
    handleChange,
    handleSignIn,
    handleSignUp,
    handleSignOut,
  }
}
