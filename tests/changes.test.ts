import { describe, expect, it } from 'vitest'
import { detectChanges, type VideoMark } from '../shared/changes'

const AT = '2026-11-25T12:00:00Z'
const marks = new Map<string, VideoMark>([
  ['a', { title: 'Viejo', thumbHash: 'h1', thumbData: 'data:old' }],
  ['b', { title: 'Igual', thumbHash: null, thumbData: null }],
])

describe('detectChanges', () => {
  it('encuentra el título y la miniatura que cambiaron', () => {
    const out = detectChanges(marks, [{ id: 'a', title: 'Nuevo', thumbHash: 'h2', thumbData: 'data:new' }], AT)
    expect(out).toEqual([
      { videoId: 'a', kind: 'title', before: 'Viejo', after: 'Nuevo', changedAt: AT },
      { videoId: 'a', kind: 'thumbnail', before: 'data:old', after: 'data:new', changedAt: AT },
    ])
  })

  it('no cuenta la primera lectura ni una miniatura sin huella anterior', () => {
    const out = detectChanges(
      marks,
      [
        { id: 'b', title: 'Igual', thumbHash: 'h9', thumbData: 'x' },
        { id: 'nuevo', title: 'Lo que sea', thumbHash: 'h3', thumbData: 'y' },
      ],
      AT,
    )
    expect(out).toEqual([])
  })

  it('ignora una miniatura que no se pudo revisar ahora', () => {
    expect(detectChanges(marks, [{ id: 'a', title: 'Viejo', thumbHash: null, thumbData: null }], AT)).toEqual([])
  })
})
