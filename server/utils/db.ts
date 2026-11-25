import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import type { ChannelSnapshot } from '~~/shared/achievements'
import type { ChangeKind, VideoChange, VideoMark } from '~~/shared/changes'
import type { Baseline } from '~~/shared/extension'
import type { MomentumPoint } from '~~/shared/home'
import type { Channel, PreviousReading, ScoredVideo, Topic, Video } from '~~/shared/outliers'

/** Los datos de YouTube que no se refrescan en este plazo se borran (política de la API). */
const STALE_AFTER_DAYS = 30
const PAGE = 1000

let client: SupabaseClient | null = null

function db(): SupabaseClient {
  if (!client) {
    const { supabaseUrl, supabaseSecretKey } = useRuntimeConfig()
    client = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

function check(error: { message: string } | null, action: string) {
  if (!error) return
  const raw = error.message ?? ''
  let reason = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw
  if (/<!doctype|<html/i.test(raw)) {
    // Respondió una página web: la URL no es la de la API del proyecto.
    reason = 'NUXT_SUPABASE_URL no es la URL del proyecto. Debe tener la forma https://xxxx.supabase.co.'
  } else if (/permission denied/i.test(raw)) {
    reason =
      'el servidor no tiene permiso sobre las tablas. Aplica las migraciones de supabase/migrations y revisa que NUXT_SUPABASE_SECRET_KEY sea la clave secreta, no la pública.'
  } else if (/does not exist|could not find the table|schema cache/i.test(raw)) {
    reason = 'faltan las tablas. Aplica las migraciones de supabase/migrations.'
  } else if (/invalid api key|jwt/i.test(raw)) {
    reason = 'la clave no es válida. Revisa NUXT_SUPABASE_SECRET_KEY.'
  }
  throw createError({ statusCode: 500, message: `Supabase no pudo ${action}: ${reason}` })
}

const toChannel = (r: any): Channel => ({
  id: r.id,
  title: r.title,
  handle: r.handle,
  thumbnailUrl: r.thumbnail_url,
  subscriberCount: r.subscriber_count,
  viewCount: r.view_count ?? null,
  videoCount: r.video_count ?? null,
  lastSyncedAt: r.last_synced_at,
  isMine: r.is_mine ?? false,
})

const toVideo = (r: any): Video => ({
  id: r.id,
  channelId: r.channel_id,
  title: r.title,
  thumbnailUrl: r.thumbnail_url,
  publishedAt: r.published_at,
  durationSeconds: r.duration_seconds,
  isShort: r.is_short,
  categoryId: r.category_id ?? null,
  views: Number(r.views),
  likes: r.likes === null ? null : Number(r.likes),
  comments: r.comments === null ? null : Number(r.comments),
  fetchedAt: r.updated_at,
})

/** Columnas de un video sin la copia de su miniatura, que pesa y solo se usa al detectar cambios. */
const VIDEO_COLUMNS =
  'id, channel_id, title, thumbnail_url, published_at, duration_seconds, is_short, category_id, views, likes, comments, updated_at'

export async function dbListChannels(): Promise<Channel[]> {
  const { data, error } = await db().from('channels').select('*').order('title')
  check(error, 'leer los canales')
  return (data ?? []).map(toChannel)
}

/** Guarda o refresca un canal y deja una foto diaria de sus cifras. */
export async function dbSaveChannel(channel: Channel): Promise<void> {
  const { error } = await db().from('channels').upsert({
    id: channel.id,
    title: channel.title,
    handle: channel.handle,
    thumbnail_url: channel.thumbnailUrl,
    subscriber_count: channel.subscriberCount,
    view_count: channel.viewCount,
    video_count: channel.videoCount,
  })
  check(error, 'guardar el canal')

  const { error: snapError } = await db()
    .from('channel_snapshots')
    .upsert(
      {
        channel_id: channel.id,
        captured_on: new Date().toISOString().slice(0, 10),
        subscriber_count: channel.subscriberCount,
        view_count: channel.viewCount,
        video_count: channel.videoCount,
      },
      { onConflict: 'channel_id,captured_on' },
    )
  check(snapError, 'guardar el historial del canal')
}

/**
 * La lectura de vistas más reciente de cada video anterior a hoy.
 * Comparada con las vistas actuales da el ritmo real de las últimas horas.
 */
export async function dbListPreviousReadings(): Promise<Map<string, PreviousReading>> {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const since = new Date(now.getTime() - 4 * 86_400_000).toISOString().slice(0, 10)

  const readings = new Map<string, PreviousReading>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from('video_snapshots')
      .select('video_id, captured_on, captured_at, views')
      .gte('captured_on', since)
      .lt('captured_on', today)
      .order('captured_on')
      .order('video_id')
      .range(from, from + PAGE - 1)
    check(error, 'leer el historial de vistas')
    // Vienen de la más antigua a la más nueva: la última de cada video gana.
    for (const row of data ?? []) {
      readings.set(row.video_id, {
        views: Number(row.views),
        at: row.captured_at ?? `${row.captured_on}T12:00:00Z`,
      })
    }
    if (!data || data.length < PAGE) break
  }
  return readings
}

/** Marca o desmarca un canal como tuyo. */
export async function dbSetChannelMine(id: string, mine: boolean): Promise<void> {
  const { error } = await db().from('channels').update({ is_mine: mine }).eq('id', id)
  check(error, 'marcar el canal')
}

/** Fotos diarias de suscriptores y vistas de unos canales, de la más antigua a la más nueva. */
export async function dbListChannelSnapshots(ids: string[]): Promise<Map<string, ChannelSnapshot[]>> {
  const byChannel = new Map<string, ChannelSnapshot[]>(ids.map((id) => [id, []]))
  if (ids.length === 0) return byChannel
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from('channel_snapshots')
      .select('channel_id, captured_on, subscriber_count, view_count')
      .in('channel_id', ids)
      .order('captured_on')
      .range(from, from + PAGE - 1)
    check(error, 'leer el historial de los canales')
    for (const r of data ?? []) {
      byChannel.get(r.channel_id)?.push({
        date: r.captured_on,
        subscriberCount: r.subscriber_count === null ? null : Number(r.subscriber_count),
        viewCount: r.view_count === null ? null : Number(r.view_count),
      })
    }
    if (!data || data.length < PAGE) break
  }
  return byChannel
}

