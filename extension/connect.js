// Corre solo en la página "Conectar la extensión" de la app: recoge el token de la cuenta de Google
// que la página dejó y se lo pasa a la extensión.
const token = document.querySelector('meta[name="acx-token"]')?.content
const state = document.getElementById('acx-state')

if (token && state) {
  state.textContent = 'Conectando…'
  chrome.runtime
    .sendMessage({ type: 'google-connect', token })
    .then((reply) => {
      if (reply?.ok) {
        state.dataset.ok = 'yes'
        state.textContent = `Listo: la extensión quedó conectada con ${reply.account}. Ya puedes cerrar esta pestaña.`
      } else {
        state.dataset.ok = 'no'
        state.textContent = reply?.error ?? 'No se pudo conectar la extensión. Vuelve a intentarlo desde su panel.'
      }
    })
    .catch(() => {
      state.dataset.ok = 'no'
      state.textContent = 'La extensión no respondió. Recarga esta página.'
    })
}
