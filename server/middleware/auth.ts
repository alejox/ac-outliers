/**
 * Si defines NUXT_APP_PASSWORD, toda la API exige haber entrado con esa contraseña.
 * Sin ella la app queda abierta, que solo conviene en tu computador.
 */
export default defineEventHandler((event) => {
  const { appPassword } = useRuntimeConfig()
  if (!appPassword) return

  const path = event.path.split('?')[0]!
  // El cron tiene su propia protección (CRON_SECRET).
  if (!path.startsWith('/api/') || path === '/api/login' || path.startsWith('/api/cron/')) return

  const cookie = getCookie(event, SESSION_COOKIE) ?? ''
  if (!safeEqual(cookie, sessionToken(appPassword))) {
    throw createError({ statusCode: 401, message: 'Escribe la contraseña para entrar.' })
  }
})
