<template>
  <div class="java-memory">
    <!-- System memory bar with allocation overlay -->
    <div class="java-memory__system pb-2">
      <div class="flex items-center justify-between text-caption text-medium-emphasis mb-1">
        <span class="flex items-center gap-1">
          <v-icon size="small">memory</v-icon>
          {{ t('java.systemMemory', { free: getExpectedSize(sysmem.free, 'B'), total: getExpectedSize(sysmem.total, 'B') }) }}
        </span>
        <span v-if="!off">
          {{ t('java.allocation') }}: {{ getExpectedSize(displayMin * MB, 'B') }} – {{ getExpectedSize(displayMax * MB, 'B') }}
        </span>
      </div>
      <div class="java-memory__bar">
        <div
          class="java-memory__bar-used"
          :style="{ width: usedPercent + '%' }"
        />
        <div
          v-if="!off && sysmem.total"
          class="java-memory__bar-range"
          :style="{
            left: minPercent + '%',
            width: Math.max(maxPercent - minPercent, 0.5) + '%',
          }"
        />
      </div>
    </div>

    <!-- Min memory -->
    <div class="java-memory__row">
      <div class="java-memory__label">
        <v-icon size="small" color="deep-orange" class="mr-1">south</v-icon>
        <span>{{ t('java.minMemory') }}</span>
      </div>
      <v-slider
        :model-value="displayMin"
        :disabled="!manual"
        :min="MIN_MEM"
        :max="Math.max(MIN_MEM, displayMax - STEP)"
        :step="STEP"
        color="deep-orange"
        thumb-label
        hide-details
        density="compact"
        class="flex-1"
        @update:model-value="setMin"
      >
        <template #thumb-label="{ modelValue }">
          {{ formatMb(modelValue) }}
        </template>
      </v-slider>
      <v-text-field
        :model-value="displayMin"
        :disabled="!manual"
        type="number"
        :min="MIN_MEM"
        :max="Math.max(MIN_MEM, displayMax - STEP)"
        :step="STEP"
        suffix="MB"
        variant="outlined"
        density="compact"
        hide-details
        class="java-memory__input"
        @update:model-value="onMinInput"
      />
    </div>

    <!-- Max memory -->
    <div class="java-memory__row">
      <div class="java-memory__label">
        <v-icon size="small" color="primary" class="mr-1">north</v-icon>
        <span>{{ t('java.maxMemory') }}</span>
      </div>
      <v-slider
        :model-value="displayMax"
        :disabled="!manual"
        :min="Math.max(MIN_MAX, displayMin + STEP)"
        :max="totalMb"
        :step="STEP"
        color="primary"
        thumb-label
        hide-details
        density="compact"
        class="flex-1"
        @update:model-value="setMax"
      >
        <template #thumb-label="{ modelValue }">
          {{ formatMb(modelValue) }}
        </template>
      </v-slider>
      <v-text-field
        :model-value="displayMax"
        :disabled="!manual"
        type="number"
        :min="Math.max(MIN_MAX, displayMin + STEP)"
        :max="totalMb"
        :step="STEP"
        suffix="MB"
        variant="outlined"
        density="compact"
        hide-details
        class="java-memory__input"
        @update:model-value="onMaxInput"
      />
    </div>

    <!-- Quick presets -->
    <div v-if="manual && presets.length" class="flex flex-wrap items-center gap-1">
      <span class="text-caption text-medium-emphasis mr-2">{{ t('java.presets') }}</span>
      <v-btn
        v-for="p in presets"
        :key="p.value"
        :variant="p.value === props.max ? 'tonal' : 'text'"
        :color="p.value === props.max ? 'primary' : undefined"
        size="x-small"
        @click="setMax(p.value)"
      >
        {{ p.label }}
      </v-btn>
    </div>
    <!-- Auto mode hint -->
    <div v-if="auto" class="text-caption text-medium-emphasis d-flex align-center gap-1">
      <v-icon size="small">smart_toy</v-icon>
      {{ t('java.autoHint') }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useService } from '@/composables'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'

const props = defineProps<{
  assignMemory: boolean | 'auto'
  min: number
  max: number
}>()
const emit = defineEmits(['update:max', 'update:min'])

const { t } = useI18n()
const { getMemoryStatus } = useService(BaseServiceKey)

const MB = 1024 * 1024
const STEP = 256
const MIN_MEM = 256
const MIN_MAX = 1024

const sysmem: Ref<{ total: number; free: number }> = ref({ total: 0, free: 0 })

