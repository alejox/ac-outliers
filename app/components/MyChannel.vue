<script setup lang="ts">
import { ANALYTICS_PERIODS, compareTotals, netSubscribers, peakDay, type AnalyticsPeriod, type ChannelTotals, type DailyViews } from '~~/shared/analytics'

type Report = {
  demo: boolean
  channel: { id: string; title: string | null }
  period: number
  startDate: string
  endDate: string
  totals: ChannelTotals
  previous: ChannelTotals & { startDate: string; endDate: string }
  daily: DailyViews[]
  sources: { type: string; name: string; views: number; share: number }[]
  searchTerms: { term: string; views: number }[]
  related: { videoId: string; views: number; title: string | null; thumbnailUrl: string | null; channelTitle: string | null; own: boolean }[]
}

const period = ref<AnalyticsPeriod>(28)
const { data, error, pending } = await useFetch<Report>('/api/my-channel', { query: { days: period }, lazy: true, server: false })

/** Los datos se piden solo en el navegador: el aviso de carga aparece después de hidratar, igual en servidor y cliente. */
const mounted = ref(false)
onMounted(() => (mounted.value = true))

const number = new Intl.NumberFormat('es', { useGrouping: 'always' })
const percent = new Intl.NumberFormat('es', { style: 'percent', maximumFractionDigits: 0 })
const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
const dateLabel = (iso: string, withMonth = true) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es', withMonth ? { day: 'numeric', month: 'long' } : { day: 'numeric' })

const net = computed(() => (data.value ? netSubscribers(data.value.totals) : 0))
const change = computed(() => (data.value?.previous ? compareTotals(data.value.totals, data.value.previous) : null))
const peak = computed(() => (data.value?.daily ? peakDay(data.value.daily) : null))
const maxTerm = computed(() => Math.max(1, ...(data.value?.searchTerms.map((t) => t.views) ?? [1])))
const errorText = computed(() => (error.value as any)?.data?.message ?? 'No se pudieron leer las estadísticas de tu canal.')

/** Grises del más claro al más oscuro: las fuentes se distinguen sin usar color. */
const SHADES = ['#f4f3f1', '#b9b8b5', '#8a8986', '#63625f', '#4a4947', '#38383a']
const shade = (i: number) => SHADES[Math.min(i, SHADES.length - 1)]

/** Curva de vistas por día: área tenue y línea blanca, con el día de más vistas marcado. */
const W = 600
const H = 120
const curve = computed(() => {
  const days = data.value?.daily ?? []
  if (days.length < 2) return null
  const max = Math.max(1, ...days.map((d) => d.views))
  const pts = days.map((d, i) => [(i / (days.length - 1)) * W, H - 8 - (d.views / max) * (H - 24)] as const)
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const p = peak.value ? days.findIndex((d) => d.date === peak.value!.date) : -1
  return { line, area: `0,${H} ${line} ${W},${H}`, peak: p >= 0 ? pts[p]! : null }
})

function delta(ratio: number | null | undefined) {
  if (ratio === null || ratio === undefined) return null
  return { up: ratio >= 0, text: `${ratio >= 0 ? '▲' : '▼'} ${percent.format(Math.abs(ratio)).replace(/\s?%/, ' %')}` }
}
const deltaLabel = (ratio: number | null | undefined) =>
  ratio === null || ratio === undefined
    ? ''
    : `${ratio >= 0 ? 'Subió' : 'Bajó'} ${percent.format(Math.abs(ratio))} frente a los ${period.value} días anteriores`
</script>

