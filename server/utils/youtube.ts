import { createError } from 'h3'
import { parseIsoDuration, type Channel, type Video } from '~~/shared/outliers'
import type { ChannelRef } from '~~/shared/channel-input'

const API = 'https://www.googleapis.com/youtube/v3'

/** Videos por formato que se traen en cada actualización (máximo 50 por llamada). */
const VIDEOS_PER_FORMAT = 50
/** Videos que trae cada búsqueda por tema. Más resultados son más canales que revisar y más cuota. */
const SEARCH_RESULTS = 25

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
  return item ? toChannel(item) : null
}

function toChannel(item: any): Channel {
  return {
    id: item.id,
    title: item.snippet?.title ?? item.id,
    handle: item.snippet?.customUrl ?? null,
    thumbnailUrl: pickThumb(item.snippet?.thumbnails),
    subscriberCount: item.statistics?.hiddenSubscriberCount ? null : toNumber(item.statistics?.subscriberCount),
    viewCount: toNumber(item.statistics?.viewCount),
    videoCount: toNumber(item.statistics?.videoCount),
    lastSyncedAt: null,
    isMine: false,
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

/** Convierte un video de la API al formato de la app. null si no sirve para comparar. */
function toVideo(item: any, isShort: boolean | null): Video | null {
  const live = item.snippet?.liveBroadcastContent
  if (live === 'live' || live === 'upcoming') return null
  // Sin conteo de vistas público no hay nada que comparar.
  if (item.statistics?.viewCount === undefined) return null
  const durationSeconds = parseIsoDuration(item.contentDetails?.duration ?? '')
  return {
    id: item.id,
    channelId: item.snippet?.channelId,
    title: item.snippet?.title ?? '',
    thumbnailUrl: pickThumb(item.snippet?.thumbnails),
    publishedAt: item.snippet?.publishedAt,
    durationSeconds,
    isShort: isShort ?? (durationSeconds > 0 && durationSeconds <= 60),
    categoryId: item.snippet?.categoryId ?? null,
    views: Number(item.statistics.viewCount),
    likes: toNumber(item.statistics.likeCount),
    comments: toNumber(item.statistics.commentCount),
    tags: Array.isArray(item.snippet?.tags) ? (item.snippet.tags as string[]).slice(0, 60) : [],
  }
}

const isVideo = (v: Video | null): v is Video => v !== null

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

  const items = await fetchVideoDetails(ids)
  return items.map((item) => toVideo(item, shortSet ? shortSet.has(item.id) : null)).filter(isVideo)
}

/** Solo los últimos videos largos de un canal: lo mínimo para saber qué es normal en él. 2 unidades. */
export async function fetchLongVideos(channelId: string): Promise<Video[]> {
  const ids = await fetchPlaylistVideoIds(`UULF${channelId.slice(2)}`)
  const items = await fetchVideoDetails(ids)
  return items.map((item) => toVideo(item, false)).filter(isVideo)
}

/** Solo los últimos Shorts de un canal, para saber qué es normal en ellos. 2 unidades. */
export async function fetchShortVideos(channelId: string): Promise<Video[]> {
  const ids = await fetchPlaylistVideoIds(`UUSH${channelId.slice(2)}`)
  const items = await fetchVideoDetails(ids)
  return items.map((item) => toVideo(item, true)).filter(isVideo)
}

/** Las etiquetas que el creador le puso a un video. 1 unidad. */
export async function fetchVideoTags(id: string): Promise<string[] | null> {
  const res = await yt<{ items?: any[] }>('videos', { part: 'snippet', id })
  const item = res.items?.[0]
  return item ? ((item.snippet?.tags as string[] | undefined) ?? []) : null
}

/** Videos sueltos por ID, tratados como videos largos. 1 unidad por cada 50. */
export async function fetchVideosByIds(ids: string[]): Promise<Video[]> {
  const items = await fetchVideoDetails(ids)
  return items.map((item) => toVideo(item, false)).filter(isVideo)
}

/** Datos básicos de varios canales a la vez. 1 unidad por cada 50. */
export async function fetchChannelsByIds(ids: string[]): Promise<Channel[]> {
  const channels: Channel[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const res = await yt<{ items?: any[] }>('channels', {
      part: 'snippet,statistics',
      id: ids.slice(i, i + 50).join(','),
      maxResults: 50,
    })
    channels.push(...(res.items ?? []).map(toChannel))
  }
  return channels
}

export interface SearchOptions {
  /** Palabras clave. Puede ir vacío si hay categoría. */
  query: string
  /** 0 = cualquier fecha */
  days: number
  /** ID de categoría de YouTube, o '' para todas. */
  categoryId: string
  /** Código de idioma (por ejemplo 'es') para preferir resultados en ese idioma, o ''. */
  language: string
  order: 'relevance' | 'viewCount'
}

/** Busca videos en todo YouTube por tema, categoría o ambos. Es la llamada cara: 100 unidades. */
export async function searchVideoIds(options: SearchOptions): Promise<string[]> {
  const { query, days, categoryId, language, order } = options
  const params: Record<string, string | number> = {
    part: 'id',
    type: 'video',
    order,
    maxResults: SEARCH_RESULTS,
  }
  if (query) params.q = query
  if (categoryId) params.videoCategoryId = categoryId
  if (language) params.relevanceLanguage = language
  if (days > 0) params.publishedAfter = new Date(Date.now() - days * 86_400_000).toISOString()
  const res = await yt<{ items?: any[] }>('search', params)
  return (res.items ?? []).map((i) => i.id?.videoId).filter(Boolean)
}
