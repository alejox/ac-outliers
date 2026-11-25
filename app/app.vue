<script setup lang="ts">
import type { Channel, ScoredVideo, Topic } from '~~/shared/outliers'
import { CATEGORY_OPTIONS, categoryName } from '~~/shared/categories'
import { channelStats } from '~~/shared/channel-stats'
import { applyFilters, defaultFilters, topWords } from '~~/shared/filters'

type Mode = 'home' | 'mine' | 'trends' | 'following' | 'discover' | 'channels' | 'saved'
type FoundChannel = Channel & { followed: boolean }
type TrendTopic = Topic & { count: number }
type TrendVideo = ScoredVideo & { topicIds: string[] }

const { data, error: loadError, refresh } = await useFetch('/api/outliers')
/** Quién entró con Google (si alguien) y qué formas de entrar ofrece la app. */
const { data: me, refresh: refreshMe } = await useFetch('/api/me')
const { data: trendData, refresh: refreshTrends } = await useFetch('/api/trends')
const { data: homeData, refresh: refreshHome } = await useFetch('/api/home')
/** Todo lo que se lee de la base: tras cualquier cambio se vuelve a pedir junto. */
const { data: savedData, refresh: refreshSaved } = await useFetch('/api/saved')
const refreshAll = () => Promise.all([refresh(), refreshTrends(), refreshHome(), refreshSaved()])

// Guardados: se puede guardar cualquier video desde su fila, y aparece en su propia sección.
type SavedVideo = ScoredVideo & { savedAt: string; collectionId: string | null }
type Collection = { id: string; name: string }
const savedVideos = computed<SavedVideo[]>(() => savedData.value?.videos ?? [])
const collections = computed<Collection[]>(() => savedData.value?.collections ?? [])
/** null = todos; 'none' = los que no están en ninguna colección. */
const onlyCollection = ref<string | null>(null)
const collectionCount = (id: string | null) => savedVideos.value.filter((v) => v.collectionId === id).length
const savedShown = computed(() =>
  onlyCollection.value === null
    ? savedVideos.value
    : savedVideos.value.filter((v) => v.collectionId === (onlyCollection.value === 'none' ? null : onlyCollection.value)),
)
const savedSummary = computed(() => {
  const n = countOf(savedShown.value.length, 'video', 'videos')
  if (onlyCollection.value === null) return countOf(savedVideos.value.length, 'video guardado', 'videos guardados')
  if (onlyCollection.value === 'none') return `${n} sin colección`
  return `${n} en “${collections.value.find((c) => c.id === onlyCollection.value)?.name ?? ''}”`
})
const newCollection = ref('')
const collectionBusy = ref(false)
const collectionError = ref('')
async function collectionCall(run: () => Promise<unknown>) {
  if (collectionBusy.value) return
  collectionBusy.value = true
  collectionError.value = ''
  try {
    await run()
    await refreshSaved()
  } catch (err) {
    collectionError.value = messageOf(err)
  } finally {
    collectionBusy.value = false
  }
}
const addCollection = () =>
  collectionCall(async () => {
    if (!newCollection.value.trim()) return
    await $fetch('/api/collections', { method: 'POST', body: { name: newCollection.value } })
    newCollection.value = ''
  })
const removeCollection = (c: Collection) =>
  collectionCall(async () => {
    await $fetch(`/api/collections/${c.id}`, { method: 'DELETE' })
    if (onlyCollection.value === c.id) onlyCollection.value = null
  })
const moveToCollection = (video: ScoredVideo, collectionId: string) =>
  collectionCall(() => $fetch(`/api/saved/${video.id}`, { method: 'PATCH', body: { collectionId: collectionId || null } }))
const collectionOf = (video: ScoredVideo) => savedVideos.value.find((v) => v.id === video.id)?.collectionId ?? ''
const savedIds = computed(() => new Set(savedVideos.value.map((v) => v.id)))
const savedChannelById = computed(
  () => new Map([...(savedData.value?.channels ?? []), ...channels.value].map((c: Channel) => [c.id, c])),
)
const saving = ref<string | null>(null)
const saveError = ref<{ id: string; text: string } | null>(null)
async function toggleSaved(video: ScoredVideo) {
  if (saving.value) return
  saving.value = video.id
  saveError.value = null
  try {
    if (savedIds.value.has(video.id)) await $fetch(`/api/saved/${video.id}`, { method: 'DELETE' })
    else await $fetch('/api/saved', { method: 'POST', body: { id: video.id, short: video.isShort } })
    await refreshSaved()
  } catch (err) {
    saveError.value = { id: video.id, text: messageOf(err) }
  } finally {
    saving.value = null
  }
}
provide('saver', {
  enabled: computed(() => !isDemo.value),
  isSaved: (id: string) => savedIds.value.has(id),
  busy: saving,
  error: saveError,
  toggle: toggleSaved,
})

const channels = computed<Channel[]>(() => data.value?.channels ?? [])
const videos = computed<ScoredVideo[]>(() => data.value?.videos ?? [])
const isDemo = computed(() => data.value?.demo ?? false)
const isOpen = computed(() => data.value?.open ?? false)
const needsLogin = computed(() => loadError.value?.statusCode === 401)
const channelById = computed(() => new Map(channels.value.map((c) => [c.id, c])))
/** Cambios de título y miniatura de los últimos 90 días, por video: los muestran las filas y Analizar. */
const videoChanges = computed<Record<string, { kind: 'title' | 'thumbnail'; at: string }[]>>(() => data.value?.changes ?? {})
provide('videoChanges', videoChanges)

