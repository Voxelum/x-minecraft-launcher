<template>
  <v-list-item
    class="task-item"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <v-list-item-title class="font-medium pr-2">
      {{ localized.title }}
    </v-list-item-title>
    <v-list-item-subtitle v-if="localized.subtitle" class="task-item__subtitle">
      {{ localized.subtitle }}
    </v-list-item-subtitle>
    <v-list-item-subtitle
      v-if="item.error && typeof item.error === 'object' && 'message' in item.error"
      class="task-item__error"
    >
      <AppTaskDialogTaskViewMessage :value="String(item.error.message)" />
    </v-list-item-subtitle>
    <v-list-item-subtitle
      v-else-if="item.progress && 'url' in item.progress"
      class="task-item__url"
    >
      {{ item.progress.url }}
    </v-list-item-subtitle>

    <template #append>
      <div class="flex items-center gap-2 ml-2">
        <template v-if="item.state === TaskState.Failed">
          <span class="text-xs text-error font-semibold">{{ t('task.failed') }}</span>
          <v-icon color="error" size="20">error_outline</v-icon>
        </template>
        <template v-else-if="item.state === TaskState.Cancelled">
          <span class="text-xs text-medium-emphasis font-semibold">{{ t('task.cancelled') }}</span>
          <v-icon size="20">stop</v-icon>
        </template>
        <template v-else-if="item.state === TaskState.Succeed">
          <v-icon color="green" size="20">check_circle</v-icon>
        </template>
        <template v-else-if="item.state === TaskState.Running">
          <span class="text-xs font-semibold tabular-nums">
            {{ percentage.toFixed(1) }}%
          </span>
          <v-btn
            v-if="hovered"
            icon
            variant="text"
            size="x-small"
            :color="color"
            @click.stop="onCancel"
          >
            <v-icon size="18">close</v-icon>
          </v-btn>
          <v-progress-circular
            v-else
            :color="isDark ? 'white' : 'primary'"
            :size="20"
            :width="2.5"
            :model-value="percentage"
            :indeterminate="indeterminate"
          />
        </template>
      </div>
    </template>
  </v-list-item>
</template>

<script lang="ts" setup>
import { useLocalizedTaskFunc } from '@/composables/task'
import { kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'
import { Tasks, TaskState } from '@xmcl/runtime-api'
import AppTaskDialogTaskViewMessage from './AppTaskDialogTaskViewMessage'

const props = defineProps<{
  item: Tasks
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
}>()

const { t } = useI18n()
const { isDark } = injection(kTheme)
const localizeTask = useLocalizedTaskFunc()

const hovered = ref(false)
const localized = computed(() => localizeTask(props.item))

const color = computed(() => {
  switch (props.item.state) {
    case TaskState.Succeed:
      return 'green'
    case TaskState.Cancelled:
    case TaskState.Running:
      return isDark.value ? 'white' : ''
    case TaskState.Failed:
      return 'error'
    default:
      return isDark.value ? 'white' : ''
  }
})

const progress = computed(() => props.item.progress)
const total = computed(() => progress.value?.total ?? -1)
const current = computed(() => progress.value?.progress ?? 0)
const indeterminate = computed(() => !total.value || total.value === -1)
const percentage = computed(() => {
  if (total.value <= 0) return 0
  const value = (current.value / total.value) * 100
  return Math.min(100, Math.max(0, value))
})

function onTaskClick() {
  if (
    props.item.error &&
    typeof props.item.error === 'object' &&
    'message' in props.item.error &&
    typeof props.item.error.message === 'string'
  ) {
    windowController.writeClipboard(props.item.error.message ?? '')
  }
}

function onCancel() {
  emit('cancel')
}
</script>

<style scoped>
.task-item {
  /* Extra breathing room on top of Vuetify's default v-list-item padding:
     each row carries title + subtitle + url, so it reads dense otherwise. */
  padding-top: 12px;
  padding-bottom: 12px;
  min-height: 64px;
}

.task-item + .task-item {
  margin-top: 4px;
}

.task-item__subtitle {
  font-size: 12px;
  font-style: italic;
  opacity: 0.7;
  max-width: 460px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item__url {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  opacity: 0.55;
  max-width: 460px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item__error {
  font-size: 12px;
  color: rgb(var(--v-theme-error));
  max-width: 460px;
  word-wrap: normal;
  overflow-wrap: break-word;
  white-space: normal;
}
</style>
