<script setup lang="ts">
import { channelAchievements, type Achievement, type ChannelSnapshot } from '~~/shared/achievements'
import {
  currentOutliers,
  largestMine,
  momentumTrend,
  newOutliers,
  recentHits,
  rememberSeen,
  sinceLabel,
  suggestCompetitors,
  type MomentumPoint,
} from '~~/shared/home'
import type { Channel, ScoredVideo, Topic } from '~~/shared/outliers'

type FoundChannel = Channel & { followed: boolean }

const props = defineProps<{
  videos: ScoredVideo[]
  channels: Channel[]
  channelById: Map<string, Channel>
  topics: Topic[]
  topicLabel: (t: Topic) => string
  trendVideos: ScoredVideo[]
  trendChannels: FoundChannel[]
  momentum: Record<string, MomentumPoint[]>
  history: Record<string, ChannelSnapshot[]>
  isDemo: boolean
  following: string | null
  error?: string
}>()
defineEmits<{ analyze: [video: ScoredVideo]; follow: [channelId: string]; go: [mode: 'following' | 'trends'] }>()

// Novedades desde tu última visita. Se recuerdan en este navegador: qué outliers ya viste y cuándo.
// Durante la misma sesión se compara siempre con la visita anterior, así recargar no las borra.
const SEEN_KEY = 'ac-outliers:vistos'
const BASE_KEY = 'ac-outliers:novedades-base'
const NEWS_SHOWN = 6
const news = ref<ScoredVideo[]>([])
const lastVisit = ref<number | null>(null)
const firstVisit = ref(false)
const allNews = ref(false)
const allChannels = computed(() => {
  const map = new Map<string, Channel>(props.trendChannels.map((c) => [c.id, c]))
  for (const [id, c] of props.channelById) map.set(id, c)
  return map
})
onMounted(() => {
  try {
    let base = JSON.parse(sessionStorage.getItem(BASE_KEY) ?? 'null') as { ids: string[] | null; at: number | null } | null
    if (!base) {
      const stored = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null') as { ids: string[]; at: number } | null
      base = { ids: stored?.ids ?? null, at: stored?.at ?? null }
      sessionStorage.setItem(BASE_KEY, JSON.stringify(base))
    }
    const seen = base.ids ? new Set(base.ids) : null
    const current = currentOutliers(props.videos, props.trendVideos)
    news.value = newOutliers(current, seen)
    lastVisit.value = base.at
    firstVisit.value = seen === null
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ids: rememberSeen(current, seen), at: Date.now() }))
  } catch {
    // Sin almacenamiento del navegador (modo privado estricto): no hay novedades que mostrar.
  }
})
const newsShown = computed(() => (allNews.value ? news.value : news.value.slice(0, NEWS_SHOWN)))
const newsIds = computed(() => new Set(news.value.map((v) => v.id)))
const isOwn = (v: ScoredVideo) => props.channelById.has(v.channelId)

// a. Éxitos recientes (sin repetir lo que ya sale en Novedades)
const hits = computed(() => recentHits(props.videos.filter((v) => !newsIds.value.has(v.id))))

// b. Impulso de tus temas
const momentumRows = computed(() =>
  props.topics.map((topic) => {
    const series = [...(props.momentum[topic.id] ?? [])].sort((a, b) => a.date.localeCompare(b.date))
    return { topic, label: props.topicLabel(topic), series, trend: momentumTrend(series) }
  }),
)
const sparkLabel = (row: (typeof momentumRows.value)[number]) => {
  const first = row.series[0]!
  const last = row.series[row.series.length - 1]!
  return `Impulso de ${row.label} en los últimos ${row.series.length} días: de ${formatPace(first.momentum)} a ${formatPace(last.momentum)} vistas por hora`
}

// c. Competidores sugeridos
const mineSubs = computed(() => largestMine(props.channels))
const suggestions = computed(() => suggestCompetitors(props.trendVideos, props.trendChannels, mineSubs.value))
const similarShown = computed(() => suggestions.value.some((s) => s.similarSize))

