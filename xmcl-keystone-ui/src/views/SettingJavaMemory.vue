<template>
  <div class="flex flex-col">
    <v-progress-linear
      class="mt-3 rounded"
      :value="memoryProgress"
      color="blue"
      height="25"
      reverse
    >
      <template #default>
        <div class="flex items-center justify-center">
          <v-icon
            left
          >
            memory
          </v-icon>
          <strong class="flex flex-grow-0 items-center justify-center">
            {{ t('java.systemMemory') }}
            {{ getExpectedSize(sysmem.free, 'B') }} / {{ getExpectedSize(sysmem.total, 'B') }}
          </strong>
        </div>
      </template>
    </v-progress-linear>

    <v-progress-linear
      class="mt-3 rounded"
      :active="assignMemory !== false"
      :value="minMemoryProgress"
      color="deep-orange"
      :buffer-value="maxMemoryProgress"
      striped
      stream
      height="25"
    >
      <template #default>
        <strong class="pl-4">
          {{ t('java.minMemory') + ' ' + getExpectedSize(minMemory, 'B') }}
        </strong>
        <div class="flex-grow" />
        <strong class="pr-4">
          {{ t('java.maxMemory') + ' ' + getExpectedSize(maxMemory, 'B') }}
        </strong>
      </template>
    </v-progress-linear>
    <v-range-slider
      v-if="assignMemory !== false"
      v-model="mem"
      :input-value="mem"
      :disabled="assignMemory !== true"
      :max="sysmem.total"
      min="0"
      :step="step"
      class="z-10 mt-[-25px]"
      height="25"
      track-fill-color="transparent"
      track-color="transparent"
      color="red"
      hide-details
    >
      <template #thumb-label="{ value }">
        {{ getExpectedSize(value, '', 1) }}
      </template>
    </v-range-slider>
  </div>
</template>
<script lang="ts" setup>
import { getExpectedSize } from '@/util/size'
import { Ref } from 'vue'
import { BaseServiceKey, JavaRecord } from '@xmcl/runtime-api'
import { useService } from '@/composables'

const props = defineProps<{
  assignMemory: boolean | 'auto'
  min: number
  max: number
}>()
const emit = defineEmits(['update:max', 'update:min'])

const { t } = useI18n()
const { getMemoryStatus } = useService(BaseServiceKey)

const step = 1024 * 1024 * 512
const sysmem: Ref<{ total: number; free: number }> = ref({ total: 0, free: 0 })

const memoryProgress = computed(() => (sysmem.value.total - sysmem.value.free) / sysmem.value.total * 100)
const minMemory = computed(() => props.assignMemory === 'auto' ? (sysmem.value.free - 512 * 1024 * 1024) : props.min * 1024 * 1024)
const maxMemory = computed(() => props.assignMemory === 'auto' ? sysmem.value.total : props.max * 1024 * 1024)

const mem = computed({
  get(): [number, number] {
    return [minMemory.value, maxMemory.value]
  },
  set(mem: [number, number]) {
    emit('update:min', Math.floor(mem[0] / 1024 / 1024))
    emit('update:max', Math.floor(mem[1] / 1024 / 1024))
  },
})

const minMemoryProgress = computed(() => (minMemory.value) / (sysmem.value.total || 1) * 100)
const maxMemoryProgress = computed(() => (maxMemory.value) / (sysmem.value.total || 1) * 100)

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
  interval = setInterval(updateTotalMemory, 1000)
})

</script>
