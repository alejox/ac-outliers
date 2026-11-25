import { describe, expect, it } from 'vitest'
import { analyzeVideo } from '../shared/analysis'
import { daysAgo, scored, video } from './helpers'

describe('analyzeVideo', () => {
  // Seis videos normales publicados en jueves (2026-11-05 es jueves), de 10 minutos
  const normal = Array.from({ length: 6 }, (_, i) =>
    video({
      title: i < 2 ? 'Plugin de OBS para principiantes' : `Rutina número ${i}`,
      views: 1000,
      likes: 40,
      comments: 10,
      publishedAt: new Date(Date.UTC(2026, 10, 5 - i * 7, 15)).toISOString(),
    }),
  )
  const hit = video({ id: 'hit', title: 'Mi mejor plugin de OBS', views: 10_000, likes: 900, comments: 100, durationSeconds: 1500, publishedAt: '2026-11-10T18:30:00Z' })
  const other = video({ id: 'otro', title: 'Otro plugin de OBS increíble', views: 4000, likes: 160, comments: 40, publishedAt: daysAgo(50) })
  const all = scored([...normal, hit, other])
  const target = all.find((v) => v.id === 'hit')!
  const analysis = analyzeVideo(target, all, 'UTC')
  const by = (key: string) => analysis.findings.find((f) => f.key === key)!

  it('explica el score en palabras', () => {
    expect(analysis.enough).toBe(true)
    expect(analysis.comparable).toBe(7)
    expect(by('score').text).toContain('éxito excepcional')
    expect(by('score').figures.map((f) => f.value)).toContain('10×')
  })

  it('compara la duración, el día, el título y la interacción con las medianas del canal', () => {
    expect(by('duration').text).toBe('Dura 25 min, más que lo habitual en el canal (10 min).')
    expect(by('timing').text).toBe('Se publicó un martes a las 18:30; el canal publica más los jueves.')
    expect(by('title').figures[0]!.value).toBe('22 caracteres')
    expect(by('engagement').text).toContain('mayor')
    expect(by('pace').text).toContain('vistas por hora')
  })

  it('solo compara el ritmo con videos de una antigüedad parecida', () => {
    const list = scored([video({ id: 'fresh', views: 9000, publishedAt: daysAgo(2) }), ...normal])
    const res = analyzeVideo(list.find((v) => v.id === 'fresh')!, list, 'UTC')
    const pace = res.findings.find((f) => f.key === 'pace')!
    expect(pace.text).toContain('pocos videos del canal de una antigüedad parecida')
  })

  it('encuentra las palabras que comparte con los otros outliers', () => {
    expect(by('words').text).toBe('Comparte “plugin”, “obs” con el otro outlier del canal.')
  })

  it('no compara con pocos videos ni mezcla formatos', () => {
    const few = scored([hit, ...normal.slice(0, 3), ...normal.slice(3).map((v) => ({ ...v, isShort: true }))])
    const res = analyzeVideo(few.find((v) => v.id === 'hit')!, few, 'UTC')
    expect(res).toEqual({ comparable: 3, enough: false, findings: [] })
  })

  it('omite la interacción si el canal oculta los likes', () => {
    const hidden = scored([...normal, hit].map((v) => ({ ...v, likes: null })))
    const res = analyzeVideo(hidden.find((v) => v.id === 'hit')!, hidden, 'UTC')
    expect(res.findings.some((f) => f.key === 'engagement')).toBe(false)
  })
})