const auto = computed(() => props.assignMemory === 'auto')
const manual = computed(() => props.assignMemory === true)
const off = computed(() => props.assignMemory === false)

const totalMb = computed(() => Math.floor(sysmem.value.total / MB) || 8192)

const presets = computed(() => {
  return [2, 4, 6, 8, 12, 16]
    .map((n) => ({ label: `${n} GB`, value: n * 1024 }))
    .filter((p) => p.value <= totalMb.value)
})

const { enabledMods } = injection(kInstanceModsContext)

const autoMin = computed(() => {
  const modCount = enabledMods.value.length
  let minMem = 1024
  if (modCount > 0) {
    const level = modCount / 25
    const rounded = Math.floor(level)
    const percentage = level - rounded
    minMem = rounded * 1024 + (percentage > 0.5 ? 512 : 0) + 1024
  }
  return minMem
})

const displayMin = computed(() => {
  if (auto.value) return autoMin.value
  const raw = Math.max(MIN_MEM, props.min || MIN_MEM)
  // Defensive clamp: never render a min that exceeds max - STEP
  const ceiling = Math.max(MIN_MEM, (props.max || MIN_MAX) - STEP)
  return Math.min(raw, ceiling)
})
const displayMax = computed(() => (auto.value ? totalMb.value : Math.max(MIN_MAX, props.max || MIN_MAX)))

// Auto-correct invalid saved state where min > max - STEP
watch(
  [() => props.min, () => props.max, manual],
  ([min, max, isManual]) => {
    if (!isManual) return
    if (typeof min !== 'number' || typeof max !== 'number') return
    if (min > max - STEP) {
      emit('update:min', Math.max(MIN_MEM, max - STEP))
    }
  },
  { immediate: true },
)

const usedPercent = computed(() => {
  if (!sysmem.value.total) return 0
  return ((sysmem.value.total - sysmem.value.free) / sysmem.value.total) * 100
})
const minPercent = computed(() => (sysmem.value.total ? (displayMin.value * MB) / sysmem.value.total * 100 : 0))
const maxPercent = computed(() => (sysmem.value.total ? (displayMax.value * MB) / sysmem.value.total * 100 : 0))

function formatMb(mb: number) {
  if (mb >= 1024) {
    const gb = mb / 1024
    return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`
  }
  return `${mb} MB`
}

function snap(v: number) {
  return Math.round(v / STEP) * STEP
}

function setMin(v: number | undefined | null) {
  if (v === undefined || v === null || isNaN(Number(v))) return
  let value = Math.max(MIN_MEM, snap(Number(v)))
  if (value > displayMax.value - STEP) value = Math.max(MIN_MEM, displayMax.value - STEP)
  emit('update:min', value)
}

function setMax(v: number | undefined | null) {
  if (v === undefined || v === null || isNaN(Number(v))) return
  let value = Math.max(MIN_MAX, snap(Number(v)))
  if (value > totalMb.value) value = totalMb.value
  // Ensure max stays at least one step above min
  const floor = Math.max(MIN_MAX, displayMin.value + STEP)
  if (value < floor) value = floor
  emit('update:max', value)
}

function onMinInput(v: string | number | null) {
  setMin(typeof v === 'number' ? v : parseInt(v ?? '', 10))
}
function onMaxInput(v: string | number | null) {
  setMax(typeof v === 'number' ? v : parseInt(v ?? '', 10))
}

const updateTotalMemory = () => {
  getMemoryStatus().then(({ total, free }) => {
    sysmem.value.total = total
    sysmem.value.free = free
  })
}

let interval: any

onUnmounted(() => {
  clearInterval(interval)
})
onMounted(() => {
  updateTotalMemory()
  interval = setInterval(updateTotalMemory, 2000)
})
</script>

<style scoped>
.java-memory {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.java-memory__bar {
  position: relative;
  height: 8px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), 0.06);
  overflow: hidden;
}
.java-memory__bar-used {
  position: absolute;
  inset: 0 auto 0 0;
  background: rgba(var(--v-theme-on-surface), 0.18);
}
.java-memory__bar-range {
  position: absolute;
  top: 0;
  bottom: 0;
  background: linear-gradient(
    to right,
    rgb(var(--v-theme-warning)),
    rgb(var(--v-theme-primary))
  );
  border-radius: 4px;
}
.java-memory__row {
  display: grid;
  grid-template-columns: minmax(96px, max-content) 1fr 116px;
  align-items: center;
  gap: 12px;
}
.java-memory__label {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
}
.java-memory__input :deep(input) {
  text-align: right;
}
</style>
