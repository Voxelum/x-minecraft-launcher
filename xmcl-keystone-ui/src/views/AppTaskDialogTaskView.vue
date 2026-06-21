<template>
  <v-card flat class="task-dialog flex flex-col overflow-hidden" style="min-height: 280px; max-width: 100%">
    <!-- Header -->
    <div class="task-dialog__header flex items-center gap-3 px-5 py-4 flex-grow-0">
      <div class="task-dialog__icon flex items-center justify-center rounded-xl">
        <v-icon size="22" color="primary">task_alt</v-icon>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-base font-bold leading-tight">
          {{ t('task.manager') }}
        </div>
        <div class="text-xs text-medium-emphasis mt-0.5">
          <template v-if="tab === 0">
            <span v-if="taskStats.running > 0" class="text-primary font-semibold">
              {{ t('task.nTaskRunning', { count: taskStats.running }) }}
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
      <v-btn icon variant="text" size="small" @click="hide">
        <v-icon>close</v-icon>
      </v-btn>
    </div>

    <!-- Tabs -->
    <v-tabs v-model="tab" align-tabs="start" density="compact" class="px-3 flex-grow-0 min-h-10">
      <v-tab :value="0" class="text-none font-semibold">
        <v-icon start size="18">list_alt</v-icon>
        {{ t('task.name', 2) }}
        <v-chip
          v-if="tasks.length > 0"
          size="x-small"
          class="ml-2"
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
    <v-divider />

    <!-- Body -->
    <v-card-text class="visible-scroll flex-1 overflow-auto pa-0">
      <v-tabs-window v-model="tab">
        <!-- Tasks tab -->
        <v-tabs-window-item :value="0">
          <div
            v-if="tasks.length === 0"
            class="task-dialog__empty flex flex-col items-center justify-center text-center py-12 px-6"
          >
            <v-icon size="56" class="task-dialog__empty-icon">inbox</v-icon>
            <div class="text-sm text-medium-emphasis mt-3">
              {{ t('task.empty') }}
            </div>
          </div>
          <v-list v-else color="transparent" class="py-0">
            <AppTaskDialogTaskItem
              v-for="item in tasks"
              :key="item.id"
              :item="item"
              @cancel="cancel(item)"
            />
          </v-list>
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
    <v-card-actions class="px-4 py-2 flex-grow-0">
      <v-spacer />
      <v-btn
        v-if="tab === 0"
        size="small"
        variant="text"
        :disabled="finishedCount === 0"
        @click="onClear"
      >
        <v-icon start>delete_forever</v-icon>
        {{ t('task.clear') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kTaskManager } from '@/composables/taskManager'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { BaseServiceKey, TaskState } from '@xmcl/runtime-api'
import AppTaskDialogTaskItem from './AppTaskDialogTaskItem.vue'
import { kNetworkStatus } from '@/composables/useNetworkStatus'

const tab = ref(0)

const { tasks, cancel, clear } = injection(kTaskManager)
const { status } = injection(kNetworkStatus)
const { t } = useI18n()

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
  border-radius: 12px;
}

.task-dialog__icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background-color: rgba(var(--v-theme-primary), 0.12);
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
