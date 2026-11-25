/**
 * La extensión llama a /api/ext/* desde su propio origen (chrome-extension://…).
 * Solo esas rutas aceptan peticiones de otro origen, y solo de extensiones.
 */
export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/ext/')) return
  const origin = getRequestHeader(event, 'origin') ?? ''
  if (!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return

  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  })
  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }
})
