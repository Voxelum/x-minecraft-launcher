<template>
  <v-system-bar
    v-roving-tabindex
    topbar
    window
    role="toolbar"
    :aria-label="systemBarAriaLabel"
    class="moveable static! flex w-full grow-0 gap-1 p-0 text-[.875rem]! bg-[transparent]! dark:color-[#ffffffb3] pr-0 max-h-[30px]"
    :style="{ 'backdrop-filter': `blur(${blurAppBar}px)` }"
  >
    <span
      v-if="back"
      class="flex shrink grow-0 p-0 h-full items-center"
    >
      <div
        v-if="shouldShiftBackControl"
        class="w-[80px]"
      />
      <button
        type="button"
        v-ripple
        class="system-bar-back-btn non-moveable flex cursor-pointer select-none items-center h-full w-[80px]"
        :aria-label="backAriaLabel"
        @click="onBack"
      >
        <v-icon size="small" aria-hidden="true">
          arrow_back
        </v-icon>
      </button>
    </span>
    <slot />

    <AppAudioPlayer
      v-if="!noDebug"
      class="ml-22"
    />

    <div class="flex-grow"/>

    <AppSystemBarBadge
      v-if="gamepadConnected"
      v-shared-tooltip.bottom="() => gamepadLabel"
      icon="sports_esports"
      :text="gamepadLabel"
      :aria-label="gamepadLabel"
      can-hide-text
      class="gamepad-badge"
      @click="openPalette"
    />

    <AppSystemBarBadge
      v-if="!noUser"
      v-shared-tooltip.bottom="() => t('commandPalette.openHint', { shortcut: paletteShortcut })"
      icon="search"
      :text="t('commandPalette.open')"
      :aria-label="t('commandPalette.openHint', { shortcut: paletteShortcut })"
      can-hide-text
      @click="openPalette"
    >
      <template #append>
        <kbd class="palette-hotkey">{{ paletteShortcut }}</kbd>
      </template>
    </AppSystemBarBadge>


    <!-- Task Manager Button with Live Progress and Icon -->
    <button
      v-if="!noTask"
      type="button"
      v-shared-tooltip.bottom="() => taskTooltip"
      class="system-bar-badge task-manager-btn non-moveable relative flex flex-grow-0 cursor-pointer items-center rounded-lg px-2 py-1 transition-all"
      :class="{ 'task-manager-btn--active': count > 0 || isJustFinished }"
      :aria-label="taskTooltip"
      @click="showTaskDialog()"
    >
      <!-- Active Running Task or Just Finished State -->
      <template v-if="count > 0 || isJustFinished">
        <!-- Icon of downloading/finished item with animated operation badge -->
        <div class="relative flex items-center justify-center mr-1.5 shrink-0">
          <img
            v-if="displayTaskIcon.type === 'image' && displayTaskIcon.src"
            :src="displayTaskIcon.src"
            class="w-4 h-4 rounded object-cover shadow-sm"
          />
          <v-icon
            v-else
            size="18"
            :class="[
              isJustFinished ? 'text-success' : `text-${displayOpInfo.color}`,
              isJustFinished ? '' : displayOpInfo.iconAnimClass,
            ]"
          >
            {{ displayTaskIcon.icon || (isJustFinished ? 'check_circle' : displayOpInfo.icon) }}
          </v-icon>

          <!-- Tiny operation badge in corner of button icon -->
          <div
            class="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full flex items-center justify-center shadow"
            :class="isJustFinished ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : displayOpInfo.badgeBg"
          >
            <v-icon size="7" :class="isJustFinished ? '' : displayOpInfo.iconAnimClass">
              {{ isJustFinished ? 'check' : displayOpInfo.icon }}
            </v-icon>
          </div>
        </div>

        <!-- Percentage / Status text -->
        <div class="flex items-center gap-1.5 text-xs font-semibold tabular-nums">
          <template v-if="isJustFinished">
            <span class="font-bold text-success">
              100%
            </span>
            <span class="text-[11px] text-success/80 badge-text">
              {{ t('task.succeed') }}
            </span>
          </template>
          <template v-else>
            <span class="font-bold" :class="`text-${displayOpInfo.color}`">
              {{ totalProgress.indeterminate ? (taskSpeedText || t('task.running')) : `${Math.round(totalProgress.percent)}%` }}
            </span>
            <span v-if="!totalProgress.indeterminate && (taskSpeedText || primaryEtaText)" class="text-[11px] opacity-70 badge-text">
              {{ taskSpeedText || primaryEtaText }}
            </span>
          </template>
        </div>

        <!-- Mini Progress Bar Line at bottom of button -->
        <div class="task-manager-progress-track absolute bottom-0 left-1 right-1 h-[2.5px] rounded-full bg-white/10 overflow-hidden">
          <div
            class="h-full transition-all duration-300 rounded-full"
            :class="[
              isJustFinished ? 'bg-success' : `bg-${displayOpInfo.color}`,
              { 'w-full animate-pulse': !isJustFinished && totalProgress.indeterminate },
            ]"
            :style="{ width: isJustFinished ? '100%' : (totalProgress.indeterminate ? '100%' : `${totalProgress.percent}%`) }"
          />
        </div>
      </template>

      <!-- Idle state: No running tasks (Clipboard icon) -->
      <template v-else>
        <v-icon size="20" class="badge-icon opacity-80" aria-hidden="true">
          assignment
        </v-icon>
      </template>
    </button>
    <AppSystemBarBadge
      v-if="tutor"
      id="tutor-button"
      v-shared-tooltip.bottom="() => t('tutorial.tooltip')"
      icon="quiz"
      :text="t('help')"
      can-hide-text
      @click="tutor.start()"
    />
    <AppSystemBarBadge
      v-if="!noDebug"
      id="feedback-button"
      icon="bug_report"
      :text="t('feedback.name')"
      can-hide-text
      @click="showFeedbackDialog"
    />

    <span
      v-roving-tabindex
      class="flex h-full shrink grow-0 p-0"
      role="group"
      :aria-label="windowControlsAriaLabel"
    >
      <button
        v-if="!hideWindowControl"
        type="button"
        v-ripple
        :aria-label="minimizeAriaLabel"
        class="non-moveable system-btn"
        @click="minimize"
      >
        <v-icon size="small" aria-hidden="true">minimize</v-icon>
      </button>
      <button
        v-if="!hideWindowControl"
        type="button"
        v-ripple
        :aria-label="maximizeAriaLabel"
        class="non-moveable system-btn"
        @click="maximize"
      >
        <v-icon size="small" aria-hidden="true">crop_din</v-icon>
      </button>
      <button
        v-if="!hideWindowControl"
        type="button"
        v-ripple
        :aria-label="closeAriaLabel"
        class="non-moveable system-btn system-btn--close"
        @click="close"
      >
        <v-icon size="small" aria-hidden="true">close</v-icon>
      </button>
    </span>
  </v-system-bar>