export async function dbDeleteChannel(id: string): Promise<void> {
  // Los videos y snapshots del canal se borran en cascada.
  const { error } = await db().from('channels').delete().eq('id', id)
  check(error, 'quitar el canal')
}

/** Videos guardados de un solo canal. */
export async function dbListChannelVideos(channelId: string): Promise<Video[]> {
  const { data, error } = await db().from('videos').select(VIDEO_COLUMNS).eq('channel_id', channelId)
  check(error, 'leer los videos del canal')
  return (data ?? []).map(toVideo)
}

export async function dbListVideos(): Promise<Video[]> {
  // Supabase devuelve máximo 1000 filas por consulta, así que se pagina.
  const rows: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from('videos')
      .select(VIDEO_COLUMNS)
      .order('id')
      .range(from, from + PAGE - 1)
    check(error, 'leer los videos')
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return rows.map(toVideo)
}

/** Guarda los videos de un canal y deja una foto diaria de sus vistas para el historial. */
export async function dbSaveChannelVideos(channelId: string, videos: Video[]): Promise<void> {
  const now = new Date()
  const nowIso = now.toISOString()

  if (videos.length > 0) {
    const { error } = await db()
      .from('videos')
      .upsert(
        videos.map((v) => ({
          id: v.id,
          channel_id: v.channelId,
          title: v.title,
          thumbnail_url: v.thumbnailUrl,
          published_at: v.publishedAt,
          duration_seconds: v.durationSeconds,
          is_short: v.isShort,
          category_id: v.categoryId,
          views: v.views,
          likes: v.likes,
          comments: v.comments,
          updated_at: nowIso,
        })),
      )
    check(error, 'guardar los videos')

    const { error: snapError } = await db()
      .from('video_snapshots')
      .upsert(
        videos.map((v) => ({ video_id: v.id, captured_on: nowIso.slice(0, 10), captured_at: nowIso, views: v.views })),
        { onConflict: 'video_id,captured_on' },
      )
    check(snapError, 'guardar el historial de vistas')
  }

  const cutoff = new Date(now.getTime() - STALE_AFTER_DAYS * 86_400_000).toISOString()
  const { error: staleError } = await db().from('videos').delete().eq('channel_id', channelId).lt('updated_at', cutoff)
  check(staleError, 'limpiar videos antiguos')

  const { error: syncError } = await db().from('channels').update({ last_synced_at: nowIso }).eq('id', channelId)
  check(syncError, 'marcar el canal como actualizado')
}

// Temas (tendencias)

export interface TopicResults {
  channels: Channel[]
  videos: ScoredVideo[]
}

const toTopic = (r: any): Topic => ({
  id: r.id,
  query: r.query,
  categoryId: r.category_id,
  language: r.language,
  days: r.days,
  fetchedAt: r.fetched_at,
})

/** Últimos videos largos de cada canal encontrado en un tema, por canal. */
export type TopicContext = Record<string, Video[]>

const TOPIC_COLUMNS = 'id, query, category_id, language, days, results, fetched_at, created_at'

