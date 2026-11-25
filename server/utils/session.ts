import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'

export const USER_COOKIE = 'ac_user'
const SESSION_DAYS = 30

/**
 * Claves derivadas del secreto del cliente de Google: no hace falta otra variable de entorno.
 * Si el secreto cambia, las sesiones y los permisos guardados dejan de valer y toca volver a entrar.
 */
function key(purpose: string): Buffer {
  const { googleClientSecret } = useRuntimeConfig()
  return createHash('sha256').update(`${googleClientSecret}|ac-outliers|${purpose}`).digest()
}

export const googleConfigured = () => {
  const { googleClientId, googleClientSecret } = useRuntimeConfig()
  return Boolean(googleClientId && googleClientSecret)
}

export function signSession(userId: string): string {
  const exp = Date.now() + SESSION_DAYS * 86_400_000
  const body = `${userId}.${exp}`
  return `${body}.${createHmac('sha256', key('session')).update(body).digest('base64url')}`
}

/** El ID del usuario con sesión iniciada, o null. */
export function readSession(event: H3Event): string | null {
  if (!googleConfigured()) return null
  const raw = getCookie(event, USER_COOKIE) ?? ''
  const [userId, exp, sig] = raw.split('.')
  if (!userId || !exp || !sig || Number(exp) < Date.now()) return null
  const expected = createHmac('sha256', key('session')).update(`${userId}.${exp}`).digest('base64url')
  return safeEqual(sig, expected) ? userId : null
}

export function setUserCookie(event: H3Event, userId: string) {
  setCookie(event, USER_COOKIE, signSession(userId), {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
}

/** Cifra el permiso de Google (refresh token) antes de guardarlo. AES-256-GCM. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key('token'), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.')
}

export function decryptSecret(sealed: string): string | null {
  try {
    const [iv, tag, data] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'))
    const decipher = createDecipheriv('aes-256-gcm', key('token'), iv!)
    decipher.setAuthTag(tag!)
    return Buffer.concat([decipher.update(data!), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