</template>
<script lang="ts" setup>
import { useDialog } from '../composables/dialog'
import { useTaskOverallProgress, useLocalizedTaskFunc } from '../composables/task'
import { useTaskIcon, useTaskOperation } from '@/composables/taskIcon'
import { useGamepad } from '@/composables/gamepad'
import { Tasks } from '@xmcl/runtime-api'

import { injection } from '@/util/inject'
import { useWindowStyle } from '@/composables/windowStyle'
import { kTutorial } from '@/composables/tutorial'
import AppSystemBarBadge from '@/components/AppSystemBarBadge.vue'
import AppAudioPlayer from '@/components/AppAudioPlayer.vue'
import { kTheme } from '@/composables/theme'
import { useCommandPaletteVisible } from '@/composables/commandPalette'
import { kNetworkStatus } from '@/composables/useNetworkStatus'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { formatDuration, getExpectedSize } from '@/util/size'

import { kSettingsState } from '@/composables/setting'
import { formatShortcutDisplay } from '@/util/shortcut'

const props = defineProps<{
  noUser?: boolean
  noTask?: boolean
  noDebug?: boolean
  back?: boolean
}>()

const { blurAppBar } = injection(kTheme)
const { state: settingsState } = injection(kSettingsState)
const { maximize, minimize, close, hide } = windowController
const { shouldShiftBackControl, hideWindowControl } = useWindowStyle()
const { show: showFeedbackDialog } = useDialog('feedback')
const { show: showTaskDialog } = useDialog('task')
const { t, locale } = useI18n()
const { count, runningTasks, progress: totalProgress } = useTaskOverallProgress()
const { getTaskIcon } = useTaskIcon()
const { getTaskOperation } = useTaskOperation()
const localizeTask = useLocalizedTaskFunc()

const justFinishedTask = shallowRef<Tasks | null>(null)
let finishedTimer: any = null

watch(runningTasks, (newTasks, oldTasks) => {
  if (oldTasks && oldTasks.length > 0 && newTasks.length === 0) {
    const finished = oldTasks[0]
    justFinishedTask.value = finished
    clearTimeout(finishedTimer)
    finishedTimer = setTimeout(() => {
      justFinishedTask.value = null
    }, 3000)
  }
})

const primaryRunningTask = computed(() => runningTasks.value[0])
const displayTask = computed(() => primaryRunningTask.value || justFinishedTask.value)
const isJustFinished = computed(() => !primaryRunningTask.value && !!justFinishedTask.value)
const displayTaskIcon = computed(() => getTaskIcon(displayTask.value || undefined))
const displayOpInfo = computed(() => getTaskOperation(displayTask.value || undefined))
const displayTaskLocalized = computed(() => displayTask.value ? localizeTask(displayTask.value) : null)

// Optional: the standalone multiplayer/app windows don't provide network status.
const networkStatus = inject(kNetworkStatus, undefined)?.status ?? ref(null)
const tutor = inject(kTutorial, undefined)

