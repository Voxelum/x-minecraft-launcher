<template>
  <div
    style="display: flex; align-items: center; justify-content: center; margin-right: 7px; gap: 5px;"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <div v-if="item.state === 5">
      {{ t('task.failed') }}
    </div>
    <div v-else-if="item.state === 2">
      {{ t('task.cancelled') }}
    </div>
    <v-icon
      v-if="item.state === 1"
      v-ripple
      :size="20"
      style="border-radius: 100%; padding: 3px;"
      :color="color"
      @click="onPause"
    >
      pause
    </v-icon>
    <v-icon
      v-if="item.state !== 1 || hover"
      v-ripple
      :size="20"
      style="border-radius: 100%; padding: 3px;"
      :color="color"
      @click="onClick"
    >
      {{ icon }}
    </v-icon>
    <v-progress-circular
      v-else-if="indeterminate || !showNumber"
      style="margin-left: 6px; padding: 3px;"
      class="mb-0"
      :color="darkTheme ? 'white' : undefined"
      small
      :size="20"
      :value="percentage"
      :width="3"
      :indeterminate="indeterminate"
    />
    <span
      v-else
      style="margin-right: 7px"
    >{{ percentage.toFixed(2) }} %</span>
  </div>
</template>

<script lang=ts setup>
import { kTheme, useTheme } from '@/composables/theme'
import { TaskItem } from '@/entities/task'
import { injection } from '@/util/inject'
import { TaskState } from '@xmcl/runtime-api'

const props = defineProps<{
  item: TaskItem
  showNumber?: boolean
}>()
const emit = defineEmits(['cancel', 'resume', 'pause'])

const hover = ref(false)
const { t } = useI18n()
const { darkTheme } = injection(kTheme)
const color = computed(() => {
  switch (props.item.state) {
    case TaskState.Succeed:
      return 'green'
    case TaskState.Cancelled:
    case TaskState.Running:
    case TaskState.Paused:
      return darkTheme.value ? 'white' : ''
    case TaskState.Failed:
      return 'error'
    default:
      return darkTheme.value ? 'white' : ''
  }
})
const indeterminate = computed(() => !props.item.total || props.item.total === -1)
const icon = computed(() => {
  if (hover.value) {
    if (props.item.state === TaskState.Running) {
      return 'close'
    }
  }
  switch (props.item.state) {
    case TaskState.Succeed:
      return props.item.children && props.item.children.length > 0 ? 'done_all' : 'check'
    case TaskState.Cancelled:
      return 'stop'
    case TaskState.Failed:
      return 'error_outline'
    case TaskState.Paused:
      return 'play_arrow'
    default:
      return 'device_unknown'
  }
})
const percentage = computed(() => props.item.progress! / props.item.total! * 100)
const onClick = () => {
  if (props.item.state === TaskState.Running) {
    emit('cancel')
  } else if (props.item.state === TaskState.Paused) {
    emit('resume')
  }
}
const onPause = () => {
  emit('pause')
}
</script>

<style>
</style>
