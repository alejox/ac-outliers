<script setup lang="ts">
import type { Channel, ScoredVideo } from '~~/shared/outliers'

defineProps<{ video: ScoredVideo; channel?: Channel }>()
</script>

<template>
  <li class="row" :class="`tier-${scoreTier(video.score)}`">
    <a class="thumb" :href="videoUrl(video)" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
      <img v-if="video.thumbnailUrl" :src="video.thumbnailUrl" alt="" loading="lazy" />
      <span v-else class="thumb-blank" :style="{ '--hue': hueOf(video.channelId) }">{{ channel?.title.charAt(0) }}</span>
      <span class="duration">{{ video.isShort ? 'Short' : formatDuration(video.durationSeconds) }}</span>
    </a>

    <div class="info">
      <h3>
        <a :href="videoUrl(video)" target="_blank" rel="noopener">{{ video.title }}</a>
      </h3>
      <p class="byline">
        <span>{{ channel?.title }}</span>
        <span v-if="channel?.subscriberCount">{{ compact.format(channel.subscriberCount) }} suscriptores</span>
        <span>{{ formatAge(video.ageDays) }}</span>
      </p>
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
      <div v-if="$slots.default" class="row-action">
        <slot />
      </div>
    </div>

    <div class="score">
      <template v-if="video.score !== null">
        <p class="score-value">{{ formatScore(video.score) }}</p>
        <div class="strip" role="img" :aria-label="`${formatScore(video.score)} de lo normal en este canal`">
          <span class="strip-fill" :style="stripFill(video.score)" />
          <span class="strip-normal" :style="{ left: `${NORMAL_AT}%` }" />
          <span class="strip-dot" :style="{ left: `${stripPosition(video.score)}%` }" />
        </div>
        <p class="strip-caption" :style="{ paddingLeft: `${NORMAL_AT}%` }" aria-hidden="true"><span>normal</span></p>
      </template>
      <p v-else class="score-missing">Pocos videos para comparar</p>
    </div>
  </li>
</template>
