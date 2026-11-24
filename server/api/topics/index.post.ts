import { CATEGORIES } from '~~/shared/categories'

/** Empieza a seguir un tema y trae sus primeros resultados. Cuesta unas 150 unidades. */
export default defineEventHandler(async (event) => {
  requireLive()
  const body = await readBody<{ query?: string; category?: string }>(event)
  const query = String(body?.query ?? '').trim().slice(0, 80)
  const categoryId = String(body?.category ?? '')

  if (categoryId && !CATEGORIES[categoryId]) {
    throw createError({ statusCode: 400, message: 'Esa categoría no existe.' })
  }
  if (query.length < 2 && !categoryId) {
    throw createError({ statusCode: 400, message: 'Escribe un tema o elige una categoría.' })
  }
  if ((await dbListTopics()).length >= MAX_TOPICS) {
    throw createError({
      statusCode: 400,
      message: `Puedes seguir hasta ${MAX_TOPICS} temas. Quita uno para agregar otro.`,
    })
  }

  const topic = await dbCreateTopic({ query, categoryId, language: 'es', days: 30 })
  const videos = await refreshTopic(topic)
  return { topic, videos }
})