/** Temas con sus resultados guardados, del más antiguo al más nuevo. */
export async function dbListTopics(): Promise<(Topic & { results: TopicResults | null })[]> {
  const { data, error } = await db().from('topics').select(TOPIC_COLUMNS).order('created_at')
  check(error, 'leer los temas')
  return (data ?? []).map((r) => ({ ...toTopic(r), results: r.results ?? null }))
}

export async function dbGetTopic(id: string): Promise<Topic | null> {
  const { data, error } = await db()
    .from('topics')
    .select('id, query, category_id, language, days, fetched_at')
    .eq('id', id)
    .maybeSingle()
  check(error, 'leer el tema')
  return data ? toTopic(data) : null
}

export async function dbCreateTopic(topic: Omit<Topic, 'id' | 'fetchedAt'>): Promise<Topic> {
  const { data, error } = await db()
    .from('topics')
    .upsert(
      { query: topic.query, category_id: topic.categoryId, language: topic.language, days: topic.days },
      { onConflict: 'query,category_id,language' },
    )
    .select('id, query, category_id, language, days, fetched_at')
    .single()
  check(error, 'guardar el tema')
  return toTopic(data)
}

export async function dbSaveTopicResults(id: string, results: TopicResults, context: TopicContext): Promise<void> {
  const { error } = await db()
    .from('topics')
    .update({ results, context, fetched_at: new Date().toISOString() })
    .eq('id', id)
  check(error, 'guardar los resultados del tema')
}

/** Los videos de referencia de un canal en el primer tema que lo tenga. */
export async function dbFindTopicContext(channelId: string): Promise<Video[]> {
  const { data, error } = await db().from('topics').select('context').order('created_at')
  check(error, 'leer los videos de referencia de los temas')
  for (const row of data ?? []) {
    const videos = (row.context as TopicContext | null)?.[channelId]
    if (videos?.length) return videos
  }
  return []
}

/** Guarda (o reemplaza) la foto de hoy del impulso de un tema. */
export async function dbSaveTopicSnapshot(topicId: string, point: Omit<MomentumPoint, 'date'>): Promise<void> {
  const { error } = await db()
    .from('topic_snapshots')
    .upsert(
      { topic_id: topicId, captured_on: new Date().toISOString().slice(0, 10), ...point },
      { onConflict: 'topic_id,captured_on' },
    )
  check(error, 'guardar el impulso del tema')
}

/** Fotos del impulso de cada tema desde una fecha, de la más antigua a la más nueva. */
export async function dbListTopicSnapshots(since: string): Promise<Map<string, MomentumPoint[]>> {
  const byTopic = new Map<string, MomentumPoint[]>()
  const { data, error } = await db()
    .from('topic_snapshots')
    .select('topic_id, captured_on, momentum, outliers, videos')
    .gte('captured_on', since)
    .order('captured_on')
  check(error, 'leer el impulso de los temas')
  for (const r of data ?? []) {
    const list = byTopic.get(r.topic_id) ?? []
    list.push({ date: r.captured_on, momentum: Number(r.momentum), outliers: Number(r.outliers), videos: Number(r.videos) })
    byTopic.set(r.topic_id, list)
  }
  return byTopic
}

export async function dbDeleteTopic(id: string): Promise<void> {
  const { error } = await db().from('topics').delete().eq('id', id)
  check(error, 'quitar el tema')
}

// Extensión del navegador

/** Lo normal de varios canales ya calculado, en los dos formatos. */
export async function dbListBaselines(channelIds: string[]): Promise<Baseline[]> {
  if (channelIds.length === 0) return []
  const { data, error } = await db()
    .from('channel_baselines')
    .select('channel_id, is_short, median_views, sample, computed_at')
    .in('channel_id', channelIds)
  check(error, 'leer las referencias de los canales')
  return (data ?? []).map((r) => ({
    channelId: r.channel_id,
    short: r.is_short,
    median: r.median_views === null ? null : Number(r.median_views),
    sample: r.sample,
    computedAt: r.computed_at,
  }))
}

export async function dbSaveBaselines(baselines: Baseline[]): Promise<void> {
  if (baselines.length === 0) return
  const { error } = await db()
    .from('channel_baselines')
    .upsert(
      baselines.map((b) => ({
        channel_id: b.channelId,
        is_short: b.short,
        median_views: b.median,
        sample: b.sample,
        computed_at: b.computedAt,
      })),
    )
  check(error, 'guardar las referencias de los canales')
}

// Guardados

export interface SavedVideo {
  video: ScoredVideo
  channel: Channel | null
  savedAt: string
  collectionId: string | null
}

export interface Collection {
  id: string
  name: string
}

export async function dbListSaved(): Promise<SavedVideo[]> {
  const { data, error } = await db()
    .from('saved_videos')
    .select('video, channel, saved_at, collection_id')
    .order('saved_at', { ascending: false })
  check(error, 'leer los guardados')
  return (data ?? []).map((r) => ({
    video: r.video as ScoredVideo,
    channel: (r.channel as Channel | null) ?? null,
    savedAt: r.saved_at,
    collectionId: r.collection_id ?? null,
  }))
}

