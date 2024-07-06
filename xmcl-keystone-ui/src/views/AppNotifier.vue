<template>
  <v-snackbar
    v-model="data.show"
    :multi-line="data.operations.length > 0"
    :top="true"
    :right="true"
    class="select-none"
  >
    <v-icon
      v-if="data.level"
      :color="colors[data.level]"
      left
    >
      {{ icons[data.level] }}
    </v-icon>

    <span v-if="data.level === 'error' || data.level === 'warning'">{{ levelText }}</span>

    <span v-if="!data.body && !data.operations">
      {{ data.title }}
    </span>
    <div
      v-else
      class="w-full"
    >
      <v-card
        color="transparent"
        flat
      >
        <v-card-title>
          {{ data.title }}
        </v-card-title>
        <v-card-text v-if="data.body">
          {{ data.body }}
        </v-card-text>
        <v-card-actions v-if="data.operations.length > 0">
          <div class="flex-grow" />
          <v-btn
            v-for="op in data.operations"
            :key="op.text"
            text
            small
            :color="op.color"
            @click="op.handler(); close()"
          >
            <v-icon
              v-if="op.icon"
              left
            >
              {{ op.icon }}
            </v-icon>
            {{ op.text }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>
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
import { useEventListener } from '@vueuse/core'

const data = reactive({
  show: false,
  level: '' as Level | '',
  title: '',
  body: '',
  more: (() => { }) as ((() => void) | undefined),
  operations: [] as {
    text: string
    icon?: string
    color?: string
    handler: () => void
  }[],
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
    data.level = not.level ?? ''
    data.title = not.title
    data.show = true
    data.more = not.more
    data.body = not.body ?? ''
    data.operations = not.operations ?? []
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
</script>

<style>
.v-snack__content {
  display: flex;
  padding-top: 0;
  padding-bottom: 4px;
}
</style>
