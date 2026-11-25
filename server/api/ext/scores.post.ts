import { demoScores, parseVideoRequests } from '~~/shared/extension'

/** Puntajes de los videos que la extensión ve en la página de YouTube. */
export default defineEventHandler(async (event) => {
  const requests = parseVideoRequests(await readBody(event))
  if (appMode() === 'demo') return { mode: 'demo', scores: demoScores(requests), quotaUsed: 0 }
  return { mode: 'live', ...(await scoreForExtension(requests)) }
})
