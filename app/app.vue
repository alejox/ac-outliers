<script setup lang="ts">
import type { Channel, ScoredVideo, Topic } from '~~/shared/outliers'
import { CATEGORY_OPTIONS, categoryName } from '~~/shared/categories'
import { channelStats } from '~~/shared/channel-stats'
import { applyFilters, defaultFilters, topWords } from '~~/shared/filters'

type Mode = 'trends' | 'following' | 'discover' | 'channels'
type FoundChannel = Channel & { followed: boolean }
type TrendTopic = Topic & { count: number }
type TrendVideo = ScoredVideo & { topicIds: string[] }

const { data, error: loadError, refresh } = await useFetch('/api/outliers')
const { data: trendData, refresh: refreshTrends } = await useFetch('/api/trends')

const channels = computed<Channel[]>(() => data.value?.channels ?? [])
const videos = computed<ScoredVideo[]>(() => data.value?.videos ?? [])
const isDemo = computed(() => data.value?.demo ?? false)
const isOpen = computed(() => data.value?.open ?? false)
const needsLogin = computed(() => loadError.value?.statusCode === 401)
const channelById = computed(() => new Map(channels.value.map((c) => [c.id, c])))

const mode = ref<Mode>('trends')
const MODE_TITLES: Record<Mode, string> = {
  trends: 'Tendencias',
  following: 'Tus canales',
  discover: 'Descubrir',
  channels: 'Comparar canales',
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
    await Promise.all([refresh(), refreshTrends()])
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
    await Promise.all([refresh(), refreshTrends()])
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
    await Promise.all([refresh(), refreshTrends()])
    busy.value = null
    progress.value = ''
  }
}

// Descubrir en todo YouTube
const search = reactive({ topic: '', category: '', days: 90, lang: 'es', order: 'relevance' })
const searching = ref(false)
const searchError = ref('')
const searchedFor = ref('')
const discovered = ref<{ channels: FoundChannel[]; videos: ScoredVideo[]; quotaUsed: number } | null>(null)
const following = ref<string | null>(null)
const foundFilters = ref(defaultFilters({ periodDays: 0, minScore: 0 }))

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
  try {
    await $fetch('/api/channels', { method: 'POST', body: { input: channelId } })
    const found = discovered.value?.channels.find((c) => c.id === channelId)
    if (found) found.followed = true
    await Promise.all([refresh(), refreshTrends()])
  } catch (err) {
    const message = messageOf(err)
    if (mode.value === 'trends') topicError.value = message
    else searchError.value = message
  } finally {
    following.value = null
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
    await Promise.all([refresh(), refreshTrends()])
  } catch (err) {
    loginError.value = messageOf(err)
  } finally {
    loggingIn.value = false
  }
}
</script>

