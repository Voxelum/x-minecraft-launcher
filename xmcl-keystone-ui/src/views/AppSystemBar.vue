<template>
  <v-system-bar
    topbar
    window
    class="moveable static! flex w-full grow-0 gap-1 p-0 text-[.875rem]! bg-[transparent]! dark:color-[#ffffffb3] pr-0"
    :style="{ 'backdrop-filter': `blur(${blurAppBar}px)` }"
  >
    <span
      v-if="back"
      class="flex shrink grow-0 p-0"
    >
      <div
        v-if="shouldShiftBackControl"
        style="width: 80px"
      />
      <v-icon
        v-ripple
        size="small"
        class="non-moveable flex cursor-pointer select-none items-center py-2 after:hidden hover:bg-[rgba(255,255,255,0.2)]"
        style="width: 80px;"
        @click="onBack"
      >
        arrow_back
      </v-icon>
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

    <span class="flex h-full shrink grow-0 p-0">
      <v-icon
        v-if="!hideWindowControl"
        v-ripple
        tabindex="-1"
        class="non-moveable system-btn hover:bg-[rgba(255,255,255,0.5)]"
        size="small"
        @click="minimize"
      >minimize</v-icon>
      <v-icon
        v-if="!hideWindowControl"
        v-ripple
        tabindex="-1"
        class="non-moveable system-btn hover:bg-[rgba(255,255,255,0.5)]"
        size="small"
        @click="maximize"
      >crop_din</v-icon>
      <v-icon
        v-if="!hideWindowControl"
        v-ripple
        class="non-moveable system-btn hover:bg-[rgb(209,12,12)]"
        size="small"
        @click="close"
      >close</v-icon>
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
</script>
<style lang="css" scoped>
.system-btn {
  @apply  h-full top-0 mr-0 flex cursor-pointer select-none items-center px-3 py-1 after:hidden! w-[40px] min-w-[40px];
  font-size: 16px !important;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
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
