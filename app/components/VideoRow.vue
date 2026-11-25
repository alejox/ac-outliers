<script setup lang="ts">
import type { Channel, ScoredVideo } from '~~/shared/outliers'

defineProps<{ video: ScoredVideo; channel?: Channel }>()
defineEmits<{ analyze: [video: ScoredVideo] }>()
</script>

<template>
  <li class="video has-action" :class="`tier-${scoreTier(video.score)}`">
    <p v-if="$slots.lead" class="video-lead">
      <slot name="lead" />
    </p>

    <div class="video-head">
      <a class="thumb" :href="videoUrl(video)" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
        <img v-if="video.thumbnailUrl" :src="video.thumbnailUrl" alt="" loading="lazy" />
        <span v-else class="thumb-blank" :style="{ '--hue': hueOf(video.channelId) }">{{ channel?.title.charAt(0) }}</span>
        <span v-if="video.isShort" class="duration duration-short">Short</span>
        <span v-else class="duration">{{ formatDuration(video.durationSeconds) }}</span>
      </a>

      <div class="video-text">
        <h3>
          <a :href="videoUrl(video)" target="_blank" rel="noopener">{{ video.title }}</a>
        </h3>
        <div class="video-action">
          <slot />
          <button class="button button-small button-outline" type="button" @click="$emit('analyze', video)">
            Analizar<span class="sr-only"> “{{ video.title }}”</span>
          </button>
        </div>
        <p class="byline">
          <span>{{ channel?.title }}</span>
          <span v-if="channel?.subscriberCount">{{ compact.format(channel.subscriberCount) }} suscriptores</span>
          <span>{{ formatAge(video.ageDays) }}</span>
        </p>
      </div>

    </div>

    <div class="score">
      <p v-if="video.score !== null" class="score-value">{{ formatScore(video.score) }}</p>
      <p v-else class="score-value score-none" aria-hidden="true">–</p>
      <ScoreStrip v-if="video.score !== null" :score="video.score" />
      <p v-else class="score-missing">Pocos videos para comparar</p>
    </div>

    <dl class="stats">
      <div>
        <dt>Vistas</dt>
        <dd>{{ compact.format(video.views) }}</dd>
      </div>
      <div>
        <dt>Lo normal</dt>
        <dd>{{ video.baseline === null ? 'sin datos' : compact.format(video.baseline) }}</dd>
      </div>
      <div :title="video.recentPace ? 'Ritmo desde la última actualización' : 'Promedio desde que se publicó'">
        <dt>{{ video.recentPace ? 'Por hora, ahora' : 'Por hora, promedio' }}</dt>
        <dd>{{ formatPace(video.viewsPerHour) }}</dd>
      </div>
      <div v-if="video.engagement !== null" title="Likes y comentarios por cada 100 vistas">
        <dt>Interacción</dt>
        <dd>{{ formatPercent(video.engagement) }}</dd>
      </div>
    </dl>
  </li>
</template>