const route = useRoute()
const mode = ref<Mode>(route.query.seccion === 'mi-canal' ? 'mine' : 'home')
const hasMyChannel = computed(() => isDemo.value || Boolean(me.value?.user?.channelId))
const LOGIN_ERRORS: Record<string, string> = {
  cancelado: 'Cancelaste la entrada con Google.',
  vencido: 'La entrada con Google tardó demasiado. Vuelve a intentarlo.',
  error: 'Google no completó la entrada. Vuelve a intentarlo.',
}
const accountOpen = ref(false)
async function logOut() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  accountOpen.value = false
  await Promise.all([refreshMe(), refreshAll()])
  if (mode.value === 'mine') mode.value = 'home'
}
const MODE_TITLES: Record<Mode, string> = {
  home: 'Inicio',
  trends: 'Tendencias',
  following: 'Tus canales',
  discover: 'Descubrir',
  channels: 'Comparar canales',
  saved: 'Guardados',
  mine: 'Mi canal',
}
const MODE_LEDES: Record<Mode, string> = {
  home: 'Lo que pasó en tus canales y tus temas.',
  trends: 'Videos que rindieron muy por encima de lo normal en su canal, en los temas que sigues.',
  following: 'Videos que rindieron muy por encima de lo normal en su propio canal.',
  discover: 'Busca en todo YouTube y compara cada video con lo normal de su canal.',
  channels: 'Cómo le va a cada canal que sigues.',
  saved: 'Los videos que guardaste desde la app o desde YouTube, con el score que tenían ese día.',
  mine: 'De dónde vienen las vistas de tu canal, qué buscan para encontrarte y qué videos te recomiendan.',
}
const view = ref<'list' | 'grid'>('list')
// En celular las secciones se desplazan en horizontal: la activa siempre queda a la vista.
watch(mode, () =>
  nextTick(() =>
    document.querySelector('.modes [aria-pressed="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' }),
  ),
)
watch([mode, isDemo], () => nextTick(measureModes), { flush: 'post' })
// Si las secciones no caben, el borde por donde sigue la fila se desvanece.
const modesEl = ref<HTMLElement | null>(null)
const modesMore = reactive({ left: false, right: false })
function measureModes() {
  const el = modesEl.value
  if (!el) return
  modesMore.left = el.scrollLeft > 4
  modesMore.right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}
onMounted(() => {
  measureModes()
  window.addEventListener('resize', measureModes)
})
onBeforeUnmount(() => window.removeEventListener('resize', measureModes))
const messageOf = (err: any) => err?.data?.message ?? 'Algo falló. Vuelve a intentar.'

