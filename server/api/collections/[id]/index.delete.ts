/** Elimina una colección. Sus videos siguen en Guardados, sin colección. */
export default defineEventHandler(async (event) => {
  requireLive()
  await dbDeleteCollection(getRouterParam(event, 'id')!)
  return { ok: true }
})
