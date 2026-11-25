<script setup lang="ts">
/** Regla de desviación: de 0,25× a 32× en escala logarítmica, con lo normal (1×) marcado. */
defineProps<{ score: number }>()
</script>

<template>
  <div class="strip" role="img" :aria-label="`${formatScore(score)} de lo normal en este canal`">
    <span class="strip-fill" :style="stripFill(score)" />
    <span class="strip-normal" :style="{ left: `${NORMAL_AT}%` }" title="Lo normal en este canal" />
    <span class="strip-dot" :style="{ left: `${stripPosition(score)}%` }" />
  </div>
</template>
