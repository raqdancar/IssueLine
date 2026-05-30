// Agrupa funcions compartides per accedir a dades i normalitzar informacio.

export const recordLoginAudit = async (supabaseClient, user) => {
  const payload = {
    user_id: user.id,
    email: user.email,
    source: 'web_app',
    metadata: { last_sign_in: user.last_sign_in_at },
  }

  const { error } = await supabaseClient.from('login_audit').insert([payload])

  if (error) {
    console.warn('Failed to record the access in login_audit', error.message)
  }
}
