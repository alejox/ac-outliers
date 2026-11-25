/**
 * Si defines NUXT_APP_PASSWORD, toda la API exige haber entrado con esa contraseña.
 * Sin ella la app queda abierta, que solo conviene en tu computador.
 */
export default defineEventHandler((event) => {
  const { appPassword } = useRuntimeConfig()
  if (!appPassword) return

  const path = event.path.split('?')[0]!
  if (event.method === 'OPTIONS') return
  // El cron tiene su propia protección (CRON_SECRET).
  if (
    !path.startsWith('/api/') ||
    path === '/api/login' ||
    path === '/api/me' ||
    path.startsWith('/api/auth/') ||
    path === '/api/ext/connect' ||
    path.startsWith('/api/cron/')
  )
    return

  // Quien entró con Google (y Google lo dejó pasar como usuario de prueba) también tiene acceso.
  if (readSession(event)) return

  // La web entra con la cookie de sesión; la extensión del navegador manda el mismo valor como token.
  const bearer = /^Bearer (.+)$/.exec(getRequestHeader(event, 'authorization') ?? '')?.[1]
  const given = bearer ?? getCookie(event, SESSION_COOKIE) ?? ''
  if (!safeEqual(given, sessionToken(appPassword))) {
    throw createError({ statusCode: 401, message: 'Escribe la contraseña para entrar.' })
  }
})
