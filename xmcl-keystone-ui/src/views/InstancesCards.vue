<template>
  <div
    class="flex h-full w-full select-none flex-col items-start justify-start gap-4 overflow-auto"
  >
    <template v-for="(inst, i) of instancesByTime">
      <div
        :key="i + 'title'"
        class="flex w-full flex-1 flex-grow-0 justify-center"
        style="color: grey;"
      >
        {{ title[i] }}
      </div>
      <div
        :key="i + 'instances'"
        class="grid w-full grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4"
      >
        <InstanceCard
          v-for="instance in inst"
          :key="instance.path"
          :instance="instance"
          @click.stop="emit('select', instance.path)"
          @delete="emit('delete', instance)"
          @dragstart="emit('dragstart', instance)"
          @dragend="emit('dragend')"
        />
      </div>
    </template>
  </div>
</template>

<script lang=ts setup>
import { Instance } from '@xmcl/runtime-api'
import InstanceCard from './InstancesCard.vue'
import { Ref } from 'vue'

const props = defineProps<{ instances: Instance[] }>()
const emit = defineEmits(['select', 'dragstart', 'dragend', 'delete'])
const { t } = useI18n()
const now = Date.now()
const oneDay = 1000 * 60 * 60 * 24
const threeDays = oneDay * 3
const title = computed(() => [
  t('instanceAge.today'),
  t('instanceAge.threeDay'),
  t('instanceAge.older'),
])
const instancesByTime: Ref<Instance[][]> = computed(() => {
  const todayR = []
  const threeR = []
  const other = []
  for (const p of props.instances) {
    const diff = now - p.lastAccessDate
    if (diff <= oneDay) {
      todayR.push(p)
    } else if (diff <= threeDays) {
      threeR.push(p)
    } else {
      other.push(p)
    }
  }
  const result = []
  if (todayR.length > 0) result.push(todayR)
  if (threeR.length > 0) result.push(threeR)
  if (other.length > 0) result.push(other)
  return result
})
</script>
