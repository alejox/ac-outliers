/**
 * La app vive en acoutliers.alejoxcode.com. Quien entre por la dirección vieja de Vercel pasa a la nueva.
 * La API no se redirige: las extensiones conectadas a la dirección vieja siguen funcionando.
 */
const OLD_HOST = 'ac-outliers.vercel.app'
const NEW_ORIGIN = 'https://acoutliers.alejoxcode.com'

export default defineEventHandler((event) => {
  if (getRequestHost(event, { xForwardedHost: true }) !== OLD_HOST) return
  if (event.path.startsWith('/api/') || !['GET', 'HEAD'].includes(event.method)) return
  return sendRedirect(event, `${NEW_ORIGIN}${event.path}`, 308)
})
