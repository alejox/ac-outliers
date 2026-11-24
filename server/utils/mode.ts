import { createError } from 'h3'

/**
 * Sin ninguna clave configurada la app corre en modo demo, con datos de ejemplo.
 * Con las tres claves usa YouTube y Supabase de verdad.
 */
export function appMode(): 'demo' | 'live' {
  const { youtubeApiKey, supabaseUrl, supabaseSecretKey } = useRuntimeConfig()
  const missing = [
    !youtubeApiKey && 'NUXT_YOUTUBE_API_KEY',
    !supabaseUrl && 'NUXT_SUPABASE_URL',
    !supabaseSecretKey && 'NUXT_SUPABASE_SECRET_KEY',
  ].filter(Boolean)

  if (missing.length === 3) return 'demo'
  if (missing.length > 0) {
    throw createError({
      statusCode: 500,
      message: `Falta configurar ${missing.join(' y ')} en el archivo .env.`,
    })
  }
  if (!/^https?:\/\/[^/]+\/?$/.test(supabaseUrl) || /(^|\.)supabase\.com\/?$/.test(new URL(supabaseUrl).hostname)) {
    throw createError({
      statusCode: 500,
      message: 'NUXT_SUPABASE_URL no es la URL del proyecto. Debe tener la forma https://xxxx.supabase.co, sin nada después.',
    })
  }
  return 'live'
}

export function requireLive(): void {
  if (appMode() === 'demo') {
    throw createError({
      statusCode: 400,
      message: 'Estás en modo demo. Agrega tus claves en el archivo .env para usar canales reales.',
    })
  }
}

/** Trae los videos de un canal desde YouTube y los guarda. Devuelve cuántos encontró. */
export async function syncChannel(channelId: string): Promise<number> {
  const videos = await fetchChannelVideos(channelId)
  await dbSaveChannelVideos(channelId, videos)
  return videos.length
}
