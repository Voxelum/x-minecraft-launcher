<template>
  <v-dialog
    :model-value="modelValue"
    max-width="740"
    content-class="elevation-0"
    transition="dialog-transition"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="bp-subpage-card !m-0 !p-6 max-h-[85vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300"
            :class="taskStats.running > 0
              ? 'bg-primary/20 ring-2 ring-primary/40 shadow-[0_0_20px_rgba(var(--v-theme-primary),0.35)]'
              : 'bg-emerald-500/20 ring-1 ring-emerald-500/30'"
          >
            <v-icon
              v-if="taskStats.running > 0"
              size="28"
              color="primary"
              class="animate-pulse"
            >
              downloading
            </v-icon>
            <v-icon
              v-else
              size="28"
              color="success"
            >
              task_alt
            </v-icon>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-black text-white tracking-wide">
                {{ t('task.manager') }}
              </h2>
              <span
                v-if="taskStats.running > 0"
                class="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-white shadow-[0_0_10px_rgba(var(--v-theme-primary),0.5)]"
              >
                {{ taskStats.running }}
              </span>
            </div>
            <div class="text-xs text-white/60 mt-0.5 flex items-center gap-2">
              <span v-if="taskStats.running > 0" class="text-primary font-semibold">
                {{ t('task.nTaskRunning', { count: taskStats.running }) }}
                <template v-if="downloadSpeedStr">· {{ downloadSpeedStr }}</template>
              </span>
              <span v-else-if="tasks.length > 0">
                {{ tasks.length }} {{ t('task.name', tasks.length) }}
              </span>
              <span v-else>{{ t('task.empty') }}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center transition-colors text-white/70"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        >
          <span v-if="gamepadConnected" class="bp-glyph bp-glyph--b !mr-0">{{ buttonBLabel }}</span>
          <v-icon v-else size="20">close</v-icon>
        </button>
      </div>

      <!-- Tabs Switcher -->
      <div class="flex items-center gap-2 pt-4 pb-2">
        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer select-none"
          :class="activeTab === 'tasks'
            ? 'bg-primary text-white shadow-[0_0_15px_rgba(var(--v-theme-primary),0.35)]'
            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'"
          data-gamepad-focusable
          @click="activeTab = 'tasks'"
        >
          <v-icon size="16">list_alt</v-icon>
          <span>{{ t('task.name', 2) }}</span>
          <span
            v-if="tasks.length > 0"
            class="px-1.5 py-0.2 rounded-md text-[10px] font-black"
            :class="activeTab === 'tasks' ? 'bg-black/30 text-white' : 'bg-white/10 text-white/70'"
          >
            {{ tasks.length }}
          </span>
        </button>

        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer select-none"
          :class="activeTab === 'network'
            ? 'bg-primary text-white shadow-[0_0_15px_rgba(var(--v-theme-primary),0.35)]'
            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'"
          data-gamepad-focusable
          @click="activeTab = 'network'"
        >
          <v-icon size="16">lan</v-icon>
          <span>{{ t('task.connections') }}</span>
          <span
            v-if="poolCount > 0"
            class="px-1.5 py-0.2 rounded-md text-[10px] font-black"
            :class="activeTab === 'network' ? 'bg-black/30 text-white' : 'bg-white/10 text-white/70'"
          >
            {{ poolCount }}
          </span>
        </button>
      </div>

      <!-- Body Content -->
      <div class="flex-1 overflow-y-auto py-2 custom-scrollbar min-h-[300px]">
        <!-- Tasks List Tab -->
        <div v-if="activeTab === 'tasks'" class="flex flex-col gap-2.5">
          <!-- Empty State Hero Card -->
          <div
            v-if="tasks.length === 0"
            class="flex flex-col items-center justify-center text-center py-14 px-6 rounded-2xl bg-white/[0.02] border border-white/5 my-auto"
          >
            <div class="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <v-icon size="36" color="success">cloud_done</v-icon>
            </div>
            <div class="text-base font-bold text-white mb-1">
              {{ t('task.empty') }}
            </div>
            <div class="text-xs text-white/50 max-w-sm">
              {{ t('bigPicture.noRunningTasksHint') || 'All downloads, installations, and background operations have completed.' }}
            </div>
          </div>

          <!-- Task Items -->
          <div
            v-for="task in tasks"
            :key="task.id"
            class="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all flex flex-col gap-2.5"
            tabindex="0"
            data-gamepad-focusable
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3 min-w-0 flex-1">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" :class="getTaskBadgeClass(task.state)">
                  <v-progress-circular
                    v-if="task.state === TaskState.Running && isIndeterminate(task)"
                    size="18"
                    width="2.5"
                    indeterminate
                    color="primary"
                  />
                  <v-icon
                    v-else
                    size="20"
                    :color="getTaskIconColor(task.state)"
                  >
                    {{ getTaskIcon(task.state) }}
                  </v-icon>
                </div>

                <div class="min-w-0 flex-1">
                  <div class="text-sm font-bold text-white truncate">
                    {{ localizeTask(task).title }}
                  </div>
                  <div
                    v-if="localizeTask(task).subtitle || (task.progress && 'url' in task.progress)"
                    class="text-xs text-white/50 truncate mt-0.5"
                  >
                    {{ localizeTask(task).subtitle || (task.progress && 'url' in task.progress ? task.progress.url : '') }}
                  </div>
                  <div
                    v-if="task.error && typeof task.error === 'object' && 'message' in task.error"
                    class="text-xs text-rose-400 font-semibold truncate mt-0.5"
                  >
                    {{ String(task.error.message) }}
                  </div>
                </div>
              </div>

              <!-- Right: percentage or cancel button -->
              <div class="flex items-center gap-2 shrink-0">
                <span
                  v-if="task.state === TaskState.Running && !isIndeterminate(task)"
                  class="text-xs font-bold text-primary tabular-nums"
                >
                  {{ getTaskPercentage(task).toFixed(0) }}%
                </span>

                <button
                  v-if="task.state === TaskState.Running"
                  type="button"
                  class="w-7 h-7 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/60 hover:text-rose-400 flex items-center justify-center transition-colors"
                  :title="t('shared.cancel')"
                  data-gamepad-focusable
                  @click.stop="cancel(task)"
                >
                  <v-icon size="16">close</v-icon>
                </button>
                <v-chip
                  v-else
                  size="x-small"
                  :color="getTaskChipColor(task.state)"
                  variant="tonal"
                  class="font-semibold"
                >
                  {{ getTaskStateText(task.state) }}
                </v-chip>
              </div>
            </div>

            <!-- Progress bar for running tasks -->
            <div
              v-if="task.state === TaskState.Running"
              class="w-full h-1.5 rounded-full bg-white/10 overflow-hidden"
            >
              <div
                v-if="!isIndeterminate(task)"
                class="h-full bg-primary rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(var(--v-theme-primary),0.6)]"
                :style="{ width: `${getTaskPercentage(task)}%` }"
              />
              <div
                v-else
                class="h-full bg-primary rounded-full animate-pulse w-1/2"
              />
            </div>
          </div>
        </div>

        <!-- Network Connections Tab -->
        <div v-else-if="activeTab === 'network'" class="flex flex-col gap-4">
          <!-- Summary Cards -->
          <div class="grid grid-cols-3 gap-3">
            <div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1">
              <span class="text-xs text-white/50 font-bold uppercase tracking-wider">{{ t('task.connection.connected') }}</span>
              <span class="text-xl font-black text-white">{{ totalStats.connected }}</span>
            </div>
            <div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1">
              <span class="text-xs text-white/50 font-bold uppercase tracking-wider">{{ t('task.connection.queued') }}</span>
              <span class="text-xl font-black text-white">{{ totalStats.queued }}</span>
            </div>
            <div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1">
              <span class="text-xs text-white/50 font-bold uppercase tracking-wider">Швидкість</span>
              <span class="text-xl font-black text-primary">{{ downloadSpeedStr || '0 KB/s' }}</span>
            </div>
          </div>

          <!-- Host Pools List -->
          <div class="flex flex-col gap-2">
            <div class="text-xs font-bold text-white/50 uppercase tracking-wider px-1">
              Хости з'єднань ({{ allPools.length }})
            </div>
            <div
              v-for="[host, pool] in allPools"
              :key="host"
              class="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
            >
              <div class="flex items-center gap-2 text-white font-medium truncate max-w-sm">
                <v-icon size="16" color="primary">public</v-icon>
                <span class="truncate">{{ host }}</span>
              </div>
              <div class="flex items-center gap-3 text-white/60 font-semibold shrink-0">
                <span>{{ pool.connected }} підключено</span>
                <span>·</span>
                <span>{{ pool.free }} вільно</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="pt-4 border-t border-white/10 flex items-center justify-between mt-auto">
        <div>
          <button
            v-if="finishedCount > 0 && activeTab === 'tasks'"
            type="button"
            class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/70 hover:text-white transition-all flex items-center gap-2 cursor-pointer select-none"
            data-gamepad-focusable
            @click="clear"
          >
            <span v-if="gamepadConnected" class="bp-glyph bp-glyph--x !mr-0">{{ buttonXLabel }}</span>
            <v-icon v-else size="16">clear_all</v-icon>
            <span>{{ t('task.clear') }}</span>
          </button>
        </div>

        <button
          type="button"
          class="bp-play-btn !px-6 !py-2.5 !text-sm font-bold"
          data-gamepad-focusable
          @click="$emit('update:modelValue', false)"
        >
          <span v-if="gamepadConnected" class="bp-glyph bp-glyph--b !mr-0">{{ buttonBLabel }}</span>
          <span>{{ t('shared.close') }}</span>
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { injection } from '@/util/inject'
import { kTaskManager } from '@/composables/taskManager'
import { kNetworkStatus } from '@/composables/useNetworkStatus'
import { useLocalizedTaskFunc } from '@/composables/task'
import { useGamepad } from '@/composables/gamepad'
import { TaskState, type Tasks } from '@xmcl/runtime-api'
import { getExpectedSize } from '@/util/size'

