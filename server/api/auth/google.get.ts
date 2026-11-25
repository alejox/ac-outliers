import { randomBytes } from 'node:crypto'

/** Empieza el login con Google: guarda un valor al azar para comprobar la vuelta y manda a Google. */
export default defineEventHandler((event) => {
  if (!googleConfigured()) {
    throw createError({ statusCode: 400, message: 'El login con Google no está configurado todavía.' })
  }
  const state = randomBytes(16).toString('base64url')
  setCookie(event, 'ac_oauth_state', state, { httpOnly: true, secure: !import.meta.dev, sameSite: 'lax', path: '/', maxAge: 600 })
  // A dónde volver después de entrar: solo rutas de esta misma app.
  const next = String(getQuery(event).next ?? '')
  if (/^\/(?!\/)[\w\-/?=&]*$/.test(next)) {
    setCookie(event, 'ac_oauth_next', next, { httpOnly: true, secure: !import.meta.dev, sameSite: 'lax', path: '/', maxAge: 600 })
  }
  return sendRedirect(event, authorizeUrl(event, state))
})
