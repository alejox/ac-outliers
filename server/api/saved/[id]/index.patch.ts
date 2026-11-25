/** Mueve un guardado a una colección, o lo deja sin colección con collectionId: null. */
export default defineEventHandler(async (event) => {
  requireLive()
  const body = await readBody<{ collectionId?: unknown }>(event)
  const collectionId = typeof body?.collectionId === 'string' && body.collectionId ? body.collectionId : null
  await dbSetSavedCollection(await currentUserId(event), getRouterParam(event, 'id')!, collectionId)
  return { ok: true }
})
