// Lógica pura de la extensión del navegador: qué videos pide, cómo se calcula lo normal de un canal
// y cuánto dura esa referencia guardada. Se prueba sola, sin Nuxt.

import { median, MIN_BASELINE_AGE_DAYS, MIN_BASELINE_VIDEOS, type Video } from './outliers'

/** Videos que la extensión puede pedir de una vez: los que caben en una consulta de YouTube. */
export const MAX_EXT_VIDEOS = 50
/** Lo normal de un canal se recalcula una vez al día; entre tanto se reutiliza sin gastar cuota. */
export const BASELINE_TTL_HOURS = 24

const DAY_MS = 86_400_000
const VIDEO_ID = /^[\w-]{11}$/

export interface VideoRequest {
  id: string
  /** El video aparece como Short en la página (enlace /shorts/). Se compara con los Shorts del canal. */
  short: boolean
}

export interface ExtScore {
  id: string
  channelId: string
  short: boolean
  views: number
  /** Vistas normales del canal en ese formato. null si el canal tiene muy pocos videos para saberlo. */
  baseline: number | null
  score: number | null
}

export interface Baseline {
  channelId: string
  short: boolean
  median: number | null
  sample: number
  computedAt: string
}

/** Lee y limpia lo que manda la extensión: IDs válidos, sin repetir, como máximo MAX_EXT_VIDEOS. */
export function parseVideoRequests(body: unknown): VideoRequest[] {
  const list = Array.isArray((body as any)?.videos) ? (body as any).videos : []
  const seen = new Set<string>()
  const out: VideoRequest[] = []
  for (const item of list) {
    const id = typeof item?.id === 'string' ? item.id : ''
    if (!VIDEO_ID.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push({ id, short: item.short === true })
    if (out.length === MAX_EXT_VIDEOS) break
  }
  return out
}

export const baselineKey = (channelId: string, short: boolean) => `${channelId}|${short ? 's' : 'l'}`

/**
 * Lo normal de un canal en un formato: la mediana de sus videos de ese formato con al menos
 * MIN_BASELINE_AGE_DAYS días. Con menos de MIN_BASELINE_VIDEOS videos no se calcula.
 * Son las mismas reglas que usa la app para el score.
 */
export function channelBaseline(videos: Video[], short: boolean, now: Date = new Date()): { median: number | null; sample: number } {
  const views = videos
    .filter((v) => v.isShort === short)
    .filter((v) => (now.getTime() - new Date(v.publishedAt).getTime()) / DAY_MS >= MIN_BASELINE_AGE_DAYS)
    .map((v) => v.views)
  return { median: views.length >= MIN_BASELINE_VIDEOS ? median(views) : null, sample: views.length }
}

export function isBaselineFresh(computedAt: string, now: Date = new Date()): boolean {
  const age = now.getTime() - new Date(computedAt).getTime()
  return age >= 0 && age < BASELINE_TTL_HOURS * 3_600_000
}

export function scoreAgainst(views: number, baseline: number | null): number | null {
  return baseline && baseline > 0 ? views / baseline : null
}

/** Puntajes inventados pero estables por ID, para probar la extensión contra la app en modo demo. */
export function demoScores(requests: VideoRequest[]): ExtScore[] {
  return requests.map(({ id, short }) => {
    let h = 2166136261
    for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    const r = (h >>> 0) / 4294967296
    // La mayoría cerca de lo normal, algunos muy por encima: como en YouTube.
    const score = Math.round((r < 0.7 ? 0.3 + r * 1.6 : r < 0.92 ? 1.5 + (r - 0.7) * 20 : 6 + (r - 0.92) * 150) * 10) / 10
    const baseline = 10_000 + Math.round(r * 90_000)
    return { id, channelId: 'demo', short, views: Math.round(score * baseline), baseline, score }
  })
}

/** Etiquetas de ejemplo para el modo demo. */
export function demoTags(id: string): string[] {
  const pool = ['obs studio', 'streaming', 'tutorial obs', 'plugins obs', 'configurar obs', 'directo', 'kick', 'twitch', 'stream deck', 'overlay']
  const start = id.charCodeAt(0) % pool.length
  return Array.from({ length: 6 }, (_, i) => pool[(start + i) % pool.length]!)
}
