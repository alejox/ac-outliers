// Historial de cambios de título y miniatura. Lógica pura: qué cambió entre dos lecturas de un video.

/** Solo se vigilan las miniaturas de videos publicados en estos días: es cuando los creadores las prueban. */
export const THUMB_WATCH_DAYS = 60

export type ChangeKind = 'title' | 'thumbnail'

export interface VideoChange {
  videoId: string
  kind: ChangeKind
  /** Título anterior, o la miniatura anterior como data URL. */
  before: string | null
  after: string | null
  changedAt: string
}

/** Lo guardado de un video la vez anterior. */
export interface VideoMark {
  title: string
  thumbHash: string | null
  thumbData: string | null
}

/** Lo leído ahora. thumbHash null = no se revisó la miniatura (video viejo o no se pudo bajar). */
export interface VideoReading {
  id: string
  title: string
  thumbHash: string | null
  thumbData: string | null
}

/**
 * Compara lo leído con lo guardado. Un video que no estaba guardado no cuenta como cambio: es la
 * primera lectura. Una miniatura solo cuenta si había huella anterior y ahora también.
 */
export function detectChanges(marks: Map<string, VideoMark>, readings: VideoReading[], at: string): VideoChange[] {
  const out: VideoChange[] = []
  for (const r of readings) {
    const before = marks.get(r.id)
    if (!before) continue
    if (before.title !== r.title && r.title.trim() !== '') {
      out.push({ videoId: r.id, kind: 'title', before: before.title, after: r.title, changedAt: at })
    }
    if (before.thumbHash && r.thumbHash && before.thumbHash !== r.thumbHash) {
      out.push({ videoId: r.id, kind: 'thumbnail', before: before.thumbData, after: r.thumbData, changedAt: at })
    }
  }
  return out
}
