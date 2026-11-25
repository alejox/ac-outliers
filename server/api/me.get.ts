/** Quién entró y qué formas de entrar hay. Responde aunque no haya sesión: lo usa la pantalla de entrada. */
export default defineEventHandler(async (event) => {
  const google = googleConfigured()
  const userId = readSession(event)
  const user = userId && appMode() === 'live' ? await dbGetUser(userId) : null
  return {
    google,
    password: Boolean(useRuntimeConfig().appPassword),
    user: user && {
      email: user.email,
      name: user.name,
      picture: user.picture,
      channelId: user.channelId,
      channelTitle: user.channelTitle,
      analytics: Boolean(user.refreshTokenEnc),
    },
  }
})