// d. Tus logros
const mine = computed(() => props.channels.filter((c) => c.isMine))
const trophies = computed(() =>
  mine.value.map((channel) => {
    const groups = channelAchievements(channel, props.videos, props.history[channel.id] ?? [])
    const of = (key: string) => groups.find((g) => g.key === key)!.items
    const own = props.videos.filter((v) => v.channelId === channel.id)
    const history = props.history[channel.id] ?? []
    return {
      channel,
      columns: [
        [{ title: 'Suscriptores', items: of('subscribers'), empty: channel.subscriberCount === null && !history.some((s) => s.subscriberCount !== null) ? 'El canal oculta sus suscriptores.' : '' }],
        [{ title: 'Videos', items: of('videos'), empty: own.length === 0 ? 'Todavía no hay videos guardados de este canal. Pulsa “Actualizar datos”.' : '' }],
        [
          { title: 'Vistas del canal', items: of('views'), empty: channel.viewCount === null && !history.some((s) => s.viewCount !== null) ? 'Sin datos de vistas todavía. Pulsa “Actualizar datos”.' : '' },
          { title: 'Constancia', items: of('consistency'), empty: own.length === 0 && !channel.videoCount ? 'Sin videos guardados todavía.' : '' },
        ],
      ],
    }
  }),
)

