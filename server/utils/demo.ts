import type { ChangeKind, VideoChange } from '~~/shared/changes'
import type { ChannelSnapshot } from '~~/shared/achievements'
import { topicMomentum, type MomentumPoint } from '~~/shared/home'
import { scoreVideos, type Channel, type ScoredVideo, type Topic, type Video } from '~~/shared/outliers'

// Datos de ejemplo para probar la app sin claves. Los canales son inventados.

const CHANNELS = [
  { title: 'Código en Pijama', handle: '@codigoenpijama', subs: 48_200, typical: 9_000, category: '28' },
  { title: 'Pixel Forja', handle: '@pixelforja', subs: 212_000, typical: 41_000, category: '20' },
  { title: 'Taller de Directos', handle: '@tallerdedirectos', subs: 12_900, typical: 2_600, category: '26' },
  { title: 'La Terminal de Nico', handle: '@laterminaldenico', subs: 631_000, typical: 118_000, category: '28' },
  { title: 'Byte a Byte', handle: '@byteabyte', subs: 87_400, typical: 15_500, category: '27' },
]

const TOPICS = [
  'OBS Studio', 'Vue 3', 'un plugin de OBS', 'Claude Code', 'tu primer overlay', 'Supabase', 'un Stream Deck casero',
  'el multistream', 'TypeScript', 'tu setup de streaming', 'las alertas del stream', 'DaVinci Resolve', 'Nuxt',
  'un bot de Discord', 'la tarjeta de sonido', 'los agentes de IA',
]
const FORMATS = [
  'Cómo configurar {t} desde cero',
  'Probé {t} durante 30 días',
  '7 errores que cometes con {t}',
  'Lo que nadie te cuenta de {t}',
  '{t}: guía completa',
  'Dejé de usar {t} y esto pasó',
  'Arreglé {t} en 10 minutos',
  '¿Vale la pena {t}?',
]
const SHORT_FORMATS = ['El truco de {t} que no conocías', '{t} en 40 segundos', 'No hagas esto con {t}']

/** Generador con semilla: los mismos datos en cada carga. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function demoData(now: Date = new Date()): { channels: Channel[]; videos: Video[] } {
  const rand = seeded(20261123)
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)]!
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const channels: Channel[] = []
  const videos: Video[] = []

  CHANNELS.forEach((c, ci) => {
    const channelId = `demo-canal-${ci + 1}`
    channels.push({
      id: channelId,
      title: c.title,
      handle: c.handle,
      thumbnailUrl: null,
      subscriberCount: c.subs,
      viewCount: c.typical * 400,
      videoCount: 180,
      lastSyncedAt: now.toISOString(),
      // En la demo, el primer canal es "el tuyo": así Inicio muestra sus logros.
      isMine: ci === 0,
    })

    const make = (index: number, isShort: boolean) => {
      const ageDays = 0.4 + rand() * (isShort ? 150 : 320)
      const typical = isShort ? c.typical * 1.8 : c.typical
      // La mayoría ronda lo normal; de vez en cuando uno se dispara.
      const breakout = rand() < 0.07 ? 3 + rand() * rand() * 22 : 1
      const ramp = Math.min(1, 0.25 + ageDays / 6)
      const views = Math.round(typical * Math.exp(normal() * 0.45) * breakout * ramp)
      videos.push({
        id: `${channelId}-${isShort ? 's' : 'v'}${index}`,
        channelId,
        title: capitalize(pick(isShort ? SHORT_FORMATS : FORMATS).replace('{t}', pick(TOPICS))),
        thumbnailUrl: null,
        publishedAt: new Date(now.getTime() - ageDays * 86_400_000).toISOString(),
        durationSeconds: isShort ? 20 + Math.floor(rand() * 40) : 300 + Math.floor(rand() * 1500),
        isShort,
        categoryId: c.category,
        views,
        likes: Math.round(views * (0.03 + rand() * 0.03)),
        comments: Math.round(views * (0.002 + rand() * 0.004)),
      })
    }

    for (let i = 0; i < 34; i++) make(i, false)
    for (let i = 0; i < 14; i++) make(i, true)
  })

  return { channels, videos }
}

const DAY = 86_400_000
const day = (now: Date, daysAgo: number) => new Date(now.getTime() - daysAgo * DAY).toISOString().slice(0, 10)

/** Fotos semanales del canal tuyo de la demo durante un año, para fechar sus hitos. */
export function demoHistory(now: Date = new Date()): Record<string, ChannelSnapshot[]> {
  const { channels } = demoData(now)
  const mine = channels.find((c) => c.isMine)!
  const weeks = 52
  const grow = (from: number, to: number, k: number) => Math.round(to * (from / to) ** (k / weeks))
  const history: ChannelSnapshot[] = []
  for (let k = weeks; k >= 0; k--) {
    history.push({
      date: day(now, k * 7),
      subscriberCount: grow(3_100, mine.subscriberCount!, k),
      viewCount: grow(410_000, mine.viewCount!, k),
    })
  }
  return { [mine.id]: history }
}

