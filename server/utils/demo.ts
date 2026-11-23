import type { Channel, Video } from '~~/shared/outliers'

// Datos de ejemplo para probar la app sin claves. Los canales son inventados.

const CHANNELS = [
  { title: 'Código en Pijama', handle: '@codigoenpijama', subs: 48_200, typical: 9_000 },
  { title: 'Pixel Forja', handle: '@pixelforja', subs: 212_000, typical: 41_000 },
  { title: 'Taller de Directos', handle: '@tallerdedirectos', subs: 12_900, typical: 2_600 },
  { title: 'La Terminal de Nico', handle: '@laterminaldenico', subs: 631_000, typical: 118_000 },
  { title: 'Byte a Byte', handle: '@byteabyte', subs: 87_400, typical: 15_500 },
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
      lastSyncedAt: now.toISOString(),
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
