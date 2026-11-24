import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import type { Channel, Video } from '~~/shared/outliers'

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
  lastSyncedAt: r.last_synced_at,
})

const toVideo = (r: any): Video => ({
  id: r.id,
  channelId: r.channel_id,
  title: r.title,
  thumbnailUrl: r.thumbnail_url,
  publishedAt: r.published_at,
  durationSeconds: r.duration_seconds,
  isShort: r.is_short,
  views: Number(r.views),
  likes: r.likes === null ? null : Number(r.likes),
  comments: r.comments === null ? null : Number(r.comments),
})

export async function dbListChannels(): Promise<Channel[]> {
  const { data, error } = await db().from('channels').select('*').order('title')
  check(error, 'leer los canales')
  return (data ?? []).map(toChannel)
}

export async function dbSaveChannel(channel: Channel): Promise<void> {
  const { error } = await db().from('channels').upsert({
    id: channel.id,
    title: channel.title,
    handle: channel.handle,
    thumbnail_url: channel.thumbnailUrl,
    subscriber_count: channel.subscriberCount,
  })
  check(error, 'guardar el canal')
}

export async function dbDeleteChannel(id: string): Promise<void> {
  // Los videos y snapshots del canal se borran en cascada.
  const { error } = await db().from('channels').delete().eq('id', id)
  check(error, 'quitar el canal')
}

export async function dbListVideos(): Promise<Video[]> {
  // Supabase devuelve máximo 1000 filas por consulta, así que se pagina.
  const rows: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from('videos')
      .select('*')
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
        videos.map((v) => ({ video_id: v.id, captured_on: nowIso.slice(0, 10), views: v.views })),
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
