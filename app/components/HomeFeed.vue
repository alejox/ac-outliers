<script setup lang="ts">
import { channelAchievements, type Achievement, type ChannelSnapshot } from '~~/shared/achievements'
import { outlierKeywords } from '~~/shared/keywords'
import {
  bestOf,
  channelPulse,
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
defineEmits<{ analyze: [video: ScoredVideo]; follow: [channelId: string]; go: [mode: 'following' | 'trends' | 'words' | 'mine'] }>()

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

// El momento héroe: el outlier más fuerte de las novedades o, si no hay, de los éxitos recientes.
const strongest = (list: ScoredVideo[]) => [...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null
const hero = computed(() => {
  const fromNews = strongest(news.value)
  if (fromNews) return { video: fromNews, kicker: 'El más fuerte desde tu última visita' }
  const fromHits = strongest(hits.value)
  if (fromHits) return { video: fromHits, kicker: 'Tu mejor éxito de los últimos 14 días' }
  // Sin novedades ni éxitos recientes, Inicio no queda vacío: lo más fuerte de los últimos 3 meses.
  const fromQuarter = bestOf([...props.videos, ...props.trendVideos], 90, 1)[0]
  if (!fromQuarter) return null
  const own = props.channels.find((c) => c.id === fromQuarter.channelId)?.isMine
  return { video: fromQuarter, kicker: own ? 'Tu mejor video de los últimos 3 meses' : 'Lo más fuerte de los últimos 3 meses en tus canales y temas' }
})
const newsRest = computed(() => newsShown.value.filter((v) => v.id !== hero.value?.video.id))
const hitsRest = computed(() => hits.value.filter((v) => v.id !== hero.value?.video.id))
const saver = inject<{
  enabled: Ref<boolean>
  isSaved: (id: string) => boolean
  busy: Ref<string | null>
  toggle: (video: ScoredVideo) => void
} | null>('saver', null)

// Tu canal ahora: tus últimas subidas frente a lo normal.
const pulse = computed(() => {
  const c = props.channels.find((x) => x.isMine)
  if (!c) return null
  const p = channelPulse(props.videos, c.id)
  return p.recent.length > 0 ? { channel: c, ...p } : null
})
const pulseMax = computed(() => Math.max(4, ...(pulse.value?.recent.map((v) => v.score ?? 0) ?? [])))
/** Altura en escala logarítmica: un 13× no aplasta a los demás y "lo normal" (1×) queda visible. */
const barHeight = (score: number | null) => (Math.log2(1 + (score ?? 0)) / Math.log2(1 + pulseMax.value)) * 100
const pulseLine = computed(() => {
  const m = pulse.value?.median
  if (m === null || m === undefined) return 'Todavía no hay suficientes videos para comparar.'
  if (m >= 1.5) return `Tus últimos 5 videos van a ${formatScore(m)} de lo normal: estás en racha.`
  if (m >= 0.8) return `Tus últimos 5 videos van a ${formatScore(m)} de lo normal: en tu ritmo de siempre.`
  return `Tus últimos 5 videos van a ${formatScore(m)} de lo normal: por debajo de tu ritmo. Mira qué está pegando en tu tema.`
})

// Lo mejor del mes en tus canales y temas, sin repetir lo que ya está arriba.
const shownIds = computed(() => new Set([hero.value?.video.id, ...news.value.map((v) => v.id), ...hits.value.map((v) => v.id)].filter(Boolean) as string[]))
const monthBest = computed(() => bestOf([...props.videos, ...props.trendVideos], 30, 8, shownIds.value))

// Palabras del momento: frases de título que comparten los outliers de tus canales y temas.
const words = computed(() => {
  const seen = new Set<string>()
  const list = [...props.videos, ...props.trendVideos].filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)))
  return outlierKeywords(list.map((v) => ({ id: v.id, title: v.title, score: v.score })), 'titles', { limit: 8 })
})

