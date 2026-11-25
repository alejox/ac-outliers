import { createHash } from 'node:crypto'
import { THUMB_WATCH_DAYS } from '~~/shared/changes'
import type { Video } from '~~/shared/outliers'

/** Una miniatura de 320×180 pesa unos 10–20 KB: se guarda como data URL para mostrar cómo era. */
const MAX_THUMB_BYTES = 60_000

/**
 * Baja la miniatura mediana de un video y saca su huella. No gasta cuota de la API: es una imagen
 * pública de i.ytimg.com. null si no se pudo bajar.
 */
export async function readThumb(video: Video): Promise<{ hash: string; data: string } | null> {
  const url = video.thumbnailUrl ?? `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_THUMB_BYTES) return null
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    return { hash: createHash('sha1').update(bytes).digest('hex'), data: `data:${type};base64,${bytes.toString('base64')}` }
  } catch {
    return null
  }
}

/** Las miniaturas de los videos recientes, de 8 en 8. */
export async function readRecentThumbs(videos: Video[], now = new Date()): Promise<Map<string, { hash: string; data: string }>> {
  const recent = videos.filter((v) => (now.getTime() - new Date(v.publishedAt).getTime()) / 86_400_000 <= THUMB_WATCH_DAYS)
  const out = new Map<string, { hash: string; data: string }>()
  for (let i = 0; i < recent.length; i += 8) {
    await Promise.all(
      recent.slice(i, i + 8).map(async (v) => {
        const thumb = await readThumb(v)
        if (thumb) out.set(v.id, thumb)
      }),
    )
  }
  return out
}
