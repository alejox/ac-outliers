/** Vuelve a traer los videos de un canal desde YouTube. */
export default defineEventHandler(async (event) => {
  requireLive()
  const videos = await syncChannel(getRouterParam(event, 'id')!)
  return { videos }
})
