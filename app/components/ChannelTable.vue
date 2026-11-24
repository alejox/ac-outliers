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
  { key: 'uploads', label: 'Subidas en 30 días', hint: 'Videos y Shorts', value: (s) => s.uploads30 },
  { key: 'hits', label: 'Outliers en 90 días', hint: 'Videos largos que llegaron a 2× o más', value: (s) => s.hitRate ?? -1 },
  { key: 'best', label: 'Mejor video', hint: 'El de mayor score en 90 días', value: (s) => s.best?.score ?? -1 },
]

const sorted = computed(() => {
  const value = COLUMNS.find((c) => c.key === sortBy.value)!.value
  return [...props.stats].sort((a, b) => value(b) - value(a))
})
</script>

<template>
  <div class="table-wrap">
    <table class="channel-table">
      <thead>
        <tr>
          <th scope="col">Canal</th>
          <th
            v-for="c in COLUMNS"
            :key="c.key"
            scope="col"
            :aria-sort="sortBy === c.key ? 'descending' : 'none'"
            :class="{ 'col-best': c.key === 'best' }"
          >
            <button type="button" :title="c.hint || undefined" @click="sortBy = c.key">{{ c.label }}</button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in sorted" :key="s.channel.id">
          <th scope="row">
            <button class="channel-link" type="button" :title="`Ver los videos de ${s.channel.title}`" @click="$emit('select', s.channel.id)">
              <img v-if="s.channel.thumbnailUrl" class="avatar" :src="s.channel.thumbnailUrl" alt="" loading="lazy" />
              <span v-else class="avatar avatar-blank" :style="{ '--hue': hueOf(s.channel.id) }" aria-hidden="true">
                {{ s.channel.title.charAt(0) }}
              </span>
              <span>{{ s.channel.title }}</span>
            </button>
          </th>
          <td>{{ s.channel.subscriberCount ? compact.format(s.channel.subscriberCount) : 'ocultos' }}</td>
          <td>{{ s.baseline === null ? 'sin datos' : compact.format(s.baseline) }}</td>
          <td>{{ s.reach === null ? 'sin datos' : formatPercent(s.reach, 0) }}</td>
          <td>{{ s.uploads30 }}</td>
          <td>
            <template v-if="s.recent90 > 0">
              {{ s.outliers90 }} de {{ s.recent90 }}
              <span class="dim">{{ formatPercent(s.hitRate!, 0) }}</span>
            </template>
            <span v-else class="dim">sin videos</span>
          </td>
          <td class="col-best">
            <a v-if="s.best" :href="videoUrl(s.best)" target="_blank" rel="noopener" :class="`tier-${scoreTier(s.best.score)}`">
              <strong>{{ formatScore(s.best.score!) }}</strong>
              {{ s.best.title }}
            </a>
            <span v-else class="dim">sin videos</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
