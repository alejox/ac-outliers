import { createError } from 'h3'
import { parseIsoDuration, type Channel, type Video } from '~~/shared/outliers'
import type { ChannelRef } from '~~/shared/channel-input'

const API = 'https://www.googleapis.com/youtube/v3'

/** Videos por formato que se traen en cada actualización (máximo 50 por llamada). */
const VIDEOS_PER_FORMAT = 50

const QUOTA_MESSAGE = 'Se agotó la cuota diaria de la API de YouTube. Se reinicia a medianoche, hora del Pacífico.'
const KNOWN_ERRORS: Record<string, string> = {
  quotaExceeded: QUOTA_MESSAGE,
  dailyLimitExceeded: QUOTA_MESSAGE,
  rateLimitExceeded: 'YouTube está limitando las peticiones. Espera un minuto y vuelve a intentar.',
  accessNotConfigured: 'La YouTube Data API v3 no está habilitada en tu proyecto de Google Cloud.',
  keyInvalid: 'La clave de la API de YouTube no es válida. Revisa NUXT_YOUTUBE_API_KEY.',
}

class NotFound extends Error {}

async function yt<T>(path: string, query: Record<string, string | number>): Promise<T> {
  const { youtubeApiKey } = useRuntimeConfig()
  try {
    return await $fetch<T>(`${API}/${path}`, { query: { ...query, key: youtubeApiKey } })
  } catch (err: any) {
    const apiError = err?.data?.error
    const reason: string | undefined = apiError?.errors?.[0]?.reason
    if (reason === 'playlistNotFound' || reason === 'channelNotFound') throw new NotFound(reason)
    const invalidKey = /API key not valid/i.test(apiError?.message ?? '')
    throw createError({
      statusCode: reason && /quota|limit/i.test(reason) ? 429 : 502,
      message:
        (invalidKey ? KNOWN_ERRORS.keyInvalid : reason && KNOWN_ERRORS[reason]) ||
        `YouTube respondió con un error: ${apiError?.message ?? err?.message ?? 'desconocido'}`,
    })
  }
}

interface Thumbs {
  [size: string]: { url: string } | undefined
}
const pickThumb = (t?: Thumbs) => t?.medium?.url ?? t?.high?.url ?? t?.default?.url ?? null
const toNumber = (v: unknown) => (v === undefined || v === null ? null : Number(v))

/** Busca un canal por ID, @usuario o nombre de usuario antiguo. Cuesta 1 unidad de cuota. */
export async function fetchChannel(ref: ChannelRef): Promise<Channel | null> {
  const selector =
    'id' in ref ? { id: ref.id } : 'handle' in ref ? { forHandle: ref.handle } : { forUsername: ref.username }
  const res = await yt<{ items?: any[] }>('channels', { part: 'snippet,statistics', ...selector })
  const item = res.items?.[0]
  if (!item) return null
  return {
    id: item.id,
    title: item.snippet?.title ?? item.id,
    handle: item.snippet?.customUrl ?? null,
    thumbnailUrl: pickThumb(item.snippet?.thumbnails),
    subscriberCount: item.statistics?.hiddenSubscriberCount ? null : toNumber(item.statistics?.subscriberCount),
    lastSyncedAt: null,
  }
}

async function fetchPlaylistVideoIds(playlistId: string): Promise<string[]> {
  try {
    const res = await yt<{ items?: any[] }>('playlistItems', {
      part: 'contentDetails',
      playlistId,
      maxResults: VIDEOS_PER_FORMAT,
    })
    return (res.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean)
  } catch (err) {
    // Un canal sin Shorts (o sin videos largos) no tiene esa lista: no es un error.
    if (err instanceof NotFound) return []
    throw err
  }
}

async function fetchVideoDetails(ids: string[]): Promise<any[]> {
  const items: any[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const res = await yt<{ items?: any[] }>('videos', {
      part: 'snippet,statistics,contentDetails',
      id: ids.slice(i, i + 50).join(','),
      maxResults: 50,
    })
    items.push(...(res.items ?? []))
  }
  return items
}

/**
 * Trae los últimos videos de un canal con sus estadísticas. Cuesta unas 4 unidades de cuota.
 *
 * YouTube no marca qué video es un Short. Se usan las listas automáticas del canal:
 * "UULF…" contiene solo videos largos y "UUSH…" solo Shorts (los directos quedan fuera).
 * Si ninguna responde, se cae a la lista general de subidas y se clasifica por duración.
 */
export async function fetchChannelVideos(channelId: string): Promise<Video[]> {
  const suffix = channelId.slice(2)
  const [longIds, shortIds] = await Promise.all([
    fetchPlaylistVideoIds(`UULF${suffix}`),
    fetchPlaylistVideoIds(`UUSH${suffix}`),
  ])

  let shortSet: Set<string> | null = new Set(shortIds)
  let ids = [...longIds, ...shortIds]
  if (ids.length === 0) {
    ids = await fetchPlaylistVideoIds(`UU${suffix}`)
    shortSet = null
  }

  const videos: Video[] = []
  for (const item of await fetchVideoDetails(ids)) {
    const live = item.snippet?.liveBroadcastContent
    if (live === 'live' || live === 'upcoming') continue
    // Sin conteo de vistas público no hay nada que comparar.
    if (item.statistics?.viewCount === undefined) continue
    const durationSeconds = parseIsoDuration(item.contentDetails?.duration ?? '')
    videos.push({
      id: item.id,
      channelId,
      title: item.snippet?.title ?? '',
      thumbnailUrl: pickThumb(item.snippet?.thumbnails),
      publishedAt: item.snippet?.publishedAt,
      durationSeconds,
      isShort: shortSet ? shortSet.has(item.id) : durationSeconds > 0 && durationSeconds <= 60,
      views: Number(item.statistics.viewCount),
      likes: toNumber(item.statistics.likeCount),
      comments: toNumber(item.statistics.commentCount),
    })
  }
  return videos
}
