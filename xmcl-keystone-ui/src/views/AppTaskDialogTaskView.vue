<template>
  <v-card flat class="task-dialog surface-card flex flex-col overflow-hidden min-h-[320px] max-w-full rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
    <!-- Header -->
    <div class="task-dialog__header flex items-center gap-3 px-5 py-4 flex-grow-0 border-b border-white/5">
      <div
        class="task-dialog__icon flex items-center justify-center rounded-xl"
        :class="{
          'task-dialog__icon--pulse': taskStats.running > 0 && primaryOp.type !== 'update',
          'task-dialog__icon--rotate': taskStats.running > 0 && primaryOp.type === 'update',
        }"
      >
        <v-icon
          size="22"
          :color="taskStats.running > 0 ? primaryOp.color : 'primary'"
          :class="taskStats.running > 0 ? primaryOp.iconAnimClass : ''"
        >
          {{ taskStats.running > 0 ? primaryOp.icon : 'task_alt' }}
        </v-icon>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-base font-bold leading-tight">
          {{ t('task.manager') }}
        </div>
        <div class="text-xs text-medium-emphasis mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <template v-if="tab === 0">
            <span v-if="taskStats.running > 0" class="text-primary font-semibold flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-primary animate-ping inline-block" />
              {{ t('task.nTaskRunning', { count: taskStats.running }) }}
            </span>
            <span v-if="taskStats.running > 0 && totalRemainingText" class="opacity-40">•</span>
            <span v-if="taskStats.running > 0 && totalRemainingText" class="text-white/80 tabular-nums">
              {{ totalRemainingText }}
            </span>
            <span v-if="taskStats.running > 0 && totalEtaText" class="text-amber-400 font-medium tabular-nums">
              • {{ totalEtaText }}
            </span>
            <span v-if="taskStats.running > 0 && totalSpeedText" class="text-primary font-semibold tabular-nums">
              • {{ totalSpeedText }}
            </span>
            <span v-else-if="tasks.length > 0">
              {{ tasks.length }} {{ t('task.name', tasks.length) }}
            </span>
            <span v-else>{{ t('task.empty') }}</span>
          </template>
          <template v-else>
            {{ t('task.connections') }}
          </template>
        </div>
      </div>
      <v-btn icon variant="text" size="small" class="opacity-70 hover:opacity-100" @click="hide">
        <v-icon size="20">close</v-icon>
      </v-btn>
    </div>

    <!-- Tabs -->
    <v-tabs v-model="tab" align-tabs="start" density="compact" class="px-3 flex-grow-0 min-h-10 border-b border-white/5">
      <v-tab :value="0" class="text-none font-semibold">
        <v-icon start size="18">list_alt</v-icon>
        {{ t('task.name', 2) }}
        <v-chip
          v-if="tasks.length > 0"
          size="x-small"
          class="ml-2 font-bold"
          :color="taskStats.running > 0 ? 'primary' : undefined"
          variant="tonal"
        >
          {{ tasks.length }}
        </v-chip>
      </v-tab>
      <v-tab :value="1" class="text-none font-semibold">
        <v-icon start size="18">lan</v-icon>
        {{ t('task.connections') }}
        <v-chip
          v-if="poolCount > 0"
          size="x-small"
          class="ml-2"
          variant="tonal"
        >
          {{ poolCount }}
        </v-chip>
      </v-tab>
    </v-tabs>

    <!-- Body -->
    <v-card-text class="visible-scroll flex-1 overflow-auto pa-0">
      <v-tabs-window v-model="tab">
        <!-- Tasks tab -->
        <v-tabs-window-item :value="0">
          <div
            v-if="tasks.length === 0"
            class="task-dialog__empty flex flex-col items-center justify-center text-center py-16 px-6"
          >
            <div class="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 shadow-inner">
              <v-icon size="32" class="opacity-40">task_alt</v-icon>
            </div>
            <div class="text-sm font-semibold opacity-80">
              {{ t('task.empty') }}
            </div>
          </div>
          <div v-else class="py-2.5 px-3">
            <transition-group name="task-item-anim" tag="div" class="flex flex-col gap-1.5">
              <AppTaskDialogTaskItem
                v-for="item in tasks"
                :key="item.id"
                :item="item"
                @cancel="cancel(item)"
              />
            </transition-group>
          </div>
        </v-tabs-window-item>

        <!-- Connections tab -->
        <v-tabs-window-item :value="1">
          <!-- Network summary -->
          <div v-if="poolCount > 0" class="px-4 pt-4 pb-2">
            <div class="grid grid-cols-3 gap-2">
              <div class="task-dialog__stat">
                <div class="task-dialog__stat-label">
                  {{ t('task.connection.connected') }}
                </div>
                <div class="task-dialog__stat-value">
                  {{ totalStats.connected }}
                </div>
              </div>
              <div class="task-dialog__stat">
                <div class="task-dialog__stat-label">
                  {{ t('task.connection.running') }}
                </div>
                <div class="task-dialog__stat-value text-primary">
                  {{ totalStats.running }}
                </div>
              </div>
              <div class="task-dialog__stat">
                <div class="task-dialog__stat-label">
                  {{ t('task.connection.queued') }}
                </div>
                <div class="task-dialog__stat-value">
                  {{ totalStats.queued }}
                </div>
              </div>
            </div>
          </div>

          <div class="px-4 py-2">
            <v-text-field
              v-model="poolFilter"
              :placeholder="t('shared.filter')"
              prepend-inner-icon="filter_list"
              hide-details
              variant="outlined"
              density="compact"
              clearable
              rounded="lg"
            />
          </div>

          <div
            v-if="filteredPools.length === 0"
            class="task-dialog__empty flex flex-col items-center justify-center text-center py-10 px-6"
          >
            <v-icon size="48" class="task-dialog__empty-icon">cloud_off</v-icon>
            <div class="text-sm text-medium-emphasis mt-3">
              {{ poolFilter ? t('shared.search') : t('task.empty') }}
            </div>
          </div>

          <v-list v-else class="py-0 bg-transparent">
            <v-list-item
              v-for="[host, s] of filteredPools"
              :key="host"
              class="task-dialog__pool"
            >
              <template #prepend>
                <div
                  class="task-dialog__pool-indicator"
                  :class="{ 'task-dialog__pool-indicator--active': s.running > 0 }"
                />
              </template>
              <v-list-item-title class="font-medium text-sm">
                {{ host }}
              </v-list-item-title>
              <v-list-item-subtitle>
                <div class="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-medium-emphasis">
                  <span
                    v-shared-tooltip="t('task.connection.connected')"
                    class="inline-flex items-center gap-1"
                  >
                    <v-icon size="12" class="material-icons-outlined">link</v-icon>
                    {{ s.connected }}
                  </span>
                  <span
                    v-shared-tooltip="t('task.connection.running')"
                    class="inline-flex items-center gap-1"
                    :class="{ 'text-primary font-semibold': s.running > 0 }"
                  >
                    <v-icon size="12" class="material-icons-outlined">downloading</v-icon>
                    {{ s.running }}
                  </span>
                  <span
                    v-shared-tooltip="t('task.connection.queued')"
                    class="inline-flex items-center gap-1"
                  >
                    <v-icon size="12" class="material-icons-outlined">schedule</v-icon>
                    {{ s.queued }}
                  </span>
                  <span
                    v-shared-tooltip="t('task.connection.pending')"
                    class="inline-flex items-center gap-1"
                  >
                    <v-icon size="12" class="material-icons-outlined">hourglass_empty</v-icon>
                    {{ s.pending }}
                  </span>
                  <span
                    v-shared-tooltip="t('task.connection.free')"
                    class="inline-flex items-center gap-1"
                  >
                    <v-icon size="12" class="material-icons-outlined">check_circle</v-icon>
                    {{ s.free }}
                  </span>
                  <span
                    v-shared-tooltip="t('task.connection.size')"
                    class="inline-flex items-center gap-1"
                  >
                    <v-icon size="12" class="material-icons-outlined">data_usage</v-icon>
                    {{ s.size }}
                  </span>
                </div>
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  v-shared-tooltip="t('shared.remove')"
                  icon
                  variant="text"
                  size="small"
                  @click="destroyPool(host)"
                >
                  <v-icon size="18">close</v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card-text>

    <!-- Footer -->
    <v-divider />
    <v-card-actions class="px-5 py-2.5 flex-grow-0">
      <v-spacer />
      <v-btn
        v-if="tab === 0"
        size="small"
        variant="tonal"
        rounded="pill"
        :disabled="finishedCount === 0"
        @click="onClear"
      >
        <v-icon start size="16">delete_sweep</v-icon>
        {{ t('task.clear') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { useTaskOverallProgress } from '@/composables/task'
import { useTaskOperation } from '@/composables/taskIcon'
import { kTaskManager } from '@/composables/taskManager'
import { kNetworkStatus } from '@/composables/useNetworkStatus'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { formatDuration, getExpectedSize } from '@/util/size'
import { BaseServiceKey, TaskState } from '@xmcl/runtime-api'
import AppTaskDialogTaskItem from './AppTaskDialogTaskItem.vue'

const tab = ref(0)

const { tasks, cancel, clear, poll } = injection(kTaskManager)
onMounted(() => {
  poll()
})
const { status } = injection(kNetworkStatus)
const { t, locale } = useI18n()
const { getTaskOperation } = useTaskOperation()
const { runningTasks, progress: overallProgress } = useTaskOverallProgress()

const primaryRunningTask = computed(() => runningTasks.value[0])
const primaryOp = computed(() => getTaskOperation(primaryRunningTask.value))

const downloadSpeed = computed(() => {
  return status.value?.downloadSpeed || overallProgress.value.speed || 0
})

const totalSpeedText = computed(() => {
  if (downloadSpeed.value > 0) {
    return `${getExpectedSize(downloadSpeed.value)}/s`
  }
  return ''
})

const totalRemainingText = computed(() => {
  if (overallProgress.value.remaining > 0) {
    return t('task.totalRemaining', { size: getExpectedSize(overallProgress.value.remaining) })
  }
  return ''
})

const totalEtaText = computed(() => {
  if (downloadSpeed.value > 0 && overallProgress.value.remaining > 0) {
    const seconds = Math.ceil(overallProgress.value.remaining / downloadSpeed.value)
    return t('task.eta', { time: formatDuration(seconds, locale.value) })
  }
  return ''
})

const taskStats = computed(() => {
  const stats = { running: 0, succeed: 0, failed: 0, cancelled: 0 }
  for (const task of tasks.value) {
    if (task.state === TaskState.Running) stats.running++
    else if (task.state === TaskState.Succeed) stats.succeed++
    else if (task.state === TaskState.Failed) stats.failed++
    else if (task.state === TaskState.Cancelled) stats.cancelled++
  }
  return stats
})

const finishedCount = computed(() =>
  taskStats.value.succeed + taskStats.value.failed + taskStats.value.cancelled,
)

const poolFilter = ref('')
const allPools = computed(() => Object.entries(status.value?.pools ?? {}))
const poolCount = computed(() => allPools.value.length)

const filteredPools = computed(() => {
  const pools = allPools.value
  const filtered = poolFilter.value
    ? pools.filter(([name]) => name.toLowerCase().includes(poolFilter.value.toLowerCase()))
    : pools
  return filtered.sort(([a], [b]) => a.localeCompare(b))
})

const totalStats = computed(() => {
  const totals = { connected: 0, free: 0, pending: 0, queued: 0, running: 0 }
  for (const [, s] of allPools.value) {
    totals.connected += s.connected || 0
    totals.free += s.free || 0
    totals.pending += s.pending || 0
    totals.queued += s.queued || 0
    totals.running += s.running || 0
  }
  return totals
})

const { destroyPool } = useService(BaseServiceKey)

const { hide } = useDialog('task')

function onClear() {
  clear()
}
</script>

<style scoped>
.task-dialog {
  border-radius: 16px;
}

.task-dialog__icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background-color: rgba(var(--v-theme-primary), 0.12);
  transition: all 0.3s ease;
}

.task-dialog__icon--pulse {
  background-color: rgba(var(--v-theme-primary), 0.2);
  animation: task-icon-pulse 2s ease-in-out infinite;
}

.task-dialog__icon--rotate {
  background-color: rgba(var(--v-theme-warning), 0.2);
  animation: task-icon-pulse 2s ease-in-out infinite;
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

@keyframes task-icon-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(var(--v-theme-primary), 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 6px rgba(var(--v-theme-primary), 0);
  }
}

.task-item-anim-enter-active,
.task-item-anim-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.task-item-anim-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.task-item-anim-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

.task-dialog__empty-icon {
  opacity: 0.35;
}

.task-dialog__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  background-color: rgba(128, 128, 128, 0.08);
}

.task-dialog__stat-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}

.task-dialog__stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}

.task-dialog__pool {
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.task-dialog__pool:last-child {
  border-bottom: none;
}

.task-dialog__pool-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: rgba(128, 128, 128, 0.4);
  margin-right: 12px;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}

.task-dialog__pool-indicator--active {
  background-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.2);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.2);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(var(--v-theme-primary), 0.05);
  }
}
</style>