const videoLink = (v: { id: string; isShort: boolean }) =>
  v.isShort ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`

function title(a: Achievement): string {
  switch (a.kind) {
    case 'subscribers':
      return `${milestoneLabel(a.value)} ${a.value >= 1_000_000 ? 'de suscriptores' : 'suscriptores'}`
    case 'views':
      return `${milestoneLabel(a.value)} ${a.value >= 1_000_000 ? 'de vistas' : 'vistas'} en el canal`
    case 'score':
      return `Primer video a ${formatScore(a.value)}`
    case 'videoViews':
      return `Primer video con ${milestoneLabel(a.value)} vistas`
    case 'record':
      return a.achieved ? `Récord: ${formatScore(a.value)}` : 'Récord: sin videos con score'
    case 'mostViewed':
      return a.achieved ? `Más visto: ${compact.format(a.value)} vistas` : 'Más visto: sin videos'
    case 'streak':
      return a.value > 0
        ? `Racha: ${a.value === 1 ? '1 semana' : `${a.value} semanas`} seguidas subiendo`
        : 'Racha: sin subidas la semana pasada'
    case 'total':
      return `${a.value.toLocaleString('es')} videos publicados`
  }
}

function remaining(a: Achievement): string {
  const p = a.progress!
  if (a.kind === 'score') return `Tu récord: ${formatScore(p.current)}`
  const unit = a.kind === 'subscribers' ? ' suscriptores' : ' vistas'
  return `Faltan ${compact.format(p.remaining)}${unit}`
}

const anything = computed(
  () => news.value.length > 0 || hits.value.length > 0 || props.topics.length > 0 || suggestions.value.length > 0 || mine.value.length > 0,
)
</script>

<template>
  <div v-if="anything" class="feed">
    <p v-if="error" class="banner banner-error feed-error" role="alert">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path d="M8 4.75v3.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <circle cx="8" cy="11" r="1" fill="currentColor" />
      </svg>
      <span class="form-error-text">{{ error }}</span>
    </p>

    <!-- Novedades desde tu última visita -->
    <section v-if="news.length > 0" class="feed-block" aria-labelledby="feed-news">
      <div class="results-head">
        <div class="results-title">
          <h3 id="feed-news" class="subhead">Novedades desde tu última visita</h3>
          <p class="summary">
            {{ news.length === 1 ? '1 video nuevo llegó' : `${news.length} videos nuevos llegaron` }} a 2× o más en tus canales y tus temas<template v-if="lastVisit"> desde {{ sinceLabel(Date.now() - lastVisit) }}</template>
          </p>
        </div>
      </div>
      <ol class="videos">
        <VideoRow v-for="v in newsShown" :key="v.id" :video="v" :channel="allChannels.get(v.channelId)" @analyze="$emit('analyze', $event)">
          <template #lead>
            <img v-if="allChannels.get(v.channelId)?.thumbnailUrl" class="avatar" :src="allChannels.get(v.channelId)!.thumbnailUrl!" alt="" loading="lazy" />
            <span v-else class="avatar avatar-blank" aria-hidden="true">{{ allChannels.get(v.channelId)?.title.charAt(0) }}</span>
            <span class="video-lead-text">
              <strong>{{ allChannels.get(v.channelId)?.title }}</strong> {{ isOwn(v) ? 'tiene un nuevo outlier' : 'tiene un nuevo outlier en tus temas' }}
            </span>
            <span class="video-lead-age">{{ formatAge(v.ageDays) }}</span>
          </template>
        </VideoRow>
      </ol>
      <button v-if="news.length > NEWS_SHOWN" class="link-button feed-more" type="button" @click="allNews = !allNews">
        {{ allNews ? 'Ver menos' : `Ver las ${news.length} novedades` }}
      </button>
    </section>
    <p v-else-if="lastVisit && !firstVisit" class="feed-quiet">
      Nada nuevo desde tu última visita, {{ sinceLabel(Date.now() - lastVisit) }}: ningún video de tus canales o tus temas cruzó 2× en ese tiempo.
    </p>

    <!-- a. Éxitos recientes -->
    <section v-if="hits.length > 0" class="feed-block" aria-labelledby="feed-hits">
      <div class="results-head">
        <div class="results-title">
          <h3 id="feed-hits" class="subhead">Éxitos recientes</h3>
          <p class="summary">Videos de tus canales publicados en los últimos 14 días que ya llegaron a 2× o más</p>
        </div>
      </div>
      <ol class="videos">
        <VideoRow
          v-for="v in hits"
          :key="v.id"
          :video="v"
          :channel="channelById.get(v.channelId)"
          @analyze="$emit('analyze', $event)"
        >
          <template #lead>
            <img v-if="channelById.get(v.channelId)?.thumbnailUrl" class="avatar" :src="channelById.get(v.channelId)!.thumbnailUrl!" alt="" loading="lazy" />
            <span v-else class="avatar avatar-blank" aria-hidden="true">{{ channelById.get(v.channelId)?.title.charAt(0) }}</span>
            <span class="video-lead-text">
              <strong>{{ channelById.get(v.channelId)?.title }}</strong> tuvo un video de gran éxito
            </span>
            <span class="video-lead-age">{{ formatAge(v.ageDays) }}</span>
          </template>
        </VideoRow>
      </ol>
    </section>

    <!-- b. Impulso de tus temas -->
    <section v-if="momentumRows.length > 0" class="feed-block" aria-labelledby="feed-momentum">
      <div class="results-head">
        <div class="results-title">
          <h3 id="feed-momentum" class="subhead">Impulso de tus temas</h3>
          <p class="summary">Vistas por hora que suman los outliers de cada tema, día a día</p>
        </div>
      </div>
      <div class="table-wrap momentum-wrap">
        <table class="momentum">
          <thead>
            <tr>
              <th scope="col" class="m-topic">Tema</th>
              <th scope="col" class="m-value" title="Suma de las vistas por hora de sus videos largos de 2× o más">Vistas por hora</th>
              <th scope="col" class="m-change">Cambio en 7 días</th>
              <th scope="col" class="m-spark">Últimos 14 días</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in momentumRows" :key="row.topic.id">
              <th scope="row" class="m-topic">
                <span class="m-name">{{ row.label }}</span>
                <span v-if="row.trend" class="m-sub">{{ row.trend.latest.outliers === 1 ? '1 outlier' : `${row.trend.latest.outliers} outliers` }} de {{ row.trend.latest.videos }} videos</span>
              </th>
              <td class="m-value" data-label="Vistas por hora">
                <template v-if="row.trend">{{ formatPace(row.trend.latest.momentum) }}</template>
                <span v-else class="dim">sin datos</span>
              </td>
              <template v-if="row.trend && row.trend.base">
                <td class="m-change" :data-label="row.trend.daysBack === 7 ? 'Cambio en 7 días' : `Cambio en ${row.trend.daysBack} días`">
                  <span v-if="row.trend.change !== null" :class="row.trend.change > 0 ? 'is-up' : 'is-down'">
                    {{ formatChange(row.trend.change) }}
                  </span>
                  <span v-else class="dim">sin datos</span>
                  <span v-if="row.trend.daysBack !== 7" class="m-days">en {{ row.trend.daysBack }} días</span>
                </td>
                <td class="m-spark" data-label="Últimos 14 días">
                  <Sparkline
                    :values="row.series.map((p) => p.momentum)"
                    :rising="(row.trend.change ?? 0) > 0"
                    :label="sparkLabel(row)"
                  />
                </td>
              </template>
              <td v-else colspan="2" class="m-wait">Se necesitan más días de datos para ver la tendencia.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- c. Competidores sugeridos -->
    <section v-if="suggestions.length > 0" class="feed-block" aria-labelledby="feed-suggest">
      <div class="results-head">
        <div class="results-title">
          <h3 id="feed-suggest" class="subhead">Competidores sugeridos</h3>
          <p class="summary">
            Canales que no sigues con outliers en tus temas{{ similarShown ? '. Primero los de un tamaño parecido al tuyo' : '' }}
          </p>
        </div>
      </div>
      <ul class="suggestions">
        <li v-for="s in suggestions" :key="s.channel.id" class="suggestion">
          <div class="suggestion-head">
            <img v-if="s.channel.thumbnailUrl" class="avatar avatar-lg" :src="s.channel.thumbnailUrl" alt="" loading="lazy" />
            <span v-else class="avatar avatar-lg avatar-blank" aria-hidden="true">{{ s.channel.title.charAt(0) }}</span>
            <div class="suggestion-name">
              <p class="suggestion-title">{{ s.channel.title }}</p>
              <p class="suggestion-subs">
                {{ s.channel.subscriberCount !== null ? `${compact.format(s.channel.subscriberCount)} suscriptores` : 'Suscriptores ocultos' }}
              </p>
            </div>
            <FollowButton :channel="{ ...s.channel, followed: false }" :busy-id="following" :demo="isDemo" @follow="$emit('follow', $event)" />
          </div>
          <p class="suggestion-meta">
            <span>{{ s.outliers === 1 ? '1 outlier' : `${s.outliers} outliers` }} en tus temas</span>
            <span>Mejor <span class="suggestion-best" :class="`tier-${scoreTier(s.best)}`">{{ formatScore(s.best) }}</span></span>
          </p>
        </li>
      </ul>
    </section>

    <!-- d. Tus logros -->
    <section v-if="trophies.length > 0" id="logros" class="feed-block" aria-labelledby="feed-trophies">
      <div class="results-head">
        <div class="results-title">
          <h3 id="feed-trophies" class="subhead">Tus logros</h3>
          <p class="summary">Hitos de {{ trophies.length === 1 ? 'tu canal' : 'tus canales' }}, con la fecha en que los alcanzaste</p>
        </div>
      </div>

      <div v-for="t in trophies" :key="t.channel.id" class="trophy-group">
        <p v-if="trophies.length > 1" class="trophy-channel">
          <img v-if="t.channel.thumbnailUrl" class="avatar" :src="t.channel.thumbnailUrl" alt="" loading="lazy" />
          <span v-else class="avatar avatar-blank" aria-hidden="true">{{ t.channel.title.charAt(0) }}</span>
          <span>{{ t.channel.title }}</span>
        </p>
        <div class="trophy-grid">
          <div v-for="(column, ci) in t.columns" :key="ci" class="trophy-column">
            <section v-for="card in column" :key="card.title" class="trophy-card">
              <h4>{{ card.title }}</h4>
              <p v-if="card.empty" class="trophy-empty">{{ card.empty }}</p>
              <ul v-else>
                <li v-for="a in card.items" :key="a.id" class="trophy" :class="{ 'is-done': a.achieved }">
                  <span class="trophy-mark" aria-hidden="true">
                    <svg v-if="a.achieved" viewBox="0 0 12 12" width="12" height="12">
                      <path d="M2.5 6.25 5 8.75l4.5-5.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                  <span class="trophy-text">
                    <span class="trophy-title">
                      {{ title(a) }}<span class="sr-only">{{ a.achieved ? ', logrado' : ', pendiente' }}</span>
                    </span>
                    <a
                      v-if="a.video"
                      class="trophy-video"
                      :href="videoLink(a.video)"
                      target="_blank"
                      rel="noopener"
                    >{{ a.video.title }}</a>
                    <span v-if="a.progress" class="trophy-progress">
                      <span class="meter" role="progressbar" :aria-valuenow="Math.round(a.progress.ratio * 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="`Avance hacia ${title(a)}`">
                        <span class="meter-fill" :style="{ width: `${a.progress.ratio * 100}%` }" />
                      </span>
                      <span class="trophy-left">{{ remaining(a) }}</span>
                    </span>
                  </span>
                  <span v-if="a.achieved && (a.date || a.before)" class="trophy-date">
                    {{ a.date ? formatDate(a.date) : 'Ya alcanzado' }}
                  </span>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
      <p class="form-note trophy-note">
        Los logros de videos salen de los últimos videos guardados: la app conserva 50 largos y 50 Shorts por canal.
      </p>
    </section>

    <p v-if="mine.length === 0 && channels.length > 0" class="form-note feed-hint">
      ¿Alguno de los canales que sigues es tuyo?
      <button class="link-button link-inline" type="button" @click="$emit('go', 'following')">Márcalo como tuyo</button>
      para ver aquí tus logros y competidores de tu tamaño.
    </p>
  </div>

  <div v-else class="empty">
    <p class="empty-title">Todavía no hay nada que contar</p>
    <p>Sigue canales para ver aquí sus éxitos recientes, y temas para ver su impulso y competidores que no conoces.</p>
    <p class="empty-actions">
      <button class="button" type="button" @click="$emit('go', 'following')">Ir a Tus canales</button>
      <button class="link-button" type="button" @click="$emit('go', 'trends')">Ir a Tendencias</button>
    </p>
  </div>
</template>