// Temas de la demo: resultados guardados con canales seguidos y canales que no sigues.

const EXTRA_CHANNELS = [
  { title: 'Overlay Lab', handle: '@overlaylab', subs: 9_800, typical: 2_100, category: '26' },
  { title: 'Estudio Nébula', handle: '@estudionebula', subs: 36_500, typical: 7_200, category: '28' },
  { title: 'Directo al Grano', handle: '@directoalgrano', subs: 64_000, typical: 11_000, category: '28' },
  { title: 'Clip y Corte', handle: '@clipycorte', subs: 1_240_000, typical: 160_000, category: '24' },
  { title: 'Mesa de Mezcla', handle: '@mesademezcla', subs: 21_700, typical: 4_000, category: '28' },
]

interface DemoTopic {
  query: string
  titles: string[]
  /** Canales que sigues (índice en CHANNELS) cuyos videos de 30 días entran en el tema. */
  followed: number[]
  /** Canales que no sigues (índice en EXTRA_CHANNELS) y cuánto rindieron sus tres videos del tema. */
  extra: [number, number[]][]
  /** Forma de los últimos 14 días: el impulso de hace 13 días respecto al de hoy, y el de hace 7. */
  shape: [number, number]
}

const DEMO_TOPICS: DemoTopic[] = [
  {
    query: 'plugins de OBS',
    titles: [
      'El plugin de OBS que cambió mis directos',
      'Probé 5 plugins de OBS gratis',
      'Plugins de OBS que todo streamer necesita',
      'Cómo instalar plugins en OBS sin romper nada',
      'Este plugin de OBS reemplaza a StreamFX',
      'Mi plugin de OBS favorito de 2026',
    ],
    followed: [0, 2],
    extra: [[0, [6.4, 2.6, 1.1]], [1, [3.1, 0.9, 1.4]], [2, [2.2, 1.0, 0.8]]],
    shape: [0.55, 0.74],
  },
  {
    query: 'edición en DaVinci',
    titles: [
      'Edita el doble de rápido en DaVinci Resolve',
      'DaVinci Resolve: el atajo que nadie usa',
      'Mi flujo de edición en DaVinci Resolve',
      'Corrección de color en DaVinci en 10 minutos',
      'Dejé Premiere por DaVinci Resolve',
      'Edición en DaVinci para principiantes',
    ],
    followed: [1],
    extra: [[3, [4.8, 1.3, 0.7]], [4, [2.9, 2.1, 1.0]], [1, [1.6, 0.8, 1.2]]],
    shape: [1.3, 1.14],
  },
]

export interface DemoTopicData extends Topic {
  results: { channels: Channel[]; videos: ScoredVideo[] }
  /** Videos largos de cada canal del tema, para analizar un resultado. */
  context: Record<string, ScoredVideo[]>
  momentum: MomentumPoint[]
}

