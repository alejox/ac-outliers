<script setup lang="ts">
import {
  DURATION_OPTIONS,
  SIZE_OPTIONS,
  VIEWS_OPTIONS,
  extraFilterCount,
  type FilterState,
  type Format,
} from '~~/shared/filters'

const filters = defineModel<FilterState>({ required: true })

defineProps<{
  /** Categorías que existen entre los videos que se están filtrando. */
  categories: { id: string; name: string }[]
  showFormat?: boolean
  showPeriod?: boolean
}>()

const open = ref(false)
const extra = computed(() => extraFilterCount(filters.value))

const FORMATS: { value: Format; label: string }[] = [
  { value: 'long', label: 'Videos largos' },
  { value: 'short', label: 'Shorts' },
  { value: 'all', label: 'Todo' },
]

function clearExtra() {
  Object.assign(filters.value, { channelSize: 'any', minViews: 0, duration: 'any', category: '' })
}
</script>

<template>
  <div class="filters">
    <div v-if="showFormat" class="segmented" role="group" aria-label="Formato">
      <button
        v-for="option in FORMATS"
        :key="option.value"
        type="button"
        :aria-pressed="filters.format === option.value"
        @click="filters.format = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <label v-if="showPeriod" class="field">
      <span>Publicados en</span>
      <select v-model.number="filters.periodDays">
        <option :value="7">7 días</option>
        <option :value="30">30 días</option>
        <option :value="90">90 días</option>
        <option :value="365">1 año</option>
        <option :value="0">Cualquier fecha</option>
      </select>
    </label>

    <label class="field">
      <span>Score mínimo</span>
      <select v-model.number="filters.minScore">
        <option :value="0">Sin mínimo</option>
        <option :value="1.5">1,5×</option>
        <option :value="2">2×</option>
        <option :value="3">3×</option>
        <option :value="5">5×</option>
        <option :value="10">10×</option>
      </select>
    </label>

    <label class="field">
      <span>Ordenar por</span>
      <select v-model="filters.sort">
        <option value="score">Score</option>
        <option value="pace">Vistas por hora</option>
        <option value="views">Vistas totales</option>
        <option value="engagement">Interacción</option>
        <option value="recent">Más recientes</option>
      </select>
    </label>

    <label class="field field-text">
      <span>Buscar en títulos</span>
      <input v-model="filters.title" type="search" placeholder="OBS, Claude, tutorial" autocomplete="off" />
    </label>

    <button class="button button-quiet more-filters" type="button" :aria-expanded="open" @click="open = !open">
      {{ open ? 'Menos filtros' : 'Más filtros' }}<span v-if="extra > 0" class="count">{{ extra }}</span>
    </button>
  </div>

  <div v-if="open" class="filters filters-extra">
    <label class="field">
      <span>Tamaño del canal</span>
      <select v-model="filters.channelSize">
        <option v-for="o in SIZE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>

    <label class="field">
      <span>Vistas mínimas</span>
      <select v-model.number="filters.minViews">
        <option v-for="o in VIEWS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>

    <label class="field">
      <span>Duración</span>
      <select v-model="filters.duration">
        <option v-for="o in DURATION_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </label>

    <label class="field">
      <span>Categoría</span>
      <select v-model="filters.category" :disabled="categories.length === 0">
        <option value="">{{ categories.length === 0 ? 'Sin datos todavía' : 'Todas' }}</option>
        <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>

    <button v-if="extra > 0" class="link-button" type="button" @click="clearExtra">Quitar estos filtros</button>
  </div>
</template>
