/** Elimina una colección. Sus videos siguen en Guardados, sin colección. */
export default defineEventHandler(async (event) => {
  requireLive()
  await dbDeleteCollection(await currentUserId(event), getRouterParam(event, 'id')!)
  return { ok: true }
})