export async function dbListCollections(): Promise<Collection[]> {
  const { data, error } = await db().from('collections').select('id, name').order('name')
  check(error, 'leer las colecciones')
  return data ?? []
}

export async function dbCreateCollection(name: string): Promise<Collection> {
  const { data, error } = await db().from('collections').insert({ name }).select('id, name').single()
  if (error && /duplicate|unique/i.test(error.message)) {
    throw createError({ statusCode: 409, message: `Ya tienes una colección llamada “${name}”.` })
  }
  check(error, 'crear la colección')
  return data as Collection
}

export async function dbDeleteCollection(id: string): Promise<void> {
  // Sus videos siguen en Guardados, sin colección.
  const { error } = await db().from('collections').delete().eq('id', id)
  check(error, 'eliminar la colección')
}

export async function dbSetSavedCollection(videoId: string, collectionId: string | null): Promise<void> {
  const { error } = await db().from('saved_videos').update({ collection_id: collectionId }).eq('video_id', videoId)
  check(error, 'mover el video de colección')
}

export async function dbIsSaved(videoId: string): Promise<boolean> {
  const { data, error } = await db().from('saved_videos').select('video_id').eq('video_id', videoId).maybeSingle()
  check(error, 'leer los guardados')
  return data !== null
}

export async function dbSaveVideo(video: ScoredVideo, channel: Channel | null): Promise<void> {
  const { error } = await db().from('saved_videos').upsert({ video_id: video.id, video, channel, saved_at: new Date().toISOString() })
  check(error, 'guardar el video')
}

export async function dbUnsaveVideo(videoId: string): Promise<void> {
  const { error } = await db().from('saved_videos').delete().eq('video_id', videoId)
  check(error, 'quitar el video de guardados')
}

// Historial de cambios de título y miniatura

/** Título y huella de miniatura guardados de unos videos. */
export async function dbListVideoMarks(ids: string[]): Promise<Map<string, VideoMark>> {
  const marks = new Map<string, VideoMark>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db()
      .from('videos')
      .select('id, title, thumb_hash, thumb_data')
      .in('id', ids.slice(i, i + 200))
    check(error, 'leer los títulos guardados')
    for (const r of data ?? []) marks.set(r.id, { title: r.title, thumbHash: r.thumb_hash ?? null, thumbData: r.thumb_data ?? null })
  }
  return marks
}

/** Guarda la huella y la copia de la miniatura actual de los videos revisados. */
export async function dbSaveThumbs(videos: Video[], thumbs: Map<string, { hash: string; data: string }>): Promise<void> {
  const rows = videos
    .filter((v) => thumbs.has(v.id))
    .map((v) => ({
      id: v.id,
      channel_id: v.channelId,
      title: v.title,
      published_at: v.publishedAt,
      thumb_hash: thumbs.get(v.id)!.hash,
      thumb_data: thumbs.get(v.id)!.data,
    }))
  if (rows.length === 0) return
  const { error } = await db().from('videos').upsert(rows)
  check(error, 'guardar las miniaturas')
}

export async function dbSaveVideoChanges(changes: VideoChange[]): Promise<void> {
  if (changes.length === 0) return
  const { error } = await db()
    .from('video_changes')
    .insert(changes.map((c) => ({ video_id: c.videoId, kind: c.kind, before: c.before, after: c.after, changed_at: c.changedAt })))
  check(error, 'guardar los cambios de los videos')
}

/** Qué videos cambiaron en los últimos días y cuándo, sin las imágenes (para marcar las filas). */
export async function dbListRecentChanges(days = 90): Promise<Record<string, { kind: ChangeKind; at: string }[]>> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await db()
    .from('video_changes')
    .select('video_id, kind, changed_at')
    .gte('changed_at', since)
    .order('changed_at', { ascending: false })
    .limit(2000)
  check(error, 'leer los cambios de los videos')
  const out: Record<string, { kind: ChangeKind; at: string }[]> = {}
  for (const r of data ?? []) (out[r.video_id] ??= []).push({ kind: r.kind, at: r.changed_at })
  return out
}

/** Todos los cambios de un video, del más reciente al más antiguo, con las miniaturas. */
export async function dbListVideoChanges(videoId: string): Promise<VideoChange[]> {
  const { data, error } = await db()
    .from('video_changes')
    .select('video_id, kind, before, after, changed_at')
    .eq('video_id', videoId)
    .order('changed_at', { ascending: false })
  check(error, 'leer los cambios del video')
  return (data ?? []).map((r) => ({ videoId: r.video_id, kind: r.kind, before: r.before, after: r.after, changedAt: r.changed_at }))
}
