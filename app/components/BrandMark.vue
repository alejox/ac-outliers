<script setup lang="ts">
import { BRAND_MARK } from '~~/shared/brand'

/** El símbolo de la marca. Es el único lugar de la app que lo dibuja: cambiar de logo es cambiar shared/brand.ts. */
withDefaults(defineProps<{ size?: number }>(), { size: 20 })
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <svg class="brand-mark" :viewBox="BRAND_MARK.viewBox" :width="size" :height="size" aria-hidden="true" v-html="BRAND_MARK.body" />
</template>
