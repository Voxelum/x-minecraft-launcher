<template>
  <v-snackbar
    v-model="data.show"
    location="top right"
    :timeout="data.level === 'error' ? -1 : 6000"
    :color="surfaceColor"
    rounded="lg"
    :min-width="320"
    :max-width="480"
    elevation="8"
    class="select-none app-notifier"
  >
    <div class="flex items-center gap-3 py-1">
      <div
        v-if="data.level"
        class="level-badge flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
        :style="{ backgroundColor: `rgba(var(--v-theme-${colors[data.level]}), 0.18)` }"
      >
        <v-icon
          :color="colors[data.level]"
          size="small"
        >
          {{ icons[data.level] }}
        </v-icon>
      </div>

      <div class="min-w-0 flex-1">
        <div
          v-if="data.title"
          class="flex items-center gap-2 text-sm font-medium leading-snug"
        >
          <span class="min-w-0 truncate">{{ data.title }}</span>
          <span
            v-if="displayedCount > 1"
            class="count-badge flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold opacity-80"
          >
            × {{ displayedCount }}
          </span>
        </div>
        <div
          v-if="data.body"
          class="text-caption mt-1 leading-relaxed opacity-80"
        >
          {{ data.body }}
        </div>

        <div
          v-if="data.operations.length > 0"
          class="mt-3 flex flex-wrap items-center gap-2"
        >
          <v-btn
            v-for="op in data.operations"
            :key="op.text"
            :color="op.color || colors[data.level || 'info']"
            :prepend-icon="op.icon"
            size="small"
            variant="tonal"
            @click="op.handler(); close()"
          >
            {{ op.text }}
          </v-btn>
        </div>
      </div>
    </div>

    <template #actions>
      <v-btn
        v-if="data.more"
        v-shared-tooltip="() => t('shared.next')"
        icon="arrow_right"
        variant="text"
        size="small"
        @click="more"
      />
      <v-btn
        icon="close"
        variant="text"
        size="small"
        @click="close"
      />
    </template>
  </v-snackbar>
</template>

<script lang="ts" setup>
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { Level, LocalNotification, kNotificationQueue } from '../composables/notifier'
import { injection } from '@/util/inject'

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
const close = () => {
  data.show = false
  // Drop the currently-shown entry from the queue. Without this the watcher
  // below would immediately re-show the same notification.
  if (currentRef.value) {
    const idx = queue.value.indexOf(currentRef.value)
    if (idx >= 0) queue.value.splice(idx, 1)
    currentRef.value = null
  }
}
const more = () => {
  if (data.more) {
    data.more()
    close()
  }
}

// Reference to the notification object currently being shown. Held so that
// (a) new duplicates can merge into its `count` while it is still visible and
// (b) `close()` can remove it from the queue.
const currentRef = shallowRef<LocalNotification | null>(null)
// Live count from the underlying queue entry — updates reactively when the
// notifier merges more duplicates into the same record while the toast is up.
const displayedCount = computed(() => currentRef.value?.count ?? 1)

function consume() {
  // Show the most recently added notification (LIFO) but keep it in the queue
  // until the user dismisses it, so further duplicates can merge in.
  const last = queue.value[queue.value.length - 1]
  if (last) {
    currentRef.value = last
    data.level = last.level ?? ''
    data.title = last.title
    data.show = true
    data.more = last.more
    data.body = last.body ?? ''
    data.operations = last.operations ?? []
  }
}
watch(queueLength, (newLength, oldLength) => {
  if (newLength > oldLength && !data.show) {
    consume()
  }
})

// Pull next item from the queue when the user dismisses the current one
watch(() => data.show, (shown) => {
  if (!shown && queue.value.length > 0) {
    setTimeout(consume, 200)
  }
})

const { t } = useI18n()

onMounted(() => { })
onUnmounted(() => { })

const icons = {
  success: 'check_circle',
  info: 'info',
  warning: 'warning',
  error: 'error',
}
const colors = {
  success: 'success',
  error: 'error',
  info: 'info',
  warning: 'warning',
}

// Subtle surface tint based on level so the snackbar feels themed but not loud
const surfaceColor = computed(() => 'surface')
</script>

<style scoped>
.app-notifier :deep(.v-snackbar__wrapper) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  /* Keep title + actions on one row; the inner content already truncates. */
  flex-wrap: nowrap;
}

.app-notifier :deep(.v-snackbar__content) {
  padding: 12px 14px;
  /* Allow the flex item to shrink below its intrinsic width so the actions
     column (close button) is never pushed to the next line. */
  min-width: 0;
}

.app-notifier :deep(.v-snackbar__actions) {
  flex-shrink: 0;
  flex-wrap: nowrap;
}

.count-badge {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
</style>
