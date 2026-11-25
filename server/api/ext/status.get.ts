/** La extensión lo usa para saber si sigue conectada y si la app está en modo demo. */
export default defineEventHandler(() => ({ ok: true, mode: appMode() }))
