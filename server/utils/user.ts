import type { H3Event } from 'h3'

let ownerId: string | null = null

/** La cuenta dueña de la app: la que usa quien entra con la contraseña o con la extensión. */
export async function ownerUserId(): Promise<string> {
  if (ownerId) return ownerId
  const id = await dbOwnerId()
  if (!id) {
    throw createError({ statusCode: 500, message: 'Falta la cuenta dueña. Aplica las migraciones de supabase/migrations.' })
  }
  ownerId = id
  return id
}

/**
 * De quién son los datos de esta petición: quien entró con Google, o el dueño si entró con la
 * contraseña (o la app no tiene contraseña). El middleware de auth ya comprobó que pueda entrar.
 */
export async function currentUserId(event: H3Event): Promise<string> {
  return readSession(event) ?? (await ownerUserId())
}

/** El correo del dueño: su primer login con Google reclama la cuenta provisional y sus datos. */
export const ownerEmail = () => String(useRuntimeConfig().ownerEmail || '').toLowerCase()
