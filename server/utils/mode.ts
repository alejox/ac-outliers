import { createError } from 'h3'
import { detectChanges } from '~~/shared/changes'
import type { Channel } from '~~/shared/outliers'

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

/**
 * Refresca las cifras de un canal y sus videos desde YouTube y los guarda. Devuelve cuántos videos encontró.
 * Si ya tienes el canal recién leído, pásalo para no gastar otra consulta.
 */
export async function syncChannel(channelId: string, fresh?: Channel): Promise<number> {
  const channel = fresh ?? (await fetchChannel({ id: channelId }))
  if (channel) await dbSaveChannel(channel)
  const videos = await fetchChannelVideos(channelId)

  // Antes de guardar: qué títulos y miniaturas cambiaron desde la lectura anterior.
  const [marks, thumbs] = await Promise.all([dbListVideoMarks(videos.map((v) => v.id)), readRecentThumbs(videos)])
  const changes = detectChanges(
    marks,
    videos.map((v) => ({ id: v.id, title: v.title, thumbHash: thumbs.get(v.id)?.hash ?? null, thumbData: thumbs.get(v.id)?.data ?? null })),
    new Date().toISOString(),
  )

  await dbSaveChannelVideos(channelId, videos)
  await dbSaveThumbs(videos, thumbs)
  await dbSaveVideoChanges(changes)
  return videos.length
}
