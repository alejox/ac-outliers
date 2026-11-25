<script setup lang="ts">
/** Miniatura 16:9 con la insignia del score arriba a la izquierda y la duración abajo a la derecha, como en YouTube. */
const props = defineProps<{
  src?: string | null
  /** Sin imagen: texto y tono del relleno. */
  title: string
  seed: string
  score?: number | null
  /** "12:04", "Short" o nada. */
  duration?: string
  /** Oculta la insignia (por ejemplo, junto a una cifra grande que ya la dice). */
  plain?: boolean
}>()

const tier = computed(() => badgeTier(props.score ?? null))
const word = computed(() => thumbWord(props.title))
/** El texto de relleno se achica si una palabra es larga, para no partirla. */
const fit = computed(() => {
  const longest = Math.max(4, ...word.value.split(' ').map((w) => w.length))
  return `${Math.min(13, 60 / (longest * 0.56)).toFixed(1)}cqw`
})
const variant = computed(() => (hueOf(props.seed + props.title) % 4) + 1)
</script>

<template>
  <span class="vthumb" :class="[`vthumb-v${variant}`, { 'has-image': src }]" :style="{ '--hue': hueOf(seed) }">
    <img v-if="src" :src="src" alt="" loading="lazy" />
    <span v-else class="vthumb-word" :style="{ fontSize: fit }" aria-hidden="true">{{ word }}</span>
    <span v-if="!plain && score != null" class="score-badge" :class="`is-${tier}`">{{ formatScore(score) }}</span>
    <span v-if="duration" class="vthumb-dur">{{ duration }}</span>
  </span>
</template>
