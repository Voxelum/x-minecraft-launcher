<template>
  <v-system-bar
    v-roving-tabindex
    topbar
    window
    role="toolbar"
    :aria-label="systemBarAriaLabel"
    class="moveable static! flex w-full grow-0 gap-1 p-0 text-[.875rem]! bg-[transparent]! dark:color-[#ffffffb3] pr-0"
    :style="{ 'backdrop-filter': `blur(${blurAppBar}px)` }"
  >
    <span
      v-if="back"
      class="flex shrink grow-0 p-0 h-full items-center"
    >
      <div
        v-if="shouldShiftBackControl"
        style="width: 80px"
      />
      <button
        type="button"
        v-ripple
        class="system-bar-back-btn non-moveable flex cursor-pointer select-none items-center h-full"
        style="width: 80px;"
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


    <AppSystemBarBadge
      v-if="!noTask"
      v-shared-tooltip.bottom="() => taskTooltip"
      icon="assignment"
      :can-hide-text="!taskInlineText"
      :text="taskInlineText"
      @click="showTaskDialog()"
    />
    <AppSystemBarBadge
      v-if="tutor"
      id="tutor-button"
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
import { useTaskCount } from '../composables/task'

import { injection } from '@/util/inject'
import { useWindowStyle } from '@/composables/windowStyle'
import { kTutorial } from '@/composables/tutorial'
import AppSystemBarBadge from '@/components/AppSystemBarBadge.vue'
import AppAudioPlayer from '@/components/AppAudioPlayer.vue'
import { kTheme } from '@/composables/theme'
import { useCommandPaletteBus } from '@/composables/commandPalette'
import { kNetworkStatus } from '@/composables/useNetworkStatus'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { getExpectedSize } from '@/util/size'

const props = defineProps<{
  noUser?: boolean
  noTask?: boolean
  noDebug?: boolean
  back?: boolean
}>()

const { appBarColor, blurAppBar } = injection(kTheme)
const { maximize, minimize, close, hide } = windowController
const { shouldShiftBackControl, hideWindowControl } = useWindowStyle()
const { show: showFeedbackDialog } = useDialog('feedback')
const { show: showTaskDialog } = useDialog('task')
const { t } = useI18n()
const { count } = useTaskCount()
// Optional: the standalone multiplayer/app windows don't provide network status.
const networkStatus = inject(kNetworkStatus, undefined)?.status ?? ref(null)
const tutor = inject(kTutorial, undefined)

const taskSpeedText = computed(() => networkStatus.value?.downloadSpeed
  ? `${getExpectedSize(networkStatus.value.downloadSpeed)}/s`
  : '')
const taskCountText = computed(() => count.value === 0
  ? t('task.empty')
  : t('task.nTaskRunning', { count: count.value }))
const taskInlineText = computed(() => {
  if (count.value === 0) return ''
  return taskSpeedText.value || taskCountText.value
})
const taskTooltip = computed(() => {
  if (count.value === 0) return t('task.empty')
  if (taskSpeedText.value) return `${taskCountText.value} · ${taskSpeedText.value}`
  return taskCountText.value
})

const paletteBus = useCommandPaletteBus()
const paletteShortcut = computed(() => navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl+K')
const openPalette = () => paletteBus.emit('show')

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
</style>
