/** Deja de seguir un tema y borra sus resultados guardados. */
export default defineEventHandler(async (event) => {
  requireLive()
  await dbDeleteTopic(getRouterParam(event, 'id')!)
  return { ok: true }
})