<template>
  <div class="mine">
    <div class="page-head mine-head">
      <div class="mine-id">
        <span class="mine-avatar" :style="{ '--hue': hueOf(data?.channel.id ?? 'mi-canal') }" aria-hidden="true">{{ (data?.channel.title ?? 'M').charAt(0) }}</span>
        <div>
          <h1>{{ data?.channel.title ?? 'Mi canal' }}</h1>
          <p class="lede">
            <template v-if="data">Del {{ dateLabel(data.startDate) }} al {{ dateLabel(data.endDate) }}</template>
            <template v-else>De dónde vienen las vistas de tu canal, qué buscan para encontrarte y qué videos te recomiendan.</template>
          </p>
        </div>
      </div>
      <div class="segmented" role="group" aria-label="Periodo">
        <button v-for="p in ANALYTICS_PERIODS" :key="p" type="button" :aria-pressed="period === p" @click="period = p">
          {{ p }} días
        </button>
      </div>
    </div>

    <p v-if="error" class="banner banner-error" role="alert"><span>{{ errorText }}</span></p>
    <p v-else-if="mounted && pending && !data" class="analysis-note" aria-live="polite">Leyendo las estadísticas de tu canal…</p>

    <template v-if="data && !error">
      <div class="kpis" :class="{ 'is-loading': pending }">
        <section class="kpi-hero" aria-labelledby="kpi-views">
          <h2 id="kpi-views" class="kpi-label">Vistas</h2>
          <p class="kpi-value">{{ number.format(data.totals.views) }}</p>
          <p v-if="delta(change?.views)" class="kpi-compare" :aria-label="deltaLabel(change?.views)">
            <b :class="{ 'is-down': !delta(change?.views)!.up }">{{ delta(change?.views)!.text }}</b>
            <span>frente a los {{ period }} días anteriores</span>
          </p>
          <p v-if="peak" class="kpi-peak">
            <b>{{ dateLabel(peak.date) }} · {{ number.format(peak.views) }} vistas</b>
            el día con más vistas
          </p>
          <svg v-if="curve" class="kpi-curve" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" :aria-label="`Vistas por día del ${dateLabel(data.startDate)} al ${dateLabel(data.endDate)}`">
            <defs>
              <linearGradient id="kpi-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#f4f3f1" stop-opacity="0.16" />
                <stop offset="1" stop-color="#f4f3f1" stop-opacity="0" />
              </linearGradient>
            </defs>
            <polygon :points="curve.area" fill="url(#kpi-fill)" />
            <polyline :points="curve.line" fill="none" stroke="#f4f3f1" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          </svg>
        </section>

        <dl class="kpi-side">
          <div class="kpi-small">
            <div>
              <dt class="kpi-label">Horas vistas</dt>
              <dd class="kpi-small-value">{{ number.format(Math.round(data.totals.minutes / 60)) }}</dd>
            </div>
            <dd v-if="delta(change?.hours)" class="kpi-delta" :class="{ 'is-down': !delta(change?.hours)!.up }" :aria-label="deltaLabel(change?.hours)">{{ delta(change?.hours)!.text }}</dd>
          </div>
          <div class="kpi-small">
            <div>
              <dt class="kpi-label">Duración media</dt>
              <dd class="kpi-small-value">{{ duration(data.totals.averageViewDuration) }}</dd>
            </div>
            <dd v-if="delta(change?.averageViewDuration)" class="kpi-delta" :class="{ 'is-down': !delta(change?.averageViewDuration)!.up }" :aria-label="deltaLabel(change?.averageViewDuration)">{{ delta(change?.averageViewDuration)!.text }}</dd>
          </div>
          <div class="kpi-small">
            <div>
              <dt class="kpi-label">Suscriptores</dt>
              <dd class="kpi-small-value">{{ net >= 0 ? '+' : '−' }}{{ number.format(Math.abs(net)) }}</dd>
            </div>
            <dd v-if="delta(change?.subscribers)" class="kpi-delta" :class="{ 'is-down': !delta(change?.subscribers)!.up }" :aria-label="deltaLabel(change?.subscribers)">{{ delta(change?.subscribers)!.text }}</dd>
          </div>
        </dl>
      </div>

      <section class="panel mine-sources" aria-labelledby="mine-sources">
        <h2 id="mine-sources" class="panel-title">De dónde vienen tus vistas</h2>
        <p v-if="data.sources.length === 0" class="analysis-note">Sin vistas en este periodo.</p>
        <template v-else>
          <div class="source-stack" aria-hidden="true">
            <span v-for="(s, i) in data.sources" :key="s.type" :style="{ width: `${Math.max(0.5, s.share * 100)}%`, background: shade(i) }" />
          </div>
          <ol class="sources">
            <li v-for="(s, i) in data.sources" :key="s.type" class="source">
              <span class="source-key" :style="{ background: shade(i) }" aria-hidden="true" />
              <span class="source-name">{{ s.name }}</span>
              <span class="source-share">{{ percent.format(s.share) }}</span>
              <span class="source-views">{{ number.format(s.views) }}</span>
            </li>
          </ol>
        </template>
      </section>

      <div class="mine-columns">
        <section class="panel" aria-labelledby="mine-terms">
          <h2 id="mine-terms" class="panel-title">Lo que buscan para encontrarte</h2>
          <p class="panel-sub">Términos de la búsqueda de YouTube que trajeron vistas</p>
          <p v-if="data.searchTerms.length === 0" class="analysis-note">YouTube no registró búsquedas en este periodo.</p>
          <ol v-else class="terms">
            <li v-for="(t, i) in data.searchTerms" :key="t.term" class="term">
              <span class="term-rank">{{ i + 1 }}</span>
              <span class="term-text">{{ t.term }}</span>
              <span class="term-bar" aria-hidden="true"><span :style="{ width: `${(t.views / maxTerm) * 100}%` }" /></span>
              <span class="term-views">{{ number.format(t.views) }}</span>
            </li>
          </ol>
        </section>

        <section class="panel" aria-labelledby="mine-related">
          <h2 id="mine-related" class="panel-title">Videos que te recomiendan</h2>
          <p class="panel-sub">Videos junto a los que YouTube sugirió los tuyos</p>
          <p v-if="data.related.length === 0" class="analysis-note">Sin tráfico de videos sugeridos en este periodo.</p>
          <ol v-else class="related">
            <li v-for="r in data.related" :key="r.videoId" class="related-item">
              <a class="related-thumb" :href="`https://www.youtube.com/watch?v=${r.videoId}`" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
                <VideoThumb :src="r.thumbnailUrl" :title="r.title ?? 'Video'" :seed="r.channelTitle ?? r.videoId" plain />
              </a>
              <div class="related-text">
                <a :href="`https://www.youtube.com/watch?v=${r.videoId}`" target="_blank" rel="noopener">{{ r.title ?? 'Video no disponible' }}</a>
                <p>{{ r.own ? 'Tu canal' : (r.channelTitle ?? 'Canal desconocido') }}</p>
              </div>
              <p class="related-views">{{ number.format(r.views) }}<small>vistas para ti</small></p>
            </li>
          </ol>
        </section>
      </div>
    </template>
  </div>
</template>
