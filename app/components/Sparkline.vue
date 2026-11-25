<script setup lang="ts">
/** Línea de 1,5px sin relleno: blanca si sube, gris si baja o se queda igual. */
const props = defineProps<{ values: number[]; label: string; rising: boolean }>()

const W = 160
const H = 28
const PAD = 3

const points = computed(() => {
  const v = props.values
  const max = Math.max(...v)
  const min = Math.min(...v)
  const span = max - min || 1
  return v.map((value, i) => ({
    x: PAD + (i * (W - PAD * 2)) / Math.max(v.length - 1, 1),
    y: max === min ? H / 2 : PAD + (1 - (value - min) / span) * (H - PAD * 2),
  }))
})
const line = computed(() => points.value.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
const last = computed(() => points.value[points.value.length - 1]!)
</script>

<template>
  <svg class="sparkline" :class="{ 'is-rising': rising }" :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" role="img" :aria-label="label">
    <polyline :points="line" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
    <circle :cx="last.x" :cy="last.y" r="2" fill="currentColor" />
  </svg>
</template>
