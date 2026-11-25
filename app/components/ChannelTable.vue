<script setup lang="ts">
import type { ChannelStats } from '~~/shared/channel-stats'

type Column = 'subs' | 'baseline' | 'reach' | 'uploads' | 'hits' | 'best'

const props = defineProps<{ stats: ChannelStats[] }>()
defineEmits<{ select: [channelId: string] }>()

const sortBy = ref<Column>('hits')

const COLUMNS: { key: Column; label: string; hint: string; value: (s: ChannelStats) => number }[] = [
  { key: 'subs', label: 'Suscriptores', hint: '', value: (s) => s.channel.subscriberCount ?? -1 },
  { key: 'baseline', label: 'Vistas normales', hint: 'Mediana de sus últimos videos largos', value: (s) => s.baseline ?? -1 },
  { key: 'reach', label: 'Alcance', hint: 'Vistas normales ÷ suscriptores', value: (s) => s.reach ?? -1 },
  { key: 'uploads', label: 'Subidas 30 d', hint: 'Subidas en 30 días, videos y Shorts', value: (s) => s.uploads30 },
  { key: 'hits', label: 'Outliers 90 d', hint: 'Outliers en 90 días: videos largos que llegaron a 2× o más', value: (s) => s.hitRate ?? -1 },
  { key: 'best', label: 'Mejor video', hint: 'El de mayor score en 90 días', value: (s) => s.best?.score ?? -1 },
]

const sorted = computed(() => {
  const value = COLUMNS.find((c) => c.key === sortBy.value)!.value
  return [...props.stats].sort((a, b) => value(b) - value(a))
})

/** Clases de una celda: las cifras se alinean a la derecha y la columna ordenada se lee en blanco. */
const cell = (key: Column) => [`col-${key}`, { 'is-num': key !== 'best', 'is-sorted': sortBy.value === key }]
</script>

<template>
  <!-- En celular la tabla se vuelve una ficha por canal y el orden se elige aquí -->
  <label class="tool tool-select table-sort">
    <span class="tool-label" aria-hidden="true">Ordenar por</span>
    <select v-model="sortBy" aria-label="Ordenar canales por">
      <option v-for="c in COLUMNS" :key="c.key" :value="c.key">{{ c.label }}</option>
    </select>
  </label>

  <div class="table-wrap">
    <table class="channel-table">
      <thead>
        <tr>
          <th scope="col" class="col-channel">Canal</th>
          <th v-for="c in COLUMNS" :key="c.key" scope="col" :aria-sort="sortBy === c.key ? 'descending' : 'none'" :class="cell(c.key)">
            <button type="button" :title="c.hint || undefined" @click="sortBy = c.key">
              <svg class="sort-mark" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                <path d="M6 2.5v7M3 6.75 6 9.5l3-2.75" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>{{ c.label }}</span>
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in sorted" :key="s.channel.id">
          <th scope="row" class="col-channel">
            <button class="channel-link" type="button" :title="`Ver los videos de ${s.channel.title}`" @click="$emit('select', s.channel.id)">
              <img v-if="s.channel.thumbnailUrl" class="avatar" :src="s.channel.thumbnailUrl" alt="" loading="lazy" />
              <span v-else class="avatar avatar-blank" aria-hidden="true">{{ s.channel.title.charAt(0) }}</span>
              <span class="channel-name">{{ s.channel.title }}</span>
            </button>
          </th>
          <td :class="cell('subs')" data-label="Suscriptores">
            <span v-if="s.channel.subscriberCount">{{ compact.format(s.channel.subscriberCount) }}</span>
            <span v-else class="dim">ocultos</span>
          </td>
          <td :class="cell('baseline')" data-label="Vistas normales">
            <span v-if="s.baseline !== null">{{ compact.format(s.baseline) }}</span>
            <span v-else class="dim">sin datos</span>
          </td>
          <td :class="cell('reach')" data-label="Alcance">
            <span v-if="s.reach !== null">{{ formatPercent(s.reach, 0) }}</span>
            <span v-else class="dim">sin datos</span>
          </td>
          <td :class="cell('uploads')" data-label="Subidas 30 d">{{ s.uploads30 }}</td>
          <td :class="cell('hits')" data-label="Outliers 90 d">
            <span v-if="s.recent90 > 0" :title="`${formatPercent(s.hitRate!, 0)} de sus videos largos de 90 días`">
              {{ s.outliers90 }} de {{ s.recent90 }}<span class="sr-only">, {{ formatPercent(s.hitRate!, 0) }}</span>
            </span>
            <span v-else class="dim">sin videos</span>
          </td>
          <td :class="cell('best')" data-label="Mejor video">
            <a
              v-if="s.best"
              class="best"
              :href="videoUrl(s.best)"
              target="_blank"
              rel="noopener"
              :title="s.best.title"
              :class="`tier-${scoreTier(s.best.score)}`"
            >
              <span class="best-score">{{ formatScore(s.best.score!) }}</span>
              <span class="best-title">{{ s.best.title }}</span>
            </a>
            <span v-else class="dim">sin videos</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
