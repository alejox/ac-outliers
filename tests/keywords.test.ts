import { describe, expect, it } from 'vitest'
import { editDistance, matchesTerm, outlierKeywords, sameWord, tagChars, tagsToCopy, titlePhrases } from '../shared/keywords'

const v = (id: string, score: number | null, tags: string[], title = 't') => ({ id, score, tags, title })

describe('sameWord', () => {
  it('agrupa espacios, plurales y errores de una letra', () => {
    expect(sameWord('stream deck', 'streamdeck')).toBe(true)
    expect(sameWord('tutorial', 'tutoriales')).toBe(false)
    expect(sameWord('tutorial', 'tutoral')).toBe(true)
    expect(sameWord('plugins', 'plugin')).toBe(true)
  })
  it('no junta palabras cortas ni números distintos', () => {
    expect(sameWord('obs', 'abs')).toBe(false)
    expect(sameWord('iphone 14', 'iphone 15')).toBe(false)
  })
  it('editDistance corta temprano', () => {
    expect(editDistance('kitten', 'sitting', 3)).toBe(3)
    expect(editDistance('abc', 'xyzxyz', 1)).toBe(2)
  })
})

describe('outlierKeywords', () => {
  const videos = [
    v('a', 12, ['stream deck casero', 'arduino']),
    v('b', 8, ['Stream Deck Casero', 'obs']),
    v('c', 6, ['streamdeck casero', 'obs']),
    v('d', 1, ['arduino']),
    v('e', 0.8, ['arduino']),
    v('f', 1.2, ['arduino', 'obs']),
    v('g', 3, ['arduino']),
    v('h', null, ['stream deck casero']),
  ]
  const out = outlierKeywords(videos, 'tags')

  it('pone primero lo que comparten los outliers fuertes y agrupa variantes', () => {
    expect(out[0]!.text).toBe('stream deck casero')
    expect(out[0]!.outliers).toBe(3)
    expect(out[0]!.videos).toBe(3)
    expect(out[0]!.variants).toContain('streamdeck casero')
    expect(out[0]!.videoIds).toEqual(['a', 'b', 'c'])
  })
  it('baja las palabras que también usan los videos normales', () => {
    const arduino = out.find((k) => k.text === 'arduino')!
    expect(arduino.hitRate).toBeCloseTo(2 / 5)
    expect(out.indexOf(arduino)).toBeGreaterThan(out.findIndex((k) => k.text === 'obs'))
  })
  it('exige un mínimo de outliers', () => {
    expect(outlierKeywords(videos, 'tags', { minOutliers: 4 })).toEqual([])
  })
})

describe('frases de títulos', () => {
  it('saca frases sin bordes vacíos', () => {
    const keys = titlePhrases('Cómo hacer un Stream Deck casero').map((p) => p.key)
    expect(keys).toContain('stream deck casero')
    expect(keys).toContain('casero')
    expect(keys).not.toContain('un stream')
  })
  it('prefiere la frase larga cuando la usan los mismos videos', () => {
    const videos = [
      v('a', 10, [], 'Mi stream deck casero'),
      v('b', 5, [], 'Otro stream deck casero barato'),
      v('c', 1, [], 'Teclado viejo'),
    ]
    const texts = outlierKeywords(videos, 'titles').map((k) => k.text)
    expect(texts).toContain('stream deck casero')
    expect(texts).not.toContain('deck')
    expect(texts).not.toContain('stream deck')
  })
})

describe('copiar y cruzar', () => {
  it('cuenta caracteres como YouTube y respeta el límite', () => {
    expect(tagChars(['obs', 'stream deck'])).toBe(3 + 13 + 1)
    const many = Array.from({ length: 40 }, (_, i) => `etiqueta larga numero ${i}`)
    const picked = tagsToCopy(many, 30)
    expect(tagChars(picked)).toBeLessThanOrEqual(500)
    expect(tagsToCopy(['OBS', 'obs', 'plugin'])).toEqual(['OBS', 'plugin'])
  })
  it('marca las palabras por las que ya te buscan', () => {
    expect(matchesTerm('plugin obs', ['como instalar plugin obs'])).toBe(true)
    expect(matchesTerm('obs', ['observatorio'])).toBe(false)
  })
})

describe('frases repetidas de los mismos videos', () => {
  it('deja una sola, la más limpia', () => {
    const videos = [
      { id: 'a', score: 10, title: 'Probé un Stream Deck casero durante 30 días' },
      { id: 'b', score: 8, title: 'Stream Deck casero durante 30 días: mi veredicto' },
      { id: 'c', score: 1, title: 'Otra cosa' },
    ]
    const texts = outlierKeywords(videos, 'titles').map((k) => k.text)
    expect(texts).toEqual(['stream deck casero'])
  })
})