<template>
  <div class="page" :class="{ 'page-login': needsLogin }">
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
        <button type="button" :aria-pressed="mode === 'trends'" @click="mode = 'trends'">Tendencias</button>
        <button type="button" :aria-pressed="mode === 'following'" @click="mode = 'following'">Tus canales</button>
        <button v-if="!isDemo" type="button" :aria-pressed="mode === 'discover'" @click="mode = 'discover'">Descubrir</button>
        <button type="button" :aria-pressed="mode === 'channels'" @click="mode = 'channels'">Comparar canales</button>
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
      </div>
    </header>

    <form v-if="needsLogin" class="login" @submit.prevent="logIn">
      <p class="login-brand">
        <svg class="brand-mark" viewBox="0 0 20 20" width="32" height="32" aria-hidden="true">
          <rect width="20" height="20" rx="6" fill="#ff6363" />
          <path d="M5 6v8M5 10h7" stroke="#040506" stroke-width="2" stroke-linecap="round" />
          <circle cx="13" cy="10" r="3" fill="#040506" />
        </svg>
        <span>AC Outliers</span>
      </p>
      <p class="login-lede">Videos que rindieron muy por encima de lo normal en su propio canal.</p>
      <label for="password">Contraseña</label>
      <input id="password" v-model="password" type="password" autocomplete="current-password" :disabled="loggingIn" />
      <button class="button button-primary" type="submit" :disabled="loggingIn">
        {{ loggingIn ? 'Entrando' : 'Entrar' }}
      </button>
      <p v-if="loginError" class="notice notice-error" role="alert">{{ loginError }}</p>
    </form>

    <div v-if="!needsLogin" class="masthead">
      <h1>{{ MODE_TITLES[mode] }}</h1>
      <p class="lede">Videos que rindieron muy por encima de lo normal en su propio canal.</p>
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

    <section v-if="!needsLogin" class="channels" aria-labelledby="channels-title">
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
              <span v-if="c.subscriberCount" class="chip-subs">{{ compact.format(c.subscriberCount) }}</span>
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

      <!-- Tendencias: temas que sigues en todo YouTube -->
      <template v-if="mode === 'trends'">
        <template v-if="!isDemo">
          <form class="discover" @submit.prevent="addTopic">
            <label class="field field-text">
              <span>Tema que quieres seguir</span>
              <input v-model="newTopic.query" type="search" placeholder="plugins de OBS" autocomplete="off" :disabled="topicBusy" />
            </label>
            <label class="field">
              <span>Categoría</span>
              <select v-model="newTopic.category" :disabled="topicBusy">
                <option value="">Todas</option>
                <option v-for="c in CATEGORY_OPTIONS" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </label>
            <button class="button" type="submit" :disabled="topicBusy">
              {{ topicBusy ? 'Buscando' : 'Seguir tema' }}
            </button>
          </form>
          <p class="hint">
            Cada tema se busca en todo YouTube entre lo publicado en los últimos 30 días y se refresca una vez al día.
            Gasta unas 150 unidades de cuota por refresco; abrir esta pestaña no gasta nada.
          </p>
          <p v-if="topicError" class="notice notice-error" role="alert">{{ topicError }}</p>

          <ul v-if="topics.length > 0" class="chips topics">
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
        </template>

        <template v-if="trendVideos.length > 0">
          <FilterBar v-model="trendFilters" v-model:view="view" :categories="trendCategories" />
          <VideoResults
            v-if="trendResults.length > 0"
            v-model:view="view"
            :videos="trendResults"
            :channels="trendChannelById"
            :summary="trendSummary"
          >
            <template #action="{ video }">
              <FollowButton :channel="trendChannelById.get(video.channelId)" :busy-id="following" @follow="followChannel" />
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
          />
        </template>

        <div v-else-if="!loadError" class="empty">
          <p class="empty-title">Todavía no hay tendencias</p>
          <p>Sigue un tema arriba para ver qué está pegando en tu nicho, o agrega canales para ver los suyos.</p>
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
          </template>
          <template v-else>
            <p class="empty-title">Ningún video cumple estos filtros</p>
            <p>Baja el score mínimo, amplía el periodo o quita algún filtro.</p>
            <button v-if="differs(filters, defaultFilters())" class="button" type="button" @click="filters = defaultFilters()">
              Restablecer filtros
            </button>
          </template>
        </div>
      </template>

      <!-- Descubrir en todo YouTube -->
      <template v-else-if="mode === 'discover'">
        <form class="discover" @submit.prevent="searchYouTube">
          <label class="field field-text">
            <span>Tema</span>
            <input v-model="search.topic" type="search" placeholder="plugins de OBS" autocomplete="off" :disabled="searching" />
          </label>
          <label class="field">
            <span>Categoría</span>
            <select v-model="search.category" :disabled="searching">
              <option value="">Todas</option>
              <option v-for="c in CATEGORY_OPTIONS" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <label class="field">
            <span>Publicados en</span>
            <select v-model.number="search.days" :disabled="searching">
              <option :value="7">7 días</option>
              <option :value="30">30 días</option>
              <option :value="90">90 días</option>
              <option :value="365">1 año</option>
              <option :value="0">Cualquier fecha</option>
            </select>
          </label>
          <label class="field">
            <span>Idioma</span>
            <select v-model="search.lang" :disabled="searching">
              <option value="es">Español primero</option>
              <option value="">Cualquiera</option>
            </select>
          </label>
          <label class="field">
            <span>Traer</span>
            <select v-model="search.order" :disabled="searching">
              <option value="relevance">Los más relevantes</option>
              <option value="viewCount">Los más vistos</option>
            </select>
          </label>
          <button class="button" type="submit" :disabled="searching">
            {{ searching ? 'Buscando' : 'Buscar en YouTube' }}
          </button>
        </form>
        <p class="hint">
          Busca videos largos en todo YouTube por tema, por categoría o por ambos, y los compara con lo normal de su
          canal. Cada búsqueda gasta unas 150 de las 10.000 unidades diarias de tu cuota.
        </p>
        <p v-if="searchError" class="notice notice-error" role="alert">{{ searchError }}</p>

        <template v-if="discovered">
          <template v-if="discovered.videos.length > 0">
            <FilterBar v-model="foundFilters" v-model:view="view" :categories="foundCategories" />

            <VideoResults
              v-if="foundResults.length > 0"
              v-model:view="view"
              :videos="foundResults"
              :channels="foundChannelById"
              :summary="foundSummary"
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
          <p class="hint">
            Cómo le va a cada canal que sigues. Toca un encabezado para ordenar, o un canal para ver sus videos.
          </p>
          <ChannelTable :stats="stats" @select="showChannel" />
        </template>
        <div v-else class="empty">
          <p class="empty-title">Todavía no sigues ningún canal</p>
          <p>Agrega al menos dos canales arriba para compararlos.</p>
        </div>
      </template>
    </section>
  </div>
</template>
