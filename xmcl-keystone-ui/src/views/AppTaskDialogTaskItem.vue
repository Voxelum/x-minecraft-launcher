<template>
  <v-list-item
    :three-line="!!(localized.subtitle && (item.error || (item.progress && 'url' in item.progress)))"
  >
    <v-list-item-content>
      <v-list-item-title>
        {{ localized.title }}
      </v-list-item-title>
      <v-list-item-subtitle v-if="localized.subtitle">
        <div style="color: grey; font-size: 12px; font-style: italic; max-width: 400px;">
        {{ localized.subtitle }}
        </div>
      </v-list-item-subtitle>
      <v-list-item-subtitle
        v-if="item.error && typeof item.error === 'object' && 'message' in item.error"
        class="text-red-400"
        style="color: grey; font-size: 12px; font-style: italic; max-width: 400px; word-wrap: normal; overflow-wrap: break-word; white-space: normal;"
      >
        <AppTaskDialogTaskViewMessage :value="String(item.error.message)" />
      </v-list-item-subtitle>
      <v-list-item-subtitle
        v-else-if="item.progress && 'url' in item.progress"
        class="text-red-400"
        style="color: grey; font-size: 12px; font-style: italic; max-width: 400px; word-wrap: normal; overflow-wrap: break-word; white-space: normal;"
      >
        {{ item.progress.url }}
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action
      class="self-center!"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
    >
      <div class="flex items-center justify-center gap-1 mr-2">
        <div v-if="item.state === TaskState.Failed">
          {{ t('task.failed') }}
          <v-icon
            color="error"
            :size="20"
            style="border-radius: 100%; padding: 3px;"
          >
            error_outline
          </v-icon>
        </div>
        <div v-else-if="item.state === TaskState.Cancelled">
          {{ t('task.cancelled') }}
          <v-icon
            :size="20"
            style="border-radius: 100%; padding: 3px;"
          >
            stop
          </v-icon>
        </div>
        <div v-else-if="item.state === TaskState.Succeed">
          <v-icon :color="color" :size="20" style="border-radius: 100%; padding: 3px;">
            check
          </v-icon>
        </div>
        <template v-if="item.state === TaskState.Running">
          <span
            style="margin-right: 7px"
          >{{ percentage.toFixed(2) }} %</span>
          <v-icon
            v-if="hovered"
            v-ripple
            :size="20"
            style="border-radius: 100%; padding: 3px;"
            :color="color"
            @click.stop="onCancel"
          >
            close
          </v-icon>
          <v-progress-circular
            v-else-if="indeterminate || !hovered"
            style="margin-left: 6px; padding: 3px;"
            class="mb-0"
            :color="isDark ? 'white' : undefined"
            small
            :size="20"
            :value="percentage"
            :width="3"
            :indeterminate="indeterminate"
          />
        </template>
      </div>
    </v-list-item-action>
  </v-list-item>
</template>

<script lang=ts setup>
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
const percentage = computed(() => current.value / total.value * 100)

function onTaskClick() {
  if (props.item.error && typeof props.item.error === 'object' && 'message' in props.item.error && typeof props.item.error.message === 'string') {
    windowController.writeClipboard(props.item.error.message ?? '')
  }
}

function onCancel() {
  emit('cancel')
}
</script>
