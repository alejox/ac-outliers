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

  it('calcula vistas por día sin dividir por cero', () => {
    const [fresh, old] = scoreVideos(
      [video({ views: 500, publishedAt: daysAgo(0.1) }), video({ views: 3000, publishedAt: daysAgo(30) })],
      NOW,
    )
    expect(fresh!.viewsPerDay).toBe(500)
    expect(old!.viewsPerDay).toBe(100)
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