const subscribersOf = (list: Channel[]) => new Map(list.map((c) => [c.id, c.subscriberCount]))
const categoriesOf = (list: ScoredVideo[]) =>
  [...new Set(list.map((v) => v.categoryId).filter((id): id is string => id !== null))]
    .map((id) => ({ id, name: categoryName(id) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
/** Los filtros se apartan de los de partida: el estado vacío ofrece volver a ellos. */
const differs = (a: object, b: object) => JSON.stringify(a) !== JSON.stringify(b)
const FOUND_DEFAULTS = { periodDays: 0, minScore: 0 }
const countOf = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)

// Ranking de los canales que sigues
const filters = ref(defaultFilters())
const onlyChannel = ref<string | null>(null)

const results = computed(() => applyFilters(videos.value, filters.value, subscribersOf(channels.value), onlyChannel.value))
const categories = computed(() => categoriesOf(videos.value))

const summary = computed(() => {
  const f = filters.value
  const about = f.title.trim() ? ` con “${f.title.trim()}” en el título` : ''
  const over = f.minScore > 0 ? ` por encima de ${formatScore(f.minScore)}` : ''
  const when = f.periodDays > 0 ? ` publicados en ${periodLabel(f.periodDays)}` : ''
  return `${countOf(results.value.length, 'video', 'videos')}${about}${over}${when}`
})

/** Palabras que se repiten en los títulos de lo que está en pantalla. Solo tiene sentido entre outliers. */
const words = computed(() =>
  filters.value.minScore > 0 && !filters.value.title.trim() ? topWords(results.value.map((v) => v.title)) : [],
)

function showChannel(channelId: string) {
  onlyChannel.value = channelId
  mode.value = 'following'
}

// Tendencias: lo que está pegando en los temas que sigues
const topics = computed<TrendTopic[]>(() => trendData.value?.topics ?? [])
const trendVideos = computed<TrendVideo[]>(() => trendData.value?.videos ?? [])
const trendChannels = computed<FoundChannel[]>(() => trendData.value?.channels ?? [])
const trendChannelById = computed(() => new Map(trendChannels.value.map((c) => [c.id, c])))
const trendFilters = ref(defaultFilters({ periodDays: 0, minScore: 0 }))
const onlyTopic = ref<string | null>(null)

const trendResults = computed(() =>
  applyFilters(
    onlyTopic.value ? trendVideos.value.filter((v) => v.topicIds.includes(onlyTopic.value!)) : trendVideos.value,
    trendFilters.value,
    subscribersOf(trendChannels.value),
  ),
)
const trendCategories = computed(() => categoriesOf(trendVideos.value))
const topicLabel = (t: { query: string; categoryId: string }) =>
  [t.query, t.categoryId && categoryName(t.categoryId)].filter(Boolean).join(' en ')
const trendSummary = computed(() => {
  const topic = topics.value.find((t) => t.id === onlyTopic.value)
  const where = topic ? `de “${topicLabel(topic)}”` : `de ${countOf(topics.value.length, 'tema', 'temas')}`
  return `${countOf(trendResults.value.length, 'video', 'videos')} ${where}`
})

/** Sin temas todavía: lo que más rápido suma vistas entre lo reciente de tus canales. */
const rising = computed(() =>
  applyFilters(
    videos.value,
    defaultFilters({ format: 'all', periodDays: 30, minScore: 0, sort: 'pace' }),
    subscribersOf(channels.value),
  ).slice(0, 12),
)

const newTopic = reactive({ query: '', category: '' })
const topicBusy = ref(false)
const topicError = ref('')
const canAddTopic = computed(() => newTopic.query.trim().length >= 2 || newTopic.category !== '')

async function addTopic() {
  if (!canAddTopic.value || topicBusy.value) return
  topicBusy.value = true
  topicError.value = ''
  try {
    await $fetch('/api/topics', { method: 'POST', body: { query: newTopic.query, category: newTopic.category } })
    newTopic.query = ''
    newTopic.category = ''
    await refreshTrends()
  } catch (err) {
    topicError.value = messageOf(err)
  } finally {
    topicBusy.value = false
  }
}

async function removeTopic(topic: TrendTopic) {
  if (topicBusy.value) return
  topicError.value = ''
  try {
    await $fetch(`/api/topics/${topic.id}`, { method: 'DELETE' })
    if (onlyTopic.value === topic.id) onlyTopic.value = null
    await refreshTrends()
  } catch (err) {
    topicError.value = messageOf(err)
  }
}

/** Los estados vacíos llevan al campo que los resuelve. */
async function focusField(id: string, inMode?: Mode) {
  if (inMode && mode.value !== inMode) {
    mode.value = inMode
    await nextTick()
  }
  const el = document.getElementById(id)
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el?.focus({ preventScroll: true })
}

// Comparación de canales
const stats = computed(() => channelStats(channels.value, videos.value))

// Canales
const newChannel = ref('')
const busy = ref<'add' | 'sync' | null>(null)
const progress = ref('')
const notice = ref<{ kind: 'ok' | 'error'; text: string } | null>(null)

async function addChannel() {
  if (!newChannel.value.trim() || busy.value) return
  busy.value = 'add'
  notice.value = null
  try {
    const res = await $fetch('/api/channels', { method: 'POST', body: { input: newChannel.value } })
    newChannel.value = ''
    await refreshAll()
    notice.value = { kind: 'ok', text: `Agregaste ${res.channel.title} con ${res.videos} videos.` }
  } catch (err) {
    notice.value = { kind: 'error', text: messageOf(err) }
  } finally {
    busy.value = null
  }
}

async function removeChannel(channel: Channel) {
  if (busy.value) return
  notice.value = null
  try {
    await $fetch(`/api/channels/${channel.id}`, { method: 'DELETE' })
    if (onlyChannel.value === channel.id) onlyChannel.value = null
    const found = discovered.value?.channels.find((c) => c.id === channel.id)
    if (found) found.followed = false
    await refreshAll()
    notice.value = { kind: 'ok', text: `Quitaste ${channel.title}.` }
  } catch (err) {
    notice.value = { kind: 'error', text: messageOf(err) }
  }
}

/** Los temas se vuelven a buscar como mucho una vez cada tantas horas: cada búsqueda gasta cuota. */
const TOPIC_STALE_HOURS = 20

async function updateAll() {
  if (busy.value) return
  busy.value = 'sync'
  notice.value = null
  const list = [...channels.value]
  const staleBefore = Date.now() - TOPIC_STALE_HOURS * 3_600_000
  const stale = topics.value.filter((t) => !t.fetchedAt || new Date(t.fetchedAt).getTime() < staleBefore)
  try {
    for (const [i, channel] of list.entries()) {
      progress.value = `Actualizando canal ${i + 1} de ${list.length}`
      await $fetch(`/api/channels/${channel.id}/sync`, { method: 'POST' })
    }
    for (const [i, topic] of stale.entries()) {
      progress.value = `Actualizando tema ${i + 1} de ${stale.length}`
      await $fetch(`/api/topics/${topic.id}/refresh`, { method: 'POST' })
    }
    notice.value = { kind: 'ok', text: 'Datos actualizados.' }
  } catch (err) {
    notice.value = { kind: 'error', text: messageOf(err) }
  } finally {
    await refreshAll()
    busy.value = null
    progress.value = ''
  }
}

// Descubrir en todo YouTube
const search = reactive({ topic: '', category: '', days: 90, lang: 'es', order: 'relevance' })
const searching = ref(false)
const searchError = ref('')
const searchedFor = ref('')
const discovered = ref<{
  channels: FoundChannel[]
  videos: ScoredVideo[]
  /** Videos largos recientes de cada canal encontrado: con ellos se analiza un resultado. */
  context: ScoredVideo[]
  quotaUsed: number
} | null>(null)
const following = ref<string | null>(null)
const foundFilters = ref(defaultFilters({ periodDays: 0, minScore: 0 }))

const optionsOpen = ref(false)
/** Cuántas opciones de búsqueda se apartan de las de partida: se ven en el botón aunque el panel esté cerrado. */
const changedOptions = computed(
  () => [search.category !== '', search.days !== 90, search.lang !== 'es', search.order !== 'relevance'].filter(Boolean).length,
)
const canSearch = computed(() => search.topic.trim().length >= 2 || search.category !== '')
const foundChannelById = computed(() => new Map((discovered.value?.channels ?? []).map((c) => [c.id, c])))
const foundResults = computed(() =>
  applyFilters(discovered.value?.videos ?? [], foundFilters.value, subscribersOf(discovered.value?.channels ?? [])),
)
const foundCategories = computed(() => categoriesOf(discovered.value?.videos ?? []))
const foundSummary = computed(() => {
  const total = discovered.value?.videos.length ?? 0
  const shown = foundResults.value.length
  const count = shown === total ? countOf(total, 'video', 'videos') : `${shown} de ${countOf(total, 'video', 'videos')}`
  return `${count} de ${searchedFor.value}. Gastó ${discovered.value?.quotaUsed} unidades.`
})

async function searchYouTube() {
  if (!canSearch.value || searching.value) return
  searching.value = true
  searchError.value = ''
  const topic = search.topic.trim()
  try {
    discovered.value = await $fetch('/api/search', {
      query: { q: topic, category: search.category, days: search.days, lang: search.lang, order: search.order },
    })
    searchedFor.value = [topic && `“${topic}”`, search.category && categoryName(search.category)].filter(Boolean).join(' en ')
    foundFilters.value = defaultFilters({ periodDays: 0, minScore: 0 })
  } catch (err) {
    // Lo anterior ya no responde a lo que pide el formulario: no se deja debajo del error.
    discovered.value = null
    searchError.value = messageOf(err)
  } finally {
    searching.value = false
  }
}

async function followChannel(channelId: string) {
  if (following.value) return
  following.value = channelId
  searchError.value = ''
  topicError.value = ''
  homeError.value = ''
  try {
    await $fetch('/api/channels', { method: 'POST', body: { input: channelId } })
    const found = discovered.value?.channels.find((c) => c.id === channelId)
    if (found) found.followed = true
    await refreshAll()
  } catch (err) {
    const message = messageOf(err)
    if (mode.value === 'trends') topicError.value = message
    else if (mode.value === 'home') homeError.value = message
    else searchError.value = message
  } finally {
    following.value = null
  }
}

// Es mi canal
const homeError = ref('')
const savingMine = ref<string | null>(null)

async function toggleMine(channel: Channel) {
  if (isDemo.value || savingMine.value) return
  savingMine.value = channel.id
  notice.value = null
  try {
    await $fetch(`/api/channels/${channel.id}/mine`, { method: 'POST', body: { mine: !channel.isMine } })
    await refreshAll()
  } catch (err) {
    notice.value = { kind: 'error', text: messageOf(err) }
  } finally {
    savingMine.value = null
  }
}

// Analizar un video frente a su canal
const analyzing = ref<{ video: ScoredVideo; channel?: Channel; videos: ScoredVideo[] | null; error: string } | null>(null)

/** Canal del video en la sección en la que se pidió el análisis. */
function channelFor(video: ScoredVideo): Channel | undefined {
  return channelById.value.get(video.channelId) ?? trendChannelById.value.get(video.channelId) ?? foundChannelById.value.get(video.channelId)
}

async function analyze(video: ScoredVideo) {
  const channel = channelFor(video)
  // Primero lo que ya está en el navegador: tus canales o la búsqueda de Descubrir.
  const own = videos.value.filter((v) => v.channelId === video.channelId)
  const found = (discovered.value?.context ?? []).filter((v) => v.channelId === video.channelId)
  const local = own.length > 0 ? own : found.length > 0 ? found : null
  analyzing.value = { video, channel, videos: local, error: '' }
  if (local) return
  // Los de Tendencias se guardaron con el tema: se leen sin gastar cuota.
  try {
    const res = await $fetch('/api/channel-videos', { query: { id: video.channelId } })
    if (analyzing.value?.video.id === video.id) analyzing.value = { video, channel, videos: res.videos, error: '' }
  } catch (err) {
    if (analyzing.value?.video.id === video.id) analyzing.value = { video, channel, videos: null, error: messageOf(err) }
  }
}

// Entrada con contraseña
const password = ref('')
const loginError = ref('')
const loggingIn = ref(false)

async function logIn() {
  if (!password.value || loggingIn.value) return
  loggingIn.value = true
  loginError.value = ''
  try {
    await $fetch('/api/login', { method: 'POST', body: { password: password.value } })
    password.value = ''
    await refreshAll()
  } catch (err) {
    loginError.value = messageOf(err)
  } finally {
    loggingIn.value = false
  }
}
</script>

<template>
  <div class="page" :class="{ 'page-public': needsLogin }">
    <header v-if="!needsLogin" class="nav">
      <a class="brand" href="/">
        <svg class="brand-mark" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
          <rect width="20" height="20" rx="6" fill="#ff6363" />
          <path d="M5 6v8M5 10h7" stroke="#040506" stroke-width="2" stroke-linecap="round" />
          <circle cx="13" cy="10" r="3" fill="#040506" />
        </svg>
        <span>AC Outliers</span>
      </a>

      <nav ref="modesEl" class="modes" :class="{ 'more-right': modesMore.right, 'more-left': modesMore.left }" aria-label="Sección" @scroll.passive="measureModes">
        <button type="button" :aria-pressed="mode === 'home'" @click="mode = 'home'">Inicio</button>
        <button v-if="hasMyChannel" type="button" :aria-pressed="mode === 'mine'" @click="mode = 'mine'">Mi canal</button>
        <button type="button" :aria-pressed="mode === 'trends'" @click="mode = 'trends'">Tendencias</button>
        <button type="button" :aria-pressed="mode === 'following'" @click="mode = 'following'">Tus canales</button>
        <button v-if="!isDemo" type="button" :aria-pressed="mode === 'discover'" @click="mode = 'discover'">Descubrir</button>
        <button type="button" :aria-pressed="mode === 'channels'" @click="mode = 'channels'">Comparar canales</button>
        <button v-if="!isDemo" type="button" :aria-pressed="mode === 'saved'" @click="mode = 'saved'">
          Guardados<span v-if="savedVideos.length > 0" class="count">{{ savedVideos.length }}</span>
        </button>
      </nav>

      <div class="nav-action">
        <button
          v-if="!isDemo"
          class="button button-primary"
          type="button"
          :disabled="busy !== null || (channels.length === 0 && topics.length === 0)"
          @click="updateAll"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d="M13.5 8a5.5 5.5 0 0 1-9.9 3.3M2.5 8a5.5 5.5 0 0 1 9.9-3.3M12.5 1.8v3h-3M3.5 14.2v-3h3"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="nav-action-label" :class="{ 'is-busy': busy === 'sync' }">{{ busy === 'sync' ? progress : 'Actualizar datos' }}</span>
        </button>
        <span v-else class="tag">Demo</span>
        <div v-if="me?.user" class="account">
          <button class="account-button" type="button" :aria-expanded="accountOpen" aria-label="Tu cuenta" @click="accountOpen = !accountOpen">
            <img v-if="me.user.picture" :src="me.user.picture" alt="" referrerpolicy="no-referrer" />
            <span v-else>{{ (me.user.name ?? me.user.email).charAt(0).toUpperCase() }}</span>
          </button>
          <div v-if="accountOpen" class="account-menu">
            <p><strong>{{ me.user.name ?? me.user.email }}</strong>{{ me.user.email }}</p>
            <p v-if="me.user.channelTitle">Canal: {{ me.user.channelTitle }}</p>
            <p v-else>Tu cuenta no tiene canal de YouTube.</p>
            <button class="button button-small" type="button" @click="logOut">Salir</button>
          </div>
        </div>
      </div>
    </header>

    <Landing v-if="needsLogin" :google="Boolean(me?.google)">
    <form class="login" @submit.prevent="logIn">
      <p class="login-brand">
        <svg class="brand-mark" viewBox="0 0 20 20" width="32" height="32" aria-hidden="true">
          <rect width="20" height="20" rx="6" fill="#ff6363" />
          <path d="M5 6v8M5 10h7" stroke="#040506" stroke-width="2" stroke-linecap="round" />
          <circle cx="13" cy="10" r="3" fill="#040506" />
        </svg>
        <span>AC Outliers</span>
      </p>
      <p class="login-lede">Videos que rindieron muy por encima de lo normal en su propio canal.</p>
      <template v-if="me?.google">
        <a class="button login-google" href="/api/auth/google">
          <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          Entrar con Google
        </a>
        <p v-if="route.query.login" class="notice notice-error" role="alert">{{ LOGIN_ERRORS[String(route.query.login)] ?? LOGIN_ERRORS.error }}</p>
        <p v-if="me?.password" class="login-or">o con la contraseña de la app</p>
      </template>
      <template v-if="!me?.google || me?.password">
        <label for="password">Contraseña</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" :disabled="loggingIn" />
        <button class="button" type="submit" :disabled="loggingIn">
          {{ loggingIn ? 'Entrando' : 'Entrar' }}
        </button>
      </template>
      <p v-if="loginError" class="notice notice-error" role="alert">{{ loginError }}</p>
    </form>
    </Landing>

    <div v-if="!needsLogin" class="masthead">
      <h1>{{ MODE_TITLES[mode] }}</h1>
      <p class="lede">{{ MODE_LEDES[mode] }}</p>
    </div>

    <div v-if="!needsLogin && (isDemo || isOpen || loadError)" class="banners">
      <p v-if="isDemo" class="banner">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M8 7.5v3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="8" cy="5" r="1" fill="currentColor" />
        </svg>
        <span>
          Estás viendo datos de ejemplo con canales inventados. Agrega tus claves en el archivo
          <code>.env</code> para seguir canales reales.
        </span>
      </p>
      <p v-if="isOpen" class="banner banner-warn">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M8 2.25 14.25 13H1.75Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          <path d="M8 6.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <circle cx="8" cy="11.25" r="0.9" fill="currentColor" />
        </svg>
        <span>
          Esta app no tiene contraseña. Si está publicada en internet, define <code>NUXT_APP_PASSWORD</code>
          para que nadie más gaste tu cuota de YouTube.
        </span>
      </p>
      <p v-if="loadError" class="banner banner-error" role="alert">
        {{ loadError.data?.message ?? 'No se pudieron cargar los datos. Revisa la terminal del servidor.' }}
      </p>
    </div>

    <section v-if="!needsLogin && mode === 'following'" class="channels" aria-labelledby="channels-title">
      <div class="section-head">
        <div>
          <h2 id="channels-title">Canales que sigues</h2>
          <p class="section-sub">
            {{ channels.length > 0 ? 'Toca un canal para ver solo sus videos.' : 'Agrega los canales de tu nicho, o los tuyos.' }}
          </p>
        </div>

      <form v-if="!isDemo" class="add" @submit.prevent="addChannel">
        <label class="sr-only" for="new-channel">Canal de YouTube</label>
        <input
          id="new-channel"
          v-model="newChannel"
          type="text"
          placeholder="@usuario o enlace del canal"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          :disabled="busy !== null"
        />
        <button class="button" type="submit" :disabled="busy !== null">
          {{ busy === 'add' ? 'Agregando' : 'Agregar canal' }}
        </button>
      </form>
      </div>

      <div v-if="channels.length > 0" class="channel-row">
        <ul class="chips">
          <li v-for="c in channels" :key="c.id" class="chip" :class="{ 'chip-on': onlyChannel === c.id }">
            <button
              class="chip-main"
              type="button"
              :aria-pressed="onlyChannel === c.id"
              :title="onlyChannel === c.id ? 'Ver todos los canales' : `Ver solo ${c.title}`"
              @click="onlyChannel === c.id ? (onlyChannel = null) : showChannel(c.id)"
            >
              <span v-if="onlyChannel === c.id" class="avatar avatar-check" aria-hidden="true">
                <svg viewBox="0 0 12 12" width="12" height="12">
                  <path d="M2.5 6.25 5 8.75l4.5-5.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <img v-else-if="c.thumbnailUrl" class="avatar" :src="c.thumbnailUrl" alt="" loading="lazy" />
              <span v-else class="avatar avatar-blank" aria-hidden="true">{{ c.title.charAt(0) }}</span>
              <span class="chip-name">{{ c.title }}</span>
              <span v-if="c.isMine" class="badge">Tuyo</span>
              <span v-if="c.subscriberCount" class="chip-subs">{{ compact.format(c.subscriberCount) }}</span>
            </button>
            <button
              class="chip-mine"
              type="button"
              :aria-pressed="c.isMine"
              :aria-label="`Es mi canal: ${c.title}`"
              :aria-disabled="isDemo || savingMine !== null ? 'true' : undefined"
              :title="isDemo ? 'No disponible en modo demo' : c.isMine ? 'Ya no es mi canal' : 'Es mi canal'"
              @click="toggleMine(c)"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <circle cx="8" cy="5.5" r="2.75" :fill="c.isMine ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5" />
                <path
                  d="M2.75 13.75c.6-2.6 2.7-4 5.25-4s4.65 1.4 5.25 4"
                  :fill="c.isMine ? 'currentColor' : 'none'"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <button
              v-if="!isDemo"
              class="chip-remove"
              type="button"
              :aria-label="`Quitar ${c.title}`"
              :disabled="busy !== null"
              @click="removeChannel(c)"
            >
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </li>
        </ul>

      </div>

      <p v-if="notice" class="notice" :class="`notice-${notice.kind}`" :role="notice.kind === 'error' ? 'alert' : 'status'">
        {{ notice.text }}
      </p>
    </section>

    <section v-if="!needsLogin" id="seccion" class="ranking" aria-labelledby="ranking-title">
      <h2 id="ranking-title" class="sr-only">Videos y canales</h2>

      <!-- Mi canal: YouTube Analytics de la cuenta que entró con Google -->
      <MyChannel v-if="mode === 'mine'" />

      <!-- Inicio: lo que pasó en tus canales y tus temas -->
      <HomeFeed
        v-else-if="mode === 'home'"
        :videos="videos"
        :channels="channels"
        :channel-by-id="channelById"
        :topics="topics"
        :topic-label="topicLabel"
        :trend-videos="trendVideos"
        :trend-channels="trendChannels"
        :momentum="homeData?.momentum ?? {}"
        :history="homeData?.history ?? {}"
        :is-demo="isDemo"
        :following="following"
        :error="homeError"
        @analyze="analyze"
        @follow="followChannel"
        @go="mode = $event"
      />

      <!-- Tendencias: temas que sigues en todo YouTube -->
      <template v-else-if="mode === 'trends'">
        <template v-if="!isDemo">
          <form class="ask" @submit.prevent="addTopic">
            <label class="ask-label" for="new-topic">Tema</label>
            <input
              id="new-topic"
              v-model="newTopic.query"
              type="search"
              placeholder="ej. edición en DaVinci"
              aria-label="Tema que quieres seguir"
              autocomplete="off"
              :disabled="topicBusy"
            />
            <label class="tool tool-select" :class="{ 'is-active': newTopic.category !== '' }">
              <span class="tool-label" aria-hidden="true">Categoría</span>
              <select v-model="newTopic.category" aria-label="Categoría" :disabled="topicBusy">
                <option value="">Todas</option>
                <option v-for="c in CATEGORY_OPTIONS" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </label>
            <button class="button" type="submit" :disabled="topicBusy">
              {{ topicBusy ? 'Buscando' : 'Seguir tema' }}
            </button>
          </form>
          <div class="form-foot">
            <p class="form-note">
              Cada tema se refresca una vez al día y gasta unas <span class="num">150</span> unidades; abrir esta pestaña no gasta nada.
            </p>
            <ul class="chips topics" aria-label="Temas que sigues">
                <li v-for="t in topics" :key="t.id" class="chip" :class="{ 'chip-on': onlyTopic === t.id }">
                  <button
                    class="chip-main chip-plain"
                    type="button"
                    :aria-pressed="onlyTopic === t.id"
                    :title="onlyTopic === t.id ? 'Ver todos los temas' : `Ver solo ${topicLabel(t)}`"
                    @click="onlyTopic = onlyTopic === t.id ? null : t.id"
                  >
                    <span class="chip-name">{{ topicLabel(t) }}</span>
                    <span class="chip-subs">{{ t.count }}</span>
                  </button>
                  <button class="chip-remove" type="button" :aria-label="`Dejar de seguir ${topicLabel(t)}`" :disabled="topicBusy" @click="removeTopic(t)">
                    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    </svg>
                  </button>
                </li>
              </ul>
          </div>
          <p v-if="topicError" class="banner banner-error form-error" role="alert">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
              <path d="M8 4.75v3.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <circle cx="8" cy="11" r="1" fill="currentColor" />
            </svg>
            <span class="form-error-text">{{ topicError }}</span>
          </p>
        </template>

        <template v-if="trendVideos.length > 0">
          <FilterBar v-model="trendFilters" v-model:view="view" :categories="trendCategories" :defaults="defaultFilters(FOUND_DEFAULTS)" />
          <VideoResults
            v-if="trendResults.length > 0"
            v-model:view="view"
            :videos="trendResults"
            :channels="trendChannelById"
            :summary="trendSummary"
            @analyze="analyze"
          >
            <template #action="{ video }">
              <FollowButton :channel="trendChannelById.get(video.channelId)" :busy-id="following" :demo="isDemo" @follow="followChannel" />
            </template>
          </VideoResults>
          <div v-else class="empty">
            <p class="empty-title">Ningún video cumple estos filtros</p>
            <p>Quita algún filtro o elige otro tema.</p>
            <button
              v-if="differs(trendFilters, defaultFilters(FOUND_DEFAULTS))"
              class="button"
              type="button"
              @click="trendFilters = defaultFilters(FOUND_DEFAULTS)"
            >
              Restablecer filtros
            </button>
          </div>
        </template>

        <template v-else-if="rising.length > 0">
          <VideoResults
            v-model:view="view"
            :videos="rising"
            :channels="channelById"
            heading="En alza en tus canales"
            summary="Lo que más rápido suma vistas entre lo publicado en los últimos 30 días"
            own-switch
            @analyze="analyze"
          />
        </template>

        <div v-else-if="!loadError" class="empty">
          <p class="empty-title">Todavía no hay tendencias</p>
          <p>Sigue un tema arriba para ver qué está pegando en tu nicho, o agrega canales en “Tus canales” para ver los suyos.</p>
          <p v-if="!isDemo" class="empty-actions">
            <button class="button" type="button" @click="focusField('new-topic')">Seguir un tema</button>
            <button class="link-button" type="button" @click="mode = 'following'">Ir a Tus canales</button>
          </p>
        </div>
      </template>

      <!-- Ranking de los canales que sigues -->
      <template v-else-if="mode === 'following'">
        <FilterBar v-model="filters" v-model:view="view" :categories="categories" show-format show-period />

        <VideoResults
          v-if="results.length > 0"
          v-model:view="view"
          :videos="results"
          :channels="channelById"
          :summary="summary"
          @analyze="analyze"
        >
          <template v-if="words.length > 0" #aside>
            <p class="words">
              <span>Se repite en los títulos</span>
              <button v-for="w in words" :key="w.word" type="button" class="word" @click="filters.title = w.word">
                {{ w.word }} <span class="dim">{{ w.count }}</span>
              </button>
            </p>
          </template>
        </VideoResults>

        <div v-else-if="!loadError" class="empty">
          <template v-if="channels.length === 0">
            <p class="empty-title">Todavía no sigues ningún canal</p>
            <p>Agrega arriba los canales de tu nicho, o los tuyos, para ver qué videos se salieron de lo normal.</p>
            <button v-if="!isDemo" class="button" type="button" @click="focusField('new-channel')">Agregar canal</button>
          </template>
          <template v-else>
            <p class="empty-title">Ningún video cumple estos filtros</p>
            <p>Baja el score mínimo, amplía el periodo o quita algún filtro.</p>
            <p class="empty-actions">
              <button
                v-if="filters.minScore !== 0 || filters.periodDays !== 0"
                class="button"
                type="button"
                @click="Object.assign(filters, { minScore: 0, periodDays: 0 })"
              >
                Ver todos los videos
              </button>
              <button v-if="differs(filters, defaultFilters())" class="link-button" type="button" @click="filters = defaultFilters()">
                Restablecer filtros
              </button>
            </p>
          </template>
        </div>
      </template>

      <!-- Guardados -->
      <template v-else-if="mode === 'saved'">
        <form class="ask" @submit.prevent="addCollection">
          <label class="ask-label" for="new-collection">Nueva</label>
          <input
            id="new-collection"
            v-model="newCollection"
            type="text"
            maxlength="40"
            placeholder="ej. Ideas para OBS"
            autocomplete="off"
            :disabled="collectionBusy"
          />
          <button class="button" type="submit" :disabled="collectionBusy || !newCollection.trim()">Crear colección</button>
        </form>
        <div class="form-foot">
          <p class="form-note">Agrupa tus guardados. Cada video va en una colección o en ninguna; eliminar una colección no borra sus videos.</p>
          <ul v-if="collections.length > 0" class="chips topics" aria-label="Colecciones">
            <li v-for="c in collections" :key="c.id" class="chip" :class="{ 'chip-on': onlyCollection === c.id }">
              <button
                class="chip-main chip-plain"
                type="button"
                :aria-pressed="onlyCollection === c.id"
                @click="onlyCollection = onlyCollection === c.id ? null : c.id"
              >
                <span class="chip-name">{{ c.name }}</span>
                <span class="chip-subs">{{ collectionCount(c.id) }}</span>
              </button>
              <button class="chip-remove" type="button" :aria-label="`Eliminar la colección ${c.name}`" :disabled="collectionBusy" @click="removeCollection(c)">
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </button>
            </li>
            <li v-if="collectionCount(null) > 0" class="chip" :class="{ 'chip-on': onlyCollection === 'none' }">
              <button
                class="chip-main chip-plain"
                type="button"
                :aria-pressed="onlyCollection === 'none'"
                @click="onlyCollection = onlyCollection === 'none' ? null : 'none'"
              >
                <span class="chip-name">Sin colección</span>
                <span class="chip-subs">{{ collectionCount(null) }}</span>
              </button>
            </li>
          </ul>
        </div>
        <p v-if="collectionError" class="banner banner-error form-error" role="alert">
          <span class="form-error-text">{{ collectionError }}</span>
        </p>

        <VideoResults
          v-if="savedShown.length > 0"
          v-model:view="view"
          :videos="savedShown"
          :channels="savedChannelById"
          :summary="savedSummary"
          own-switch
          @analyze="analyze"
        >
          <template v-if="collections.length > 0" #meta="{ video }">
            <label class="tool tool-select tool-small" :class="{ 'is-active': collectionOf(video) !== '' }">
              <span class="sr-only">Colección de “{{ video.title }}”</span>
              <select :value="collectionOf(video)" :disabled="collectionBusy" @change="moveToCollection(video, ($event.target as HTMLSelectElement).value)">
                <option value="">Sin colección</option>
                <option v-for="c in collections" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </label>
          </template>
        </VideoResults>
        <div v-else-if="savedVideos.length > 0" class="empty">
          <p class="empty-title">Esta colección está vacía</p>
          <p>Elige la colección en cualquier video guardado para moverlo aquí.</p>
          <button class="button" type="button" @click="onlyCollection = null">Ver todos los guardados</button>
        </div>
        <div v-else class="empty">
          <p class="empty-title">Todavía no guardas ningún video</p>
          <p>Pulsa “Guardar” en cualquier video de la app, o bajo el título de un video en YouTube con la extensión.</p>
        </div>
      </template>

      <!-- Descubrir en todo YouTube -->
      <template v-else-if="mode === 'discover'">
        <form class="ask" @submit.prevent="searchYouTube">
          <label class="ask-label" for="search-topic">Tema</label>
          <input
            id="search-topic"
            v-model="search.topic"
            type="search"
            placeholder="ej. edición en DaVinci"
            autocomplete="off"
            :disabled="searching"
          />
          <button class="button ask-options-toggle" type="button" :aria-expanded="optionsOpen" @click="optionsOpen = !optionsOpen">
            Opciones<span v-if="changedOptions > 0" class="count">{{ changedOptions }}</span>
            <svg viewBox="0 0 10 6" width="10" height="6" aria-hidden="true">
              <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="button ask-submit" type="submit" :disabled="searching">
            {{ searching ? 'Buscando' : 'Buscar en YouTube' }}
          </button>
        </form>
        <div v-if="optionsOpen" class="toolbar-extra ask-panel">
          <label class="tool tool-select" :class="{ 'is-active': search.category !== '' }">
            <span class="tool-label" aria-hidden="true">Categoría</span>
            <select v-model="search.category" aria-label="Categoría" :disabled="searching">
              <option value="">Todas</option>
              <option v-for="c in CATEGORY_OPTIONS" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="tool tool-select" :class="{ 'is-active': search.days !== 90 }">
            <span class="tool-label" aria-hidden="true">Publicados en</span>
            <select v-model.number="search.days" aria-label="Publicados en" :disabled="searching">
              <option :value="7">7 días</option>
              <option :value="30">30 días</option>
              <option :value="90">90 días</option>
              <option :value="365">1 año</option>
              <option :value="0">Cualquier fecha</option>
            </select>
          </label>
          <label class="tool tool-select" :class="{ 'is-active': search.lang !== 'es' }">
            <span class="tool-label" aria-hidden="true">Idioma</span>
            <select v-model="search.lang" aria-label="Idioma" :disabled="searching">
              <option value="es">Español primero</option>
              <option value="">Cualquiera</option>
            </select>
          </label>
          <label class="tool tool-select" :class="{ 'is-active': search.order !== 'relevance' }">
            <span class="tool-label" aria-hidden="true">Traer</span>
            <select v-model="search.order" aria-label="Traer" :disabled="searching">
              <option value="relevance">Los más relevantes</option>
              <option value="viewCount">Los más vistos</option>
            </select>
          </label>
        </div>
        <p class="form-note">Cada búsqueda gasta unas <span class="num">150</span> de las <span class="num">10.000</span> unidades diarias.</p>
        <p v-if="searchError" class="banner banner-error form-error" role="alert">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path d="M8 4.75v3.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="8" cy="11" r="1" fill="currentColor" />
          </svg>
          <span class="form-error-text">{{ searchError }} <span class="form-error-next">Vuelve a intentarlo más tarde o revisa tu cuota en Google Cloud.</span></span>
          <button class="button button-small form-error-action" type="button" :disabled="searching" @click="searchYouTube">Reintentar</button>
        </p>

        <template v-if="discovered">
          <template v-if="discovered.videos.length > 0">
            <FilterBar v-model="foundFilters" v-model:view="view" :categories="foundCategories" :defaults="defaultFilters(FOUND_DEFAULTS)" />

            <VideoResults
              v-if="foundResults.length > 0"
              v-model:view="view"
              :videos="foundResults"
              :channels="foundChannelById"
              :summary="foundSummary"
              @analyze="analyze"
            >
              <template #action="{ video }">
                <FollowButton :channel="foundChannelById.get(video.channelId)" :busy-id="following" @follow="followChannel" />
              </template>
            </VideoResults>

            <div v-else class="empty">
              <p class="empty-title">Ningún resultado cumple estos filtros</p>
              <p>La búsqueda trajo {{ countOf(discovered.videos.length, 'video', 'videos') }}. Quita algún filtro para verlos.</p>
              <button
                v-if="differs(foundFilters, defaultFilters(FOUND_DEFAULTS))"
                class="button"
                type="button"
                @click="foundFilters = defaultFilters(FOUND_DEFAULTS)"
              >
                Restablecer filtros
              </button>
            </div>
          </template>

          <div v-else class="empty">
            <p class="empty-title">No hay videos largos de {{ searchedFor }}</p>
            <p>Prueba con otras palabras, otra categoría o un periodo más amplio.</p>
          </div>
        </template>
      </template>

      <!-- Comparar canales -->
      <template v-else>
        <template v-if="channels.length > 0">
          <p class="table-hint">Ordénalos por cualquier columna, o toca un canal para ver sus videos.</p>
          <ChannelTable :stats="stats" @select="showChannel" />
        </template>
        <div v-else class="empty">
          <p class="empty-title">Todavía no sigues ningún canal</p>
          <p>Agrega al menos dos canales en “Tus canales” para compararlos.</p>
          <button v-if="!isDemo" class="button" type="button" @click="focusField('new-channel', 'following')">Agregar canal</button>
        </div>
      </template>
    </section>

    <AnalysisPanel
      :video="analyzing?.video ?? null"
      :channel="analyzing?.channel"
      :channel-videos="analyzing?.videos ?? null"
      :error="analyzing?.error"
      @close="analyzing = null"
    />
  </div>
</template>
