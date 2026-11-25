/** Los cambios de título y miniatura de un video, con las miniaturas de antes y después. No gasta cuota. */
export default defineEventHandler(async (event) => {
  const id = String(getQuery(event).id ?? '')
  if (!/^[\w-]{1,20}$/.test(id)) throw createError({ statusCode: 400, message: 'Falta el ID del video.' })
  if (appMode() === 'demo') return { changes: demoVideoChanges(id) }
  return { changes: await dbListVideoChanges(id) }
})
