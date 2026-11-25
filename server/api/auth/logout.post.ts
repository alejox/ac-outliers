/** Cierra la sesión de Google en esta app (no en Google). */
export default defineEventHandler((event) => {
  deleteCookie(event, USER_COOKIE, { path: '/' })
  return { ok: true }
})
