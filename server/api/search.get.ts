import { CATEGORIES } from '~~/shared/categories'

const PERIODS = [7, 30, 90, 365]

/**
 * Descubre videos en todo YouTube por tema, por categoría o por ambos, y los puntúa
 * contra lo normal de su canal. Cuesta 100 unidades de la búsqueda más unas 2 por canal encontrado.
 */
export default defineEventHandler(async (event) => {
  requireLive()
  const params = getQuery(event)
  const query = String(params.q ?? '').trim().slice(0, 80)
  const categoryId = String(params.category ?? '')
  const days = PERIODS.includes(Number(params.days)) ? Number(params.days) : 0

  if (categoryId && !CATEGORIES[categoryId]) {
    throw createError({ statusCode: 400, message: 'Esa categoría no existe.' })
  }
  if (query.length < 2 && !categoryId) {
    throw createError({ statusCode: 400, message: 'Escribe un tema o elige una categoría.' })
  }

  const ids = await searchVideoIds({
    query,
    days,
    categoryId,
    language: params.lang === 'es' ? 'es' : '',
    order: params.order === 'viewCount' ? 'viewCount' : 'relevance',
  })
  if (ids.length === 0) return { channels: [], videos: [], quotaUsed: 100 }

  const found = await fetchVideosByIds(ids)
  const scored = await scoreFoundVideos(found)
  return { ...scored, quotaUsed: scored.quotaUsed + 101 }
})