const taskSpeedText = computed(() => {
  const speed = networkStatus.value?.downloadSpeed || totalProgress.value.speed || 0
  return speed > 0 ? `${getExpectedSize(speed)}/s` : ''
})

const primaryRemainingText = computed(() => {
  if (totalProgress.value.remaining > 0) {
    return t('task.totalRemaining', { size: getExpectedSize(totalProgress.value.remaining) })
  }
  return ''
})

const primaryEtaText = computed(() => {
  const speed = networkStatus.value?.downloadSpeed || totalProgress.value.speed || 0
  if (speed > 0 && totalProgress.value.remaining > 0) {
    const seconds = Math.ceil(totalProgress.value.remaining / speed)
    return t('task.eta', { time: formatDuration(seconds, locale.value) })
  }
  return ''
})

const taskCountText = computed(() => count.value === 0
  ? t('task.empty')
  : t('task.nTaskRunning', { count: count.value }))

const taskInlineText = computed(() => {
  if (count.value === 0) return ''
  return taskSpeedText.value || taskCountText.value
})

const taskTooltip = computed(() => {
  if (count.value === 0 && !isJustFinished.value) return t('task.empty')
  const opPrefix = displayOpInfo.value.label ? `[${displayOpInfo.value.label}] ` : ''
  const taskName = displayTaskLocalized.value?.title ? `${opPrefix}${displayTaskLocalized.value.title}` : ''
  if (isJustFinished.value) {
    return `${taskName} · 100% (${t('task.succeed')})`
  }
  const percentStr = totalProgress.value.indeterminate ? '' : `${Math.round(totalProgress.value.percent)}%`
  const parts = [taskName, percentStr, primaryRemainingText.value, primaryEtaText.value, taskSpeedText.value].filter(Boolean).join(' · ')
  if (count.value > 1) {
    return `${parts} (${t('task.nTaskRunning', { count: count.value })})`
  }
  return parts || taskCountText.value
})

const paletteShown = useCommandPaletteVisible()
const { isActive: gamepadActive, connected: gamepadConnected, name: gamepadName, labels: gamepadLabels } = useGamepad()
const paletteShortcut = computed(() => {
  if (gamepadActive.value) {
    // Start / Menu button opens the palette in gamepad mode.
    return gamepadLabels.value.menu
  }
  const custom = settingsState.value?.quickActionShortcut
  return formatShortcutDisplay(custom || '')
})
const gamepadLabel = computed(() => gamepadName.value || t('gamepad.connected'))
const openPalette = () => { paletteShown.value = true }

const router = useRouter()
const onBack = () => {
  router.back()
}

const systemBarAriaLabel = 'Window'
const backAriaLabel = computed(() => t('shared.back'))
const minimizeAriaLabel = 'Minimize'
const maximizeAriaLabel = 'Maximize'
const closeAriaLabel = 'Close'
const windowControlsAriaLabel = 'Window controls'
</script>
<style lang="css" scoped>
/* Keep a long controller name from pushing/overflowing the bar. */
.gamepad-badge {
  max-width: 180px;
  overflow: hidden;
}
.gamepad-badge :deep(.whitespace-nowrap) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.system-btn {
  @apply  h-full top-0 mr-0 flex cursor-pointer select-none items-center justify-center px-3 py-1 after:hidden! w-[40px] min-w-[40px];
  font-size: 16px !important;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
  background: transparent;
  border: 0;
  color: inherit;
  appearance: none;
}

.system-btn:hover {
  background: rgba(255, 255, 255, 0.5);
}

.system-btn--close:hover {
  background: rgb(209, 12, 12);
}

.system-bar-back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.system-btn:focus-visible,
.system-bar-back-btn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: -2px;
}

.system-bar-back-btn {
  background: transparent;
  border: 0;
  color: inherit;
  appearance: none;
  justify-content: center;
}

.palette-hotkey {
  margin-left: 8px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(125, 125, 125, 0.18);
  border: 1px solid rgba(125, 125, 125, 0.28);
  color: inherit;
  opacity: 0.75;
}

@media (max-width: 880px) {
  .palette-hotkey {
    margin-left: 4px;
  }
}

.task-manager-btn {
  background: transparent;
  border: 1px solid transparent;
  color: inherit;
  font: inherit;
  appearance: none;
  min-height: 28px;
}

.task-manager-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.task-manager-btn--active {
  background: rgba(var(--v-theme-primary), 0.12);
  border-color: rgba(var(--v-theme-primary), 0.3);
  box-shadow: 0 0 12px rgba(var(--v-theme-primary), 0.15);
}

.task-manager-btn--active:hover {
  background: rgba(var(--v-theme-primary), 0.22);
  border-color: rgba(var(--v-theme-primary), 0.45);
}

.task-manager-progress-track {
  pointer-events: none;
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

.task-anim-rotate {
  animation: taskRotate 2.2s linear infinite;
}

.task-anim-download {
  animation: taskBounceSubtle 1.2s ease-in-out infinite;
}

.task-anim-pulse {
  animation: taskPulseSubtle 1.6s ease-in-out infinite;
}
</style>
