<template>
  <v-snackbar
    v-model="data.show"
    :top="true"
    :right="true"
  >
    <v-icon
      :color="colors[data.level]"
      left
    >
      {{ icons[data.level] }}
    </v-icon>

    <span v-if="!data.full">{{ levelText }}</span>

    {{ data.title }}
    <template #action>
      <v-btn
        v-if="data.more"
        icon
        text
        @click="more"
      >
        <v-icon>arrow_right</v-icon>
      </v-btn>
      <v-btn
        icon
        color="pink"
        text
        @click="close"
      >
        <v-icon>close</v-icon>
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script lang=ts setup>
import { Level, kNotificationQueue } from '../composables/notifier'
import { injection } from '@/util/inject'

const data = reactive({
  show: false,
  level: 'info' as Level,
  title: '',
  body: '',
  more: (() => { }) as ((() => void) | undefined),
  full: false,
})
const queue = injection(kNotificationQueue)
const queueLength = computed(() => queue.value.length)
const close = () => { data.show = false }
const more = () => {
  if (data.more) {
    data.more()
    close()
  }
}
function consume() {
  const not = queue.value.pop()
  if (not) {
    data.level = not.level
    data.title = not.title
    data.full = not.full ?? false
    data.show = true
    data.more = not.more
  }
}

watch(queueLength, (newLength, oldLength) => {
  if (newLength > oldLength && !data.show) {
    consume()
  }
})
const { t } = useI18n()

const levelText = computed(() => data.level === 'info' ? t('logLevel.info') : data.level === 'error' ? t('logLevel.error') : data.level === 'success' ? t('logLevel.success') : t('logLevel.warning'))

// function handleNotification(payload: TaskLifeCyclePayload) {
//   const handler = registry[payload.type]
//   if (handler) {
//     queue.value.push({ level: handler.level, title: handler.title(payload), more: handler.more, full: handler.full })
//   } else {
//     console.warn(`Cannot handle the notification ${payload.type}`)
//   }
// }
onMounted(() => {
  // taskMonitor.on('task-start', handleNotification)
  // ipc.on('notification', handleNotification)
})
onUnmounted(() => {
  // ipc.removeListener('notification', handleNotification)
})

const icons = {
  success: 'check_circle',
  info: 'info',
  warning: 'priority_high',
  error: 'warning',
}
const colors = {
  success: 'green',
  error: 'red',
  info: 'white',
  warning: 'orange',
}

// return {
//   ...refs,
// }

// export default defineComponent({
//   setup() {
//     const { level, title, more, show, full } = useNotifyQueueConsumer()
//     return {
//       close() { show.value = false },
//       level,
//       title,
//       show,
//       more,
//       full,
//     }
//   },
// })
</script>

<style>
</style>