/** Dos temas con resultados y 14 días de impulso. Usa su propia semilla: no altera los canales de la demo. */
export function demoTopics(now: Date = new Date()): DemoTopicData[] {
  const rand = seeded(20261124)
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
  const base = demoData(now)
  const followedScored = scoreVideos(base.videos, now)

  // Canales que no sigues: unos 20 videos largos de los últimos meses más los de cada tema.
  const extraChannels: Channel[] = EXTRA_CHANNELS.map((c, i) => ({
    id: `demo-extra-${i + 1}`,
    title: c.title,
    handle: c.handle,
    thumbnailUrl: null,
    subscriberCount: c.subs,
    viewCount: c.typical * 300,
    videoCount: 140,
    lastSyncedAt: null,
    isMine: false,
  }))
  const extraVideos = new Map<string, Video[]>(extraChannels.map((c) => [c.id, []]))
  const makeVideo = (ci: number, title: string, ageDays: number, breakout: number, id: string) => {
    const c = EXTRA_CHANNELS[ci]!
    const ramp = Math.min(1, 0.25 + ageDays / 6)
    const views = Math.round(c.typical * Math.exp(normal() * 0.3) * breakout * ramp)
    const video: Video = {
      id,
      channelId: extraChannels[ci]!.id,
      title,
      thumbnailUrl: null,
      publishedAt: new Date(now.getTime() - ageDays * DAY).toISOString(),
      durationSeconds: 360 + Math.floor(rand() * 1200),
      isShort: false,
      categoryId: c.category,
      views,
      likes: Math.round(views * (0.03 + rand() * 0.03)),
      comments: Math.round(views * (0.002 + rand() * 0.004)),
    }
    extraVideos.get(video.channelId)!.push(video)
    return video
  }
  EXTRA_CHANNELS.forEach((_, ci) => {
    for (let i = 0; i < 20; i++) {
      const title = FORMATS[Math.floor(rand() * FORMATS.length)]!.replace('{t}', TOPICS[Math.floor(rand() * TOPICS.length)]!)
      makeVideo(ci, title.charAt(0).toUpperCase() + title.slice(1), 32 + rand() * 230, 1, `demo-extra-${ci + 1}-v${i}`)
    }
  })
  const resultIds = DEMO_TOPICS.map((t, ti) =>
    t.extra.flatMap(([ci, breakouts], k) =>
      breakouts.map((b, j) => makeVideo(ci, t.titles[(k * 2 + j) % t.titles.length]!, 2 + rand() * 26, b, `demo-tema-${ti + 1}-${ci}-${j}`).id),
    ),
  )
  const extraScored = scoreVideos([...extraVideos.values()].flat(), now)

  return DEMO_TOPICS.map((t, ti) => {
    const ids = new Set(resultIds[ti])
    const fromFollowed = followedScored.filter(
      (v) => !v.isShort && v.ageDays <= 30 && t.followed.some((i) => v.channelId === `demo-canal-${i + 1}`),
    )
    const videos = [...fromFollowed, ...extraScored.filter((v) => ids.has(v.id))]
    const channelIds = new Set(videos.map((v) => v.channelId))
    const channels = [...base.channels, ...extraChannels].filter((c) => channelIds.has(c.id))
    const context: Record<string, ScoredVideo[]> = {}
    for (const v of extraScored) if (channelIds.has(v.channelId)) (context[v.channelId] ??= []).push({ ...v, thumbnailUrl: null })

    // Impulso: el de hoy sale de los resultados; los días anteriores siguen la forma del tema.
    const today = topicMomentum(videos)
    const [start, mid] = t.shape
    const momentum: MomentumPoint[] = []
    for (let k = 13; k >= 0; k--) {
      const f = k >= 7 ? start + ((mid - start) * (13 - k)) / 6 : mid + ((1 - mid) * (7 - k)) / 7
      const wobble = k === 0 || k === 7 ? 1 : 1 + (rand() - 0.5) * 0.08
      momentum.push({ date: day(now, k), momentum: today.momentum * f * wobble, outliers: today.outliers, videos: today.videos })
    }

    return {
      id: `demo-tema-${ti + 1}`,
      query: t.query,
      categoryId: '',
      language: 'es',
      days: 30,
      fetchedAt: new Date(now.getTime() - 3 * 3_600_000).toISOString(),
      results: { channels, videos },
      context,
      momentum,
    }
  })
}

// Cambios de título y miniatura de ejemplo: dos videos recientes de los canales demo.

function demoChangedVideos(now: Date = new Date()) {
  // Dos outliers recientes, para que se vean con los filtros de partida.
  const recent = scoreVideos(demoData(now).videos, now)
    .filter((v) => !v.isShort && v.ageDays < 85 && (v.score ?? 0) >= 2)
    .sort((a, b) => b.score! - a.score!)
  return { title: recent[0], thumbnail: recent[1] }
}

const demoThumb = (hue: number, label: string) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 35%)"/><stop offset="1" stop-color="hsl(${hue + 40} 50% 14%)"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><text x="20" y="150" font-family="Arial Black,Arial" font-weight="900" font-size="30" fill="#fff">${label}</text></svg>`,
  ).toString('base64')}`

export function demoChanges(videos: Video[], now: Date = new Date()): Record<string, { kind: ChangeKind; at: string }[]> {
  const { title, thumbnail } = demoChangedVideos(now)
  const out: Record<string, { kind: ChangeKind; at: string }[]> = {}
  const ids = new Set(videos.map((v) => v.id))
  if (title && ids.has(title.id)) out[title.id] = [{ kind: 'title', at: new Date(now.getTime() - 3 * 86_400_000).toISOString() }]
  if (thumbnail && ids.has(thumbnail.id)) out[thumbnail.id] = [{ kind: 'thumbnail', at: new Date(now.getTime() - 5 * 86_400_000).toISOString() }]
  return out
}

export function demoVideoChanges(id: string, now: Date = new Date()): VideoChange[] {
  const { title, thumbnail } = demoChangedVideos(now)
  if (title?.id === id) {
    return [{ videoId: id, kind: 'title', before: 'Mi experiencia después de un mes', after: title.title, changedAt: new Date(now.getTime() - 3 * 86_400_000).toISOString() }]
  }
  if (thumbnail?.id === id) {
    return [{ videoId: id, kind: 'thumbnail', before: demoThumb(220, 'ANTES'), after: demoThumb(10, 'AHORA'), changedAt: new Date(now.getTime() - 5 * 86_400_000).toISOString() }]
  }
  return []
}
