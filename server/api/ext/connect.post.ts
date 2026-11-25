/**
 * Conecta la extensión: con la contraseña de la app devuelve el token que la extensión manda en cada
 * petición. Es el mismo valor de la sesión web, así que cambiar la contraseña también la desconecta.
 */
export default defineEventHandler(async (event) => {
  const { appPassword } = useRuntimeConfig()
  const mode = appMode()
  if (!appPassword) return { token: '', mode }

  const body = await readBody<{ password?: string }>(event)
  const given = typeof body?.password === 'string' ? body.password : ''
  if (!safeEqual(sessionToken(given), sessionToken(appPassword))) {
    throw createError({ statusCode: 401, message: 'Esa contraseña no es correcta.' })
  }
  return { token: sessionToken(appPassword), mode }
})
