/** Cierra la sesión en esta app (no en Google): la de Google y la de la contraseña. */
export default defineEventHandler((event) => {
  deleteCookie(event, USER_COOKIE, { path: '/' })
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  return { ok: true }
})
