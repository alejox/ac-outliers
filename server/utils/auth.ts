import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'ac_session'

/** Valor de la cookie de sesión: se deriva de la contraseña, así que cambiarla cierra todas las sesiones. */
export function sessionToken(password: string): string {
  return createHmac('sha256', password).update('ac-outliers-session').digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}
