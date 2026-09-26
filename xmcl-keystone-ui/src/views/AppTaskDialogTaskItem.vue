<template>
  <v-list-item
    class="task-item"
    :class="{ 'task-item--running': item.state === TaskState.Running }"
    rounded="xl"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
  >
    <!-- Task Icon / Avatar on the left with operation corner badge -->
    <template #prepend>
      <div class="task-item__avatar mr-3.5 shrink-0 relative">
        <v-img
          v-if="taskIcon.type === 'image' && taskIcon.src"
          :src="taskIcon.src"
          class="w-11 h-11 rounded-xl overflow-hidden shadow-sm border border-white/10"
          cover
        >
          <template #placeholder>
            <div class="w-full h-full flex items-center justify-center bg-white/5">
              <v-icon size="20" class="opacity-40">inventory_2</v-icon>
            </div>
          </template>
        </v-img>
        <div
          v-else
          class="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
          :class="taskIcon.bgClass || 'bg-primary/15 text-primary'"
        >
          <v-icon size="22" :icon="taskIcon.icon || 'task_alt'" />
        </div>

        <!-- Corner Operation Badge with its own animated icon -->
        <div
          v-if="item.state === TaskState.Running"
          class="task-item__op-badge absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-md border border-black/30 backdrop-blur-sm"
          :class="opInfo.badgeBg"
        >
          <v-icon size="11" :class="opInfo.iconAnimClass">{{ opInfo.icon }}</v-icon>
        </div>
      </div>
    </template>

    <!-- Main Content -->
    <div class="flex-1 min-w-0 pr-2">
      <!-- Title row with operation pill -->
      <div class="flex items-center gap-2 mb-1 min-w-0">
        <!-- Operation pill (Update / Download / Install / etc.) -->
        <span
          class="task-item__op-pill inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 shadow-sm"
          :class="opInfo.badgeBg"
        >
          <v-icon size="10" :class="opInfo.iconAnimClass">{{ opInfo.icon }}</v-icon>
          {{ opInfo.label }}
        </span>

        <!-- Title -->
        <span class="font-semibold text-sm leading-snug truncate">
          {{ localized.title }}
        </span>
      </div>

      <!-- Subtitle & Progress Info -->
      <div class="task-item__subtitle flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span v-if="localized.subtitle" class="font-medium opacity-85">
          {{ localized.subtitle }}
        </span>

        <template v-if="item.state === TaskState.Running">
          <!-- Size progress: current / total -->
          <span v-if="sizeText" class="tabular-nums opacity-90 font-medium">
            {{ sizeText }}
          </span>

          <!-- Remaining size & ETA -->
          <span v-if="remainingText || etaText" class="text-amber-400 font-medium tabular-nums">
            ({{ [remainingText, etaText].filter(Boolean).join(' • ') }})
          </span>

          <!-- Speed -->
          <span v-if="speedText" class="text-primary font-semibold tabular-nums">
            {{ speedText }}
          </span>
        </template>
      </div>

      <!-- Error message if failed -->
      <div
        v-if="item.error && typeof item.error === 'object' && 'message' in item.error"
        class="task-item__error mt-1"
      >
        <AppTaskDialogTaskViewMessage :value="String(item.error.message)" />
      </div>

      <!-- Linear Progress Bar under text when running -->
      <div v-if="item.state === TaskState.Running" class="mt-2.5">
        <v-progress-linear
          :model-value="percentage"
          :indeterminate="indeterminate"
          :color="opInfo.color"
          height="4"
          rounded
          class="task-item__progress-bar"
        />
      </div>
    </div>

    <!-- Status badge & actions on the right -->
    <template #append>
      <div class="flex items-center gap-2 ml-3">
        <template v-if="item.state === TaskState.Failed">
          <v-chip size="small" color="error" variant="tonal" class="font-semibold text-xs gap-1">
            <v-icon start size="14">error_outline</v-icon>
            {{ t('task.failed') }}
          </v-chip>
        </template>
        <template v-else-if="item.state === TaskState.Cancelled">
          <v-chip size="small" variant="tonal" class="font-semibold text-xs opacity-70 gap-1">
            <v-icon start size="14">stop</v-icon>
            {{ t('task.cancelled') }}
          </v-chip>
        </template>
        <template v-else-if="item.state === TaskState.Succeed">
          <v-chip size="small" color="success" variant="tonal" class="font-semibold text-xs gap-1">
            <v-icon start size="14">check_circle</v-icon>
            {{ t('task.succeed') }}
          </v-chip>
        </template>
        <template v-else-if="item.state === TaskState.Running">
          <span class="text-xs font-bold tabular-nums min-w-[36px] text-right" :class="`text-${opInfo.color}`">
            {{ indeterminate ? '' : `${Math.round(percentage)}%` }}
          </span>
          <v-btn
            v-if="hovered"
            icon
            variant="text"
            size="x-small"
            color="error"
            @click.stop="onCancel"
          >
            <v-icon size="18">close</v-icon>
          </v-btn>
          <v-progress-circular
            v-else
            :color="opInfo.color"
            :size="22"
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
import { useTaskIcon, useTaskOperation } from '@/composables/taskIcon'
import { kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'
import { formatDuration, getExpectedSize } from '@/util/size'
import { Tasks, TaskState } from '@xmcl/runtime-api'
import AppTaskDialogTaskViewMessage from './AppTaskDialogTaskViewMessage'

const props = defineProps<{
  item: Tasks
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
}>()

const { t, locale } = useI18n()
const { isDark } = injection(kTheme)
const localizeTask = useLocalizedTaskFunc()
const { getTaskIcon } = useTaskIcon()
const { getTaskOperation } = useTaskOperation()

const hovered = ref(false)
const localized = computed(() => localizeTask(props.item))
const taskIcon = computed(() => getTaskIcon(props.item))
const opInfo = computed(() => getTaskOperation(props.item))

const progress = computed(() => props.item.progress)
const total = computed(() => progress.value?.total ?? -1)
const current = computed(() => progress.value?.progress ?? 0)
const indeterminate = computed(() => !total.value || total.value === -1)
const percentage = computed(() => {
  if (total.value <= 0) return 0
  const value = (current.value / total.value) * 100
  return Math.min(100, Math.max(0, value))
})

const speed = computed(() => {
  if (props.item.progress && 'speed' in props.item.progress && typeof (props.item.progress as any).speed === 'number' && (props.item.progress as any).speed > 0) {
    return (props.item.progress as any).speed as number
  }
  return 0
})

const speedText = computed(() => {
  if (speed.value > 0) {
    return `${getExpectedSize(speed.value)}/s`
  }
  return ''
})

const sizeText = computed(() => {
  if (total.value > 0) {
    return `${getExpectedSize(current.value)} / ${getExpectedSize(total.value)}`
  }
  return ''
})

const remainingBytes = computed(() => {
  if (total.value > current.value && total.value > 0) {
    return total.value - current.value
  }
  return 0
})

const remainingText = computed(() => {
  if (remainingBytes.value > 0) {
    return t('task.remaining', { size: getExpectedSize(remainingBytes.value) })
  }
  return ''
})

const etaText = computed(() => {
  if (speed.value > 0 && remainingBytes.value > 0) {
    const seconds = Math.ceil(remainingBytes.value / speed.value)
    return t('task.eta', { time: formatDuration(seconds, locale.value) })
  }
  return ''
})

function onCancel() {
  emit('cancel')
}
</script>

<style scoped>
.task-item {
  padding: 10px 14px;
  min-height: 64px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
}

.task-item:hover {
  background-color: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.06);
}

.task-item--running {
  background-color: rgba(var(--v-theme-primary), 0.03);
  border-color: rgba(var(--v-theme-primary), 0.1);
}

.task-item + .task-item {
  margin-top: 6px;
}

.task-item__subtitle {
  font-size: 12px;
  max-width: 460px;
}

.task-item__error {
  font-size: 12px;
  color: rgb(var(--v-theme-error));
  max-width: 460px;
  word-wrap: normal;
  overflow-wrap: break-word;
  white-space: normal;
}

/* Operation Animations */
@keyframes taskRotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes taskBounceSubtle {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(2px);
  }
}

@keyframes taskPulseSubtle {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.85;
  }
}

@keyframes taskUploadSubtle {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}

.task-anim-rotate {
  animation: taskRotate 2.2s linear infinite;
}

.task-anim-download {
  animation: taskBounceSubtle 1.2s ease-in-out infinite;
}

.task-anim-pulse {
  animation: taskPulseSubtle 1.6s ease-in-out infinite;
}

.task-anim-upload {
  animation: taskUploadSubtle 1.2s ease-in-out infinite;
}
</style>