// Primeros pasos: lo que le falta a Inicio para tener más que contar.
const setup = computed(() => {
  const following = props.channels.filter((c) => !c.isMine).length
  const steps = [
    { key: 'channels', done: following >= 5, label: 'Sigue 5 canales de tu tema', detail: `${Math.min(following, 5)} de 5`, ratio: Math.min(following, 5) / 5, go: 'following' as const, action: 'Buscar canales' },
    { key: 'topics', done: props.topics.length > 0, label: 'Sigue un tema', detail: props.topics.length > 0 ? 'Listo' : 'Ve qué pega en todo YouTube', ratio: props.topics.length > 0 ? 1 : 0, go: 'trends' as const, action: 'Elegir un tema' },
    { key: 'mine', done: props.channels.some((c) => c.isMine), label: 'Marca tu canal', detail: 'Para ver tu ritmo y tus logros', ratio: props.channels.some((c) => c.isMine) ? 1 : 0, go: 'following' as const, action: 'Marcar mi canal' },
  ]
  return { steps, left: steps.filter((s) => !s.done).length }
})

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
  () => hero.value !== null || pulse.value !== null || news.value.length > 0 || hits.value.length > 0 || props.topics.length > 0 || suggestions.value.length > 0 || mine.value.length > 0,
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

    <!-- El momento héroe: el outlier más fuerte -->
    <article v-if="hero" class="hero" :class="`is-${badgeTier(hero.video.score)}`" aria-labelledby="hero-title">
      <button
        class="hero-media"
        type="button"
        :aria-label="`Analizar “${hero.video.title}”`"
        @click="$emit('analyze', hero.video)"
      >
        <VideoThumb
          :src="hero.video.thumbnailUrl"
          :title="hero.video.title"
          :seed="hero.video.channelId"
          plain
          :duration="hero.video.isShort ? 'Short' : formatDuration(hero.video.durationSeconds)"
        />
      </button>
      <div class="hero-info">
        <p class="hero-kicker">{{ hero.kicker }}</p>
        <div v-if="hero.video.score !== null" class="hero-score">
          <strong>{{ formatScore(hero.video.score) }}</strong>
          <p>
            <b>{{ compact.format(hero.video.views) }} vistas</b>
            <template v-if="hero.video.baseline !== null"> donde lo normal del canal son {{ compact.format(hero.video.baseline) }}</template>
          </p>
        </div>
        <ScoreStrip v-if="hero.video.score !== null" class="hero-strip" :score="hero.video.score" />
        <h2 id="hero-title" class="hero-title">
          <a :href="videoUrl(hero.video)" target="_blank" rel="noopener">{{ hero.video.title }}</a>
        </h2>
        <p class="hero-by">
          <img v-if="allChannels.get(hero.video.channelId)?.thumbnailUrl" class="hero-avatar" :src="allChannels.get(hero.video.channelId)!.thumbnailUrl!" alt="" />
          <span v-else class="hero-avatar" :style="{ '--hue': hueOf(hero.video.channelId) }" aria-hidden="true">{{ allChannels.get(hero.video.channelId)?.title.charAt(0) }}</span>
          <span>{{ allChannels.get(hero.video.channelId)?.title }}</span>
          <span>{{ formatAge(hero.video.ageDays) }}</span>
          <span>{{ formatPace(hero.video.viewsPerHour) }} vistas por hora</span>
        </p>
        <div class="hero-cta">
          <button class="button button-primary button-large" type="button" @click="$emit('analyze', hero.video)">Ver por qué destaca</button>
          <button
            v-if="saver?.enabled.value"
            class="button button-large"
            type="button"
            :aria-pressed="saver.isSaved(hero.video.id)"
            :disabled="saver.busy.value !== null"
            @click="saver.toggle(hero.video)"
          >
            {{ saver.isSaved(hero.video.id) ? 'Guardado' : 'Guardar' }}
          </button>
        </div>
      </div>
    </article>

    <!-- Tu canal ahora -->
    <section v-if="pulse" class="pulse panel" aria-labelledby="feed-pulse">
      <div class="pulse-head">
        <img v-if="pulse.channel.thumbnailUrl" class="pulse-avatar" :src="pulse.channel.thumbnailUrl" alt="" />
        <span v-else class="pulse-avatar" :style="{ '--hue': hueOf(pulse.channel.id) }" aria-hidden="true">{{ pulse.channel.title.charAt(0) }}</span>
        <div>
          <h2 id="feed-pulse" class="panel-title">{{ pulse.channel.title }}</h2>
          <p class="panel-sub">
            <template v-if="pulse.channel.subscriberCount !== null">{{ compact.format(pulse.channel.subscriberCount) }} suscriptores</template>
            <template v-if="pulse.channel.viewCount !== null"> · {{ compact.format(pulse.channel.viewCount) }} vistas</template>
          </p>
        </div>
        <button class="link-button pulse-more" type="button" @click="$emit('go', 'mine')">Ver Mi canal</button>
      </div>
      <p class="pulse-line">{{ pulseLine }}</p>
      <ol class="pulse-bars" aria-label="Score de tus últimos videos largos, del más viejo al más nuevo">
        <li
          v-for="v in pulse.recent"
          :key="v.id"
          :class="`is-${badgeTier(v.score)}`"
        >
          <button type="button" :title="`${v.title} · ${v.score !== null ? formatScore(v.score) : 'sin score'}`" @click="$emit('analyze', v)">
            <span v-if="v.score !== null && v.score >= 2" class="pulse-tag">{{ formatScore(v.score) }}</span>
            <span class="pulse-bar" :style="{ height: `${Math.max(3, barHeight(v.score))}%` }" />
            <span class="sr-only">{{ v.title }}: {{ v.score !== null ? formatScore(v.score) : 'sin score' }}</span>
          </button>
        </li>
        <li class="pulse-normal" aria-hidden="true" :style="{ bottom: `${barHeight(1)}%` }"><span>lo normal</span></li>
      </ol>
      <div v-if="pulse.latest" class="pulse-latest">
        <button class="pulse-thumb" type="button" :aria-label="`Analizar “${pulse.latest.title}”`" @click="$emit('analyze', pulse.latest)">
          <VideoThumb :src="pulse.latest.thumbnailUrl" :title="pulse.latest.title" :seed="pulse.latest.channelId" :score="pulse.latest.score" />
        </button>
        <div>
          <p class="pulse-kicker">Tu último video · {{ formatAge(pulse.latest.ageDays) }}</p>
          <p class="pulse-title">{{ pulse.latest.title }}</p>
          <p class="pulse-meta">
            {{ compact.format(pulse.latest.views) }} vistas · {{ formatPace(pulse.latest.viewsPerHour) }} por hora
            <template v-if="pulse.latest.baseline !== null"> · lo normal: {{ compact.format(pulse.latest.baseline) }}</template>
          </p>
        </div>
      </div>
    </section>

    <!-- Primeros pasos -->
    <section v-if="!isDemo && setup.left > 0" class="setup" aria-labelledby="feed-setup">
      <div>
        <h2 id="feed-setup" class="setup-title">Dale más a Inicio para contarte</h2>
        <p class="section-sub">Entre más canales y temas sigas, más outliers, palabras y competidores aparecen aquí.</p>
      </div>
      <ol class="setup-steps">
        <li v-for="st in setup.steps" :key="st.key" :class="{ 'is-done': st.done }">
          <span class="setup-mark" aria-hidden="true">
            <svg v-if="st.done" viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 6.25 5 8.75l4.5-5.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </span>
          <div class="setup-text">
            <p class="setup-label">{{ st.label }}<span class="sr-only">{{ st.done ? ', listo' : '' }}</span></p>
            <p class="setup-detail">{{ st.detail }}</p>
            <span v-if="!st.done && st.ratio > 0" class="meter"><span class="meter-fill" :style="{ width: `${st.ratio * 100}%` }" /></span>
          </div>
          <button v-if="!st.done" class="button" type="button" @click="$emit('go', st.go)">{{ st.action }}</button>
        </li>
      </ol>
    </section>

    <!-- Novedades desde tu última visita -->
    <section v-if="news.length > 0" class="feed-block" aria-labelledby="feed-news">
      <div class="section-head">
        <div>
          <h2 id="feed-news">Novedades desde tu última visita</h2>
          <p class="section-sub">
            {{ news.length === 1 ? '1 video nuevo llegó' : `${news.length} videos nuevos llegaron` }} a 2× o más en tus canales y tus temas<template v-if="lastVisit"> desde {{ sinceLabel(Date.now() - lastVisit) }}</template>
          </p>
        </div>
        <button v-if="news.length > NEWS_SHOWN" class="link-button" type="button" @click="allNews = !allNews">
          {{ allNews ? 'Ver menos' : `Ver las ${news.length} novedades` }}
        </button>
      </div>
      <ol v-if="newsRest.length > 0" class="vgrid">
        <VideoRow v-for="v in newsRest" :key="v.id" :video="v" :channel="allChannels.get(v.channelId)" @analyze="$emit('analyze', $event)" />
      </ol>
    </section>
    <p v-else-if="lastVisit && !firstVisit" class="feed-quiet">
      Nada nuevo desde tu última visita, {{ sinceLabel(Date.now() - lastVisit) }}: ningún video de tus canales o tus temas cruzó 2× en ese tiempo.
    </p>

    <!-- a. Éxitos recientes -->
    <section v-if="hitsRest.length > 0" class="feed-block" aria-labelledby="feed-hits">
      <div class="section-head">
        <div>
          <h2 id="feed-hits">Éxitos recientes</h2>
          <p class="section-sub">Videos de tus canales publicados en los últimos 14 días que ya llegaron a 2× o más</p>
        </div>
      </div>
      <ol class="vgrid">
        <VideoRow v-for="v in hitsRest" :key="v.id" :video="v" :channel="channelById.get(v.channelId)" @analyze="$emit('analyze', $event)" />
      </ol>
    </section>

    <!-- Lo mejor del mes -->
    <section v-if="monthBest.length > 0" class="feed-block" aria-labelledby="feed-month">
      <div class="section-head">
        <div>
          <h2 id="feed-month">Lo mejor del mes</h2>
          <p class="section-sub">Los videos con más score de los últimos 30 días en tus canales y tus temas</p>
        </div>
      </div>
      <ol class="vgrid">
        <VideoRow v-for="v in monthBest" :key="v.id" :video="v" :channel="allChannels.get(v.channelId)" @analyze="$emit('analyze', $event)" />
      </ol>
    </section>

    <!-- Palabras del momento -->
    <section v-if="words.length > 0" class="feed-block" aria-labelledby="feed-words">
      <div class="section-head">
        <div>
          <h2 id="feed-words">Palabras que se repiten en tus outliers</h2>
          <p class="section-sub">Frases de título que comparten los videos de 2× o más, con su score promedio</p>
        </div>
        <button class="link-button" type="button" @click="$emit('go', 'words')">Ver todas y copiar etiquetas</button>
      </div>
      <ul class="home-words">
        <li v-for="w in words" :key="w.key">
          <span class="home-word">{{ w.text }}</span>
          <span class="home-word-score" :class="`is-${badgeTier(w.avgScore)}`">{{ formatScore(w.avgScore) }}</span>
          <span class="home-word-n">{{ w.outliers }} outliers</span>
        </li>
      </ul>
    </section>

    <div v-if="momentumRows.length > 0 || suggestions.length > 0" class="feed-pair" :class="{ 'is-single': momentumRows.length === 0 || suggestions.length === 0 }">
      <!-- b. Impulso de tus temas -->
      <section v-if="momentumRows.length > 0" class="panel" aria-labelledby="feed-momentum">
        <h2 id="feed-momentum" class="panel-title">Impulso de tus temas</h2>
        <p class="panel-sub">Vistas por hora que suman los outliers de cada tema, día a día</p>
        <ul class="momentum-list">
          <li v-for="row in momentumRows" :key="row.topic.id" class="momentum-row">
            <div class="m-topic">
              <p class="m-name">{{ row.label }}</p>
              <p v-if="row.trend" class="m-sub">{{ row.trend.latest.outliers === 1 ? '1 outlier' : `${row.trend.latest.outliers} outliers` }} de {{ row.trend.latest.videos }} videos</p>
            </div>
            <p class="m-value" title="Suma de las vistas por hora de sus videos largos de 2× o más">
              <template v-if="row.trend">{{ formatPace(row.trend.latest.momentum) }}<small>por hora</small></template>
              <span v-else class="dim">sin datos</span>
            </p>
            <template v-if="row.trend && row.trend.base">
              <p class="m-change">
                <span v-if="row.trend.change !== null" :class="row.trend.change > 0 ? 'is-up' : 'is-down'">
                  {{ row.trend.change > 0 ? '▲' : '▼' }} {{ formatChange(row.trend.change).slice(1) }}
                </span>
                <span v-else class="dim">sin datos</span>
                <small>en {{ row.trend.daysBack }} días</small>
              </p>
              <Sparkline class="m-spark" :values="row.series.map((p) => p.momentum)" :rising="(row.trend.change ?? 0) > 0" :label="sparkLabel(row)" />
            </template>
            <p v-else class="m-wait">Se necesitan más días de datos para ver la tendencia.</p>
          </li>
        </ul>
      </section>

      <!-- c. Competidores sugeridos -->
      <section v-if="suggestions.length > 0" class="panel" aria-labelledby="feed-suggest">
        <h2 id="feed-suggest" class="panel-title">Competidores sugeridos</h2>
        <p class="panel-sub">
          Canales que no sigues con outliers en tus temas{{ similarShown ? '. Primero los de un tamaño parecido al tuyo' : '' }}
        </p>
        <ul class="suggestions">
          <li v-for="s in suggestions" :key="s.channel.id" class="suggestion">
            <img v-if="s.channel.thumbnailUrl" class="suggestion-avatar" :src="s.channel.thumbnailUrl" alt="" loading="lazy" />
            <span v-else class="suggestion-avatar" :style="{ '--hue': hueOf(s.channel.id) }" aria-hidden="true">{{ s.channel.title.charAt(0) }}</span>
            <div class="suggestion-name">
              <p class="suggestion-title">{{ s.channel.title }}</p>
              <p class="suggestion-meta">
                {{ s.channel.subscriberCount !== null ? `${compact.format(s.channel.subscriberCount)} suscriptores` : 'Suscriptores ocultos' }}
                · {{ s.outliers === 1 ? '1 outlier' : `${s.outliers} outliers` }} en tus temas · mejor
                <span class="suggestion-best" :class="`is-${badgeTier(s.best)}`">{{ formatScore(s.best) }}</span>
              </p>
            </div>
            <FollowButton :channel="{ ...s.channel, followed: false }" :busy-id="following" :demo="isDemo" @follow="$emit('follow', $event)" />
          </li>
        </ul>
      </section>
    </div>

    <!-- d. Tus logros -->
    <section v-if="trophies.length > 0" id="logros" class="feed-block" aria-labelledby="feed-trophies">
      <div class="section-head">
        <div>
          <h2 id="feed-trophies">Tus logros</h2>
          <p class="section-sub">Hitos de {{ trophies.length === 1 ? 'tu canal' : 'tus canales' }}, con la fecha en que los alcanzaste</p>
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
