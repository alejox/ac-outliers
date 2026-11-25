const $ = (id) => document.getElementById(id)
const DEFAULT_URL = 'https://ac-outliers.vercel.app'

function show(view) {
  $('connect').hidden = view !== 'connect'
  $('panel').hidden = view !== 'panel'
}

function setStatus(mode) {
  const status = $('status')
  status.hidden = !mode
  status.dataset.mode = mode
  $('status-text').textContent = mode === 'demo' ? 'Modo demo' : 'Conectada'
}

function showError(id, message) {
  $(id).hidden = !message
  $(id).textContent = message ?? ''
}

function paintMinScore(value) {
  for (const button of $('min-score').querySelectorAll('button')) {
    const on = Number(button.dataset.value) === value
    button.setAttribute('aria-checked', String(on))
    button.tabIndex = on ? 0 : -1
  }
}

async function render() {
  const s = await chrome.storage.local.get(['appUrl', 'connected', 'mode', 'enabled', 'minScore', 'quota'])
  $('app-url').value = s.appUrl || DEFAULT_URL
  if (!s.connected) {
    setStatus('')
    show('connect')
    return
  }
  setStatus(s.mode || 'live')
  show('panel')
  $('enabled').checked = s.enabled ?? true
  paintMinScore(s.minScore ?? 0)
  $('open-app').href = s.appUrl
  const today = new Date().toISOString().slice(0, 10)
  const used = s.quota?.date === today ? s.quota.used : 0
  $('quota').textContent =
    s.mode === 'demo'
      ? 'En modo demo los puntajes son de ejemplo y no gastan cuota.'
      : `Hoy la extensión gastó ${used.toLocaleString('es')} unidades de la cuota de YouTube.`
}

$('connect').addEventListener('submit', async (event) => {
  event.preventDefault()
  showError('connect-error', '')
  $('app-url').removeAttribute('aria-invalid')
  $('connect-button').disabled = true
  $('connect-button').textContent = 'Conectando…'
  const reply = await chrome.runtime.sendMessage({
    type: 'connect',
    appUrl: $('app-url').value,
    password: $('password').value,
  })
  $('connect-button').disabled = false
  $('connect-button').textContent = 'Conectar'
  if (!reply?.ok) {
    showError('connect-error', reply?.error ?? 'No se pudo conectar.')
    if (/dirección/i.test(reply?.error ?? '')) $('app-url').setAttribute('aria-invalid', 'true')
    return
  }
  $('password').value = ''
  render()
})

$('enabled').addEventListener('change', (event) => chrome.storage.local.set({ enabled: event.target.checked }))

$('min-score').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button) return
  const value = Number(button.dataset.value)
  paintMinScore(value)
  chrome.storage.local.set({ minScore: value })
})

// Flechas para moverse entre las opciones del grupo, como en cualquier grupo de radios.
$('min-score').addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  const buttons = [...$('min-score').querySelectorAll('button')]
  const index = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true')
  const next = buttons[(index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length]
  next.focus()
  next.click()
})

$('disconnect').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'disconnect' })
  render()
})

render()
// Si la sesión venció mientras el popup estaba cerrado, se nota al abrirlo.
chrome.storage.local.get('connected').then(({ connected }) => {
  if (!connected) return
  chrome.runtime.sendMessage({ type: 'status' }).then((reply) => {
    if (reply && !reply.ok && /venció/.test(reply.error)) {
      render().then(() => showError('connect-error', reply.error))
    }
  })
})
