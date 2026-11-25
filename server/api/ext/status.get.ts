/**
 * La extensión lo usa para saber si sigue conectada, si la app está en modo demo y con qué cuenta
 * está conectada (null si se conectó con la contraseña de la app).
 */
export default defineEventHandler(async (event) => {
  const mode = appMode()
  const userId = readSession(event)
  const user = userId && mode === 'live' ? await dbGetUser(userId) : null
  return { ok: true, mode, account: user ? { email: user.email, name: user.name, channelTitle: user.channelTitle } : null }
})
