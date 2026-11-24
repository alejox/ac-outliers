import { describe, expect, it } from 'vitest'
import { median, parseIsoDuration, scoreVideos, type Video } from '../shared/outliers'
import { parseChannelInput } from '../shared/channel-input'

const NOW = new Date('2026-11-23T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

function video(over: Partial<Video>): Video {
  return {
    id: Math.random().toString(36).slice(2),
    channelId: 'c1',
    title: 't',
    thumbnailUrl: null,
    publishedAt: daysAgo(30),
    durationSeconds: 600,
    isShort: false,
    categoryId: null,
    views: 1000,
    likes: null,
    comments: null,
    ...over,
  }
}

describe('median', () => {
  it('maneja listas pares, impares y vacías', () => {
    expect(median([])).toBeNull()
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('parseIsoDuration', () => {
  it('convierte duraciones de YouTube a segundos', () => {
    expect(parseIsoDuration('PT45S')).toBe(45)
    expect(parseIsoDuration('PT12M3S')).toBe(723)
    expect(parseIsoDuration('PT1H')).toBe(3600)
    expect(parseIsoDuration('P1DT1H1M1S')).toBe(90061)
    expect(parseIsoDuration('P0D')).toBe(0)
    expect(parseIsoDuration('basura')).toBe(0)
  })
})

describe('scoreVideos', () => {
  it('puntúa contra la mediana del canal', () => {
    const vids = [1000, 1000, 1000, 1000, 1000, 1000, 8000].map((views) => video({ views }))
    const scored = scoreVideos(vids, NOW)
    expect(scored[6]!.baseline).toBe(1000)
    expect(scored[6]!.score).toBe(8)
    expect(scored[0]!.score).toBe(1)
  })

  it('no mezcla Shorts con videos largos ni canales entre sí', () => {
    const vids = [
      ...Array.from({ length: 5 }, () => video({ views: 1000 })),
      ...Array.from({ length: 5 }, () => video({ views: 50_000, isShort: true })),
      ...Array.from({ length: 5 }, () => video({ views: 200, channelId: 'c2' })),
    ]
    const scored = scoreVideos(vids, NOW)
    expect(scored[0]!.baseline).toBe(1000)
    expect(scored[5]!.baseline).toBe(50_000)
    expect(scored[10]!.baseline).toBe(200)
  })

  it('deja el score en null si el canal tiene muy pocos videos', () => {
    const scored = scoreVideos([video({}), video({}), video({})], NOW)
    expect(scored.every((v) => v.score === null)).toBe(true)
  })

  it('excluye los videos recién publicados de la mediana, pero igual los puntúa', () => {
    const vids = [
      ...Array.from({ length: 5 }, () => video({ views: 1000 })),
      ...Array.from({ length: 6 }, () => video({ views: 10, publishedAt: daysAgo(0.5) })),
    ]
    const scored = scoreVideos(vids, NOW)
    expect(scored[0]!.baseline).toBe(1000)
    expect(scored[5]!.score).toBe(0.01)
  })

  it('calcula vistas por hora promedio sin dividir por cero', () => {
    const [fresh, old] = scoreVideos(
      [video({ views: 500, publishedAt: daysAgo(0.01) }), video({ views: 24_000, publishedAt: daysAgo(10) })],
      NOW,
    )
    expect(fresh!.viewsPerHour).toBe(500)
    expect(old!.viewsPerHour).toBe(100)
    expect(old!.recentPace).toBe(false)
  })

  it('usa la lectura anterior para medir el ritmo reciente', () => {
    const v = video({ id: 'a', views: 10_000, publishedAt: daysAgo(400), fetchedAt: NOW.toISOString() })
    const previous = new Map([['a', { views: 9_520, at: new Date(NOW.getTime() - 24 * 3_600_000).toISOString() }]])
    const [scored] = scoreVideos([v], NOW, previous)
    expect(scored!.viewsPerHour).toBe(20)
    expect(scored!.recentPace).toBe(true)
  })

  it('ignora lecturas demasiado cercanas o con menos vistas que antes', () => {
    const at = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString()
    const a = video({ id: 'a', views: 2_400, publishedAt: daysAgo(100), fetchedAt: NOW.toISOString() })
    const close = scoreVideos([a], NOW, new Map([['a', { views: 2_000, at: at(2) }]]))[0]!
    const lower = scoreVideos([a], NOW, new Map([['a', { views: 9_000, at: at(24) }]]))[0]!
    expect(close.recentPace).toBe(false)
    expect(lower.recentPace).toBe(false)
    expect(close.viewsPerHour).toBe(1)
  })

  it('calcula la interacción y la deja en null si los likes están ocultos', () => {
    const [shown, hidden] = scoreVideos([video({ views: 1000, likes: 40, comments: 10 }), video({ likes: null })], NOW)
    expect(shown!.engagement).toBe(0.05)
    expect(hidden!.engagement).toBeNull()
  })
})

describe('parseChannelInput', () => {
  const id = 'UC' + 'a'.repeat(22)
  it('reconoce handles, IDs y enlaces', () => {
    expect(parseChannelInput('@alejoxcode')).toEqual({ handle: '@alejoxcode' })
    expect(parseChannelInput('  alejoxcode ')).toEqual({ handle: '@alejoxcode' })
    expect(parseChannelInput(id)).toEqual({ id })
    expect(parseChannelInput('https://www.youtube.com/@alejoxcode/videos')).toEqual({ handle: '@alejoxcode' })
    expect(parseChannelInput('youtube.com/@alejoxcode')).toEqual({ handle: '@alejoxcode' })
    expect(parseChannelInput(`https://youtube.com/channel/${id}`)).toEqual({ id })
    expect(parseChannelInput('https://www.youtube.com/user/alguien')).toEqual({ username: 'alguien' })
  })
  it('rechaza lo que no puede resolver', () => {
    expect(parseChannelInput('')).toBeNull()
    expect(parseChannelInput('dos palabras')).toBeNull()
    expect(parseChannelInput('https://www.youtube.com/watch?v=abc')).toBeNull()
    expect(parseChannelInput('https://www.youtube.com/c/nombre')).toBeNull()
    expect(parseChannelInput('https://example.com/@alguien')).toBeNull()
  })
})