const props = withDefaults(defineProps<{
  modelValue?: boolean
}>(), {
  modelValue: false,
})

defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const { t } = useI18n()
const { tasks, cancel, clear } = injection(kTaskManager)
const { status: networkStatus } = injection(kNetworkStatus)
const localizeTask = useLocalizedTaskFunc()

const gamepad = useGamepad()
const gamepadConnected = gamepad.connected
const buttonBLabel = gamepad.buttonB
const buttonXLabel = gamepad.buttonX

const activeTab = ref<'tasks' | 'network'>('tasks')

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

const downloadSpeedStr = computed(() => {
  const speed = networkStatus.value?.downloadSpeed
  if (!speed || speed <= 0) return ''
  return `${getExpectedSize(speed)}/s`
})

const allPools = computed(() => Object.entries(networkStatus.value?.pools ?? {}))
const poolCount = computed(() => allPools.value.length)

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

function isIndeterminate(task: Tasks) {
  const total = task.progress?.total ?? -1
  return !total || total <= 0
}

function getTaskPercentage(task: Tasks) {
  const total = task.progress?.total ?? -1
  const current = task.progress?.progress ?? 0
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (current / total) * 100))
}

function getTaskIcon(state: TaskState) {
  switch (state) {
    case TaskState.Succeed: return 'check_circle'
    case TaskState.Failed: return 'error_outline'
    case TaskState.Cancelled: return 'stop_circle'
    case TaskState.Running: return 'sync'
    default: return 'hourglass_empty'
  }
}

function getTaskIconColor(state: TaskState) {
  switch (state) {
    case TaskState.Succeed: return 'success'
    case TaskState.Failed: return 'error'
    case TaskState.Cancelled: return 'white/40'
    case TaskState.Running: return 'primary'
    default: return 'white/40'
  }
}

function getTaskBadgeClass(state: TaskState) {
  switch (state) {
    case TaskState.Succeed: return 'bg-emerald-500/10'
    case TaskState.Failed: return 'bg-rose-500/10'
    case TaskState.Cancelled: return 'bg-white/5'
    case TaskState.Running: return 'bg-primary/10'
    default: return 'bg-white/5'
  }
}

function getTaskChipColor(state: TaskState) {
  switch (state) {
    case TaskState.Succeed: return 'success'
    case TaskState.Failed: return 'error'
    case TaskState.Cancelled: return undefined
    default: return undefined
  }
}

function getTaskStateText(state: TaskState) {
  switch (state) {
    case TaskState.Succeed: return t('task.succeed')
    case TaskState.Failed: return t('task.failed')
    case TaskState.Cancelled: return t('task.cancelled')
    default: return ''
  }
}
</script>
