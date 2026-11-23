// Interpreta lo que el usuario pega en "Agregar canal".

export type ChannelRef = { id: string } | { handle: string } | { username: string }

const CHANNEL_ID = /^UC[\w-]{22}$/

export function parseChannelInput(raw: string): ChannelRef | null {
  const input = (raw ?? '').trim()
  if (!input) return null
  if (CHANNEL_ID.test(input)) return { id: input }

  if (/^https?:\/\//i.test(input) || /^(www\.|m\.)?youtube\.com\//i.test(input)) {
    let url: URL
    try {
      url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
    } catch {
      return null
    }
    if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return null
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    const [first, second] = parts
    if (first?.startsWith('@') && first.length > 1) return { handle: first }
    if (first === 'channel' && second && CHANNEL_ID.test(second)) return { id: second }
    if (first === 'user' && second) return { username: second }
    // Los enlaces /c/nombre y los de videos no se pueden resolver sin gastar una búsqueda (100 unidades).
    return null
  }

  if (/\s|\//.test(input)) return null
  return { handle: input.startsWith('@') ? input : `@${input}` }
}
