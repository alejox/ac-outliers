import { describe, expect, it } from 'vitest'
import { applyFilters, defaultFilters, extraFilterCount, topWords } from '../shared/filters'
import { channelStats } from '../shared/channel-stats'
import type { Channel, ScoredVideo } from '../shared/outliers'

let n = 0
function scored(over: Partial<ScoredVideo>): ScoredVideo {
  return {
    id: `v${n++}`,
    channelId: 'c1',
    title: 'Un video',
    thumbnailUrl: null,
    publishedAt: '2026-11-01T00:00:00Z',
    durationSeconds: 600,
    isShort: false,
    categoryId: '28',
    views: 5000,
    likes: 100,
    comments: 10,
    score: 3,
    baseline: 1000,
    ageDays: 10,
    viewsPerHour: 20,
    recentPace: false,
    engagement: 0.022,
    ...over,
  }
}

const subs = new Map<string, number | null>([
  ['c1', 5_000],
  ['c2', 250_000],
  ['c3', null],
])
const all = defaultFilters({ format: 'all', periodDays: 0, minScore: 0 })
const ids = (list: ScoredVideo[]) => list.map((v) => v.id)

describe('applyFilters', () => {
  it('filtra por formato, periodo y score', () => {
    const long = scored({ id: 'long' })
    const short = scored({ id: 'short', isShort: true })
    const old = scored({ id: 'old', ageDays: 200 })
    const weak = scored({ id: 'weak', score: 1.2 })
    const unknown = scored({ id: 'unknown', score: null })
    const list = [long, short, old, weak, unknown]
    expect(ids(applyFilters(list, defaultFilters(), subs))).toEqual(['long'])
    expect(applyFilters(list, all, subs)).toHaveLength(5)
  })

  it('filtra por tamaño del canal y deja fuera los que ocultan suscriptores', () => {
    const list = [scored({ id: 'small' }), scored({ id: 'mid', channelId: 'c2' }), scored({ id: 'hidden', channelId: 'c3' })]
    expect(ids(applyFilters(list, { ...all, channelSize: 'xs' }, subs))).toEqual(['small'])
    expect(ids(applyFilters(list, { ...all, channelSize: 'm' }, subs))).toEqual(['mid'])
    expect(applyFilters(list, all, subs)).toHaveLength(3)
  })

  it('filtra por vistas, duración, categoría y canal', () => {
    const list = [
      scored({ id: 'a', views: 500, durationSeconds: 120, categoryId: '20' }),
      scored({ id: 'b', views: 50_000, durationSeconds: 900, categoryId: '28' }),
      scored({ id: 'c', views: 2_000_000, durationSeconds: 3600, categoryId: null, channelId: 'c2' }),
    ]
    expect(ids(applyFilters(list, { ...all, minViews: 10_000 }, subs))).toEqual(['b', 'c'])
    expect(ids(applyFilters(list, { ...all, duration: 'brief' }, subs))).toEqual(['a'])
    expect(ids(applyFilters(list, { ...all, duration: 'mid' }, subs))).toEqual(['b'])
    expect(ids(applyFilters(list, { ...all, duration: 'long' }, subs))).toEqual(['c'])
    expect(ids(applyFilters(list, { ...all, category: '20' }, subs))).toEqual(['a'])
    expect(ids(applyFilters(list, all, subs, 'c2'))).toEqual(['c'])
  })

  it('busca en títulos sin importar tildes ni mayúsculas', () => {
    const list = [scored({ id: 'a', title: 'Cómo configurar OBS Studio' }), scored({ id: 'b', title: 'Curso de Vue' })]
    expect(ids(applyFilters(list, { ...all, title: 'como obs' }, subs))).toEqual(['a'])
    expect(applyFilters(list, { ...all, title: 'obs vue' }, subs)).toHaveLength(0)
  })

  it('ordena por cada criterio', () => {
    const list = [
      scored({ id: 'a', score: 2, viewsPerHour: 90, views: 10, engagement: 0.01, ageDays: 5 }),
      scored({ id: 'b', score: 9, viewsPerHour: 5, views: 30, engagement: null, ageDays: 1 }),
      scored({ id: 'c', score: null, viewsPerHour: 40, views: 20, engagement: 0.2, ageDays: 9 }),
    ]
    const by = (sort: typeof all.sort) => ids(applyFilters([...list], { ...all, sort }, subs))
    expect(by('score')).toEqual(['b', 'a', 'c'])
    expect(by('pace')).toEqual(['a', 'c', 'b'])
    expect(by('views')).toEqual(['b', 'c', 'a'])
    expect(by('engagement')).toEqual(['c', 'a', 'b'])
    expect(by('recent')).toEqual(['b', 'a', 'c'])
  })

  it('cuenta los filtros avanzados activos', () => {
    expect(extraFilterCount(defaultFilters())).toBe(0)
    expect(extraFilterCount(defaultFilters({ channelSize: 's', category: '20', minViews: 1000 }))).toBe(3)
  })
})

describe('topWords', () => {
  it('cuenta cada palabra una vez por título e ignora palabras vacías', () => {
    const words = topWords(
      [
        'Cómo instalar plugins en OBS OBS OBS',
        'Los mejores plugins de OBS para 2026',
        'OBS: guía de plugins',
        'Mi setup con Vue',
        'Probé C++ y Node.js',
      ],
      5,
      2,
    )
    expect(words).toEqual([
      { word: 'obs', count: 3 },
      { word: 'plugins', count: 3 },
    ])
  })

  it('no devuelve nada si ninguna palabra se repite lo suficiente', () => {
    expect(topWords(['uno distinto', 'otro diferente'])).toEqual([])
  })
})

describe('channelStats', () => {
  const channel = (id: string, subscriberCount: number | null): Channel => ({
    id,
    title: id,
    handle: null,
    thumbnailUrl: null,
    subscriberCount,
    viewCount: null,
    videoCount: null,
    lastSyncedAt: null,
  })

  it('resume cada canal', () => {
    const videos = [
      scored({ channelId: 'c1', score: 5, ageDays: 10, baseline: 2000 }),
      scored({ channelId: 'c1', score: 1, ageDays: 40, baseline: 2000 }),
      scored({ channelId: 'c1', score: 2, ageDays: 80, baseline: 2000 }),
      scored({ channelId: 'c1', score: 30, ageDays: 200, baseline: 2000 }),
      scored({ channelId: 'c1', score: 8, ageDays: 3, isShort: true, baseline: 90_000 }),
    ]
    const [c1, empty] = channelStats([channel('c1', 10_000), channel('c9', null)], videos)
    expect(c1!.baseline).toBe(2000)
    expect(c1!.reach).toBe(0.2)
    expect(c1!.uploads30).toBe(2)
    expect(c1!.recent90).toBe(3)
    expect(c1!.outliers90).toBe(2)
    expect(c1!.hitRate).toBeCloseTo(2 / 3)
    expect(c1!.best!.score).toBe(5)
    expect(empty).toMatchObject({ baseline: null, reach: null, uploads30: 0, recent90: 0, hitRate: null, best: null })
  })
})
