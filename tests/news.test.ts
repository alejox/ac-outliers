import { describe, expect, it } from 'vitest'
import { currentOutliers, newOutliers, rememberSeen, sinceLabel } from '../shared/home'
import type { ScoredVideo } from '../shared/outliers'

const v = (id: string, score: number | null, ageDays = 3) => ({ id, score, ageDays }) as ScoredVideo

describe('currentOutliers', () => {
  it('junta tus canales y tus temas, solo 2× o más, sin repetir y del mayor al menor', () => {
    const out = currentOutliers([v('a', 3), v('b', 1.5), v('c', 8, 60), v('d', null)], [v('e', 12), v('a', 3)])
    expect(out.map((x) => x.id)).toEqual(['e', 'a'])
  })
})

describe('newOutliers', () => {
  const current = [v('a', 5), v('b', 2.5)]
  it('en la primera visita no muestra nada', () => {
    expect(newOutliers(current, null)).toEqual([])
  })
  it('muestra lo que no estaba la vez anterior', () => {
    expect(newOutliers(current, new Set(['a'])).map((x) => x.id)).toEqual(['b'])
  })
})

describe('rememberSeen', () => {
  it('guarda lo de ahora más lo anterior, sin repetir', () => {
    expect(rememberSeen([v('a', 5)], new Set(['a', 'z']))).toEqual(['a', 'z'])
  })
})

describe('sinceLabel', () => {
  it('elige la unidad', () => {
    expect(sinceLabel(5 * 60_000)).toBe('hace 5 min')
    expect(sinceLabel(3 * 3_600_000)).toBe('hace 3 h')
    expect(sinceLabel(4 * 86_400_000)).toBe('hace 4 días')
  })
})
