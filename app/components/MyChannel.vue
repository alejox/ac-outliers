<script setup lang="ts">
import { ANALYTICS_PERIODS, type AnalyticsPeriod } from '~~/shared/analytics'

type Report = {
  demo: boolean
  channel: { id: string; title: string | null }
  period: number
  startDate: string
  endDate: string
  totals: { views: number; minutes: number; averageViewDuration: number; subscribersGained: number; subscribersLost: number }
  sources: { type: string; name: string; views: number; share: number }[]
  searchTerms: { term: string; views: number }[]
  related: { videoId: string; views: number; title: string | null; thumbnailUrl: string | null; channelTitle: string | null; own: boolean }[]
}

const period = ref<AnalyticsPeriod>(28)
const { data, error, pending } = await useFetch<Report>('/api/my-channel', { query: { days: period }, lazy: true, server: false })

const number = new Intl.NumberFormat('es', { useGrouping: 'always' })
const percent = new Intl.NumberFormat('es', { style: 'percent', maximumFractionDigits: 0 })
const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`
const dateLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es', { day: 'numeric', month: 'short' })

const net = computed(() => (data.value ? data.value.totals.subscribersGained - data.value.totals.subscribersLost : 0))
const maxTerm = computed(() => Math.max(1, ...(data.value?.searchTerms.map((t) => t.views) ?? [1])))
const errorText = computed(() => (error.value as any)?.data?.message ?? 'No se pudieron leer las estadísticas de tu canal.')
</script>

<template>
  <div class="mine">
    <div class="mine-bar">
      <p class="summary">
        <template v-if="data">{{ data.channel.title }} · del {{ dateLabel(data.startDate) }} al {{ dateLabel(data.endDate) }}</template>
        <template v-else>Tu canal</template>
      </p>
      <div class="segmented" role="group" aria-label="Periodo">
        <button v-for="p in ANALYTICS_PERIODS" :key="p" type="button" :aria-pressed="period === p" @click="period = p">
          {{ p }} días
        </button>
      </div>
    </div>

    <p v-if="error" class="banner banner-error" role="alert"><span>{{ errorText }}</span></p>
    <p v-else-if="pending && !data" class="analysis-note" aria-live="polite">Leyendo las estadísticas de tu canal…</p>

    <template v-if="data && !error">
      <dl class="kpis" :class="{ 'is-loading': pending }">
        <div>
          <dt>Vistas</dt>
          <dd>{{ number.format(data.totals.views) }}</dd>
        </div>
        <div>
          <dt>Horas vistas</dt>
          <dd>{{ number.format(Math.round(data.totals.minutes / 60)) }}</dd>
        </div>
        <div>
          <dt>Duración media</dt>
          <dd>{{ duration(data.totals.averageViewDuration) }}</dd>
        </div>
        <div>
          <dt>Suscriptores</dt>
          <dd>{{ net >= 0 ? '+' : '−' }}{{ number.format(Math.abs(net)) }}</dd>
        </div>
      </dl>

      <section class="mine-block" aria-labelledby="mine-sources">
        <h3 id="mine-sources" class="subhead">De dónde vienen tus vistas</h3>
        <p v-if="data.sources.length === 0" class="analysis-note">Sin vistas en este periodo.</p>
        <ol v-else class="sources">
          <li v-for="s in data.sources" :key="s.type" class="source">
            <span class="source-name">{{ s.name }}</span>
            <span class="source-bar" aria-hidden="true"><span :style="{ width: `${Math.max(1, s.share * 100)}%` }" /></span>
            <span class="source-share">{{ percent.format(s.share) }}</span>
            <span class="source-views">{{ number.format(s.views) }}</span>
          </li>
        </ol>
      </section>

      <div class="mine-columns">
        <section class="mine-block" aria-labelledby="mine-terms">
          <h3 id="mine-terms" class="subhead">Lo que buscan para encontrarte</h3>
          <p class="summary">Términos de la búsqueda de YouTube que trajeron vistas</p>
          <p v-if="data.searchTerms.length === 0" class="analysis-note">YouTube no registró búsquedas en este periodo.</p>
          <ol v-else class="terms">
            <li v-for="t in data.searchTerms" :key="t.term" class="term">
              <span class="term-text">{{ t.term }}</span>
              <span class="term-bar" aria-hidden="true"><span :style="{ width: `${(t.views / maxTerm) * 100}%` }" /></span>
              <span class="term-views">{{ number.format(t.views) }}</span>
            </li>
          </ol>
        </section>

        <section class="mine-block" aria-labelledby="mine-related">
          <h3 id="mine-related" class="subhead">Videos que te recomiendan</h3>
          <p class="summary">Videos junto a los que YouTube sugirió los tuyos</p>
          <p v-if="data.related.length === 0" class="analysis-note">Sin tráfico de videos sugeridos en este periodo.</p>
          <ol v-else class="related">
            <li v-for="r in data.related" :key="r.videoId" class="related-item">
              <a class="related-thumb" :href="`https://www.youtube.com/watch?v=${r.videoId}`" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
                <img v-if="r.thumbnailUrl" :src="r.thumbnailUrl" alt="" loading="lazy" />
                <span v-else class="thumb-blank" :style="{ '--hue': hueOf(r.videoId) }">{{ (r.channelTitle ?? '?').charAt(0) }}</span>
              </a>
              <div class="related-text">
                <a :href="`https://www.youtube.com/watch?v=${r.videoId}`" target="_blank" rel="noopener">{{ r.title ?? 'Video no disponible' }}</a>
                <p class="byline">
                  <span>{{ r.own ? 'Tu canal' : (r.channelTitle ?? 'Canal desconocido') }}</span>
                  <span>{{ number.format(r.views) }} vistas para ti</span>
                </p>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </template>
  </div>
</template>
