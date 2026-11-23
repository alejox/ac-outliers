/** Entra con la contraseña de la app y deja una cookie de sesión de 30 días. */
export default defineEventHandler(async (event) => {
  const { appPassword } = useRuntimeConfig()
  if (!appPassword) return { ok: true }

  const body = await readBody<{ password?: string }>(event)
  const given = typeof body?.password === 'string' ? body.password : ''
  if (!safeEqual(sessionToken(given), sessionToken(appPassword))) {
    throw createError({ statusCode: 401, message: 'Esa contraseña no es correcta.' })
  }

  setCookie(event, SESSION_COOKIE, sessionToken(appPassword), {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return { ok: true }
})
