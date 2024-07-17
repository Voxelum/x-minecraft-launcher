<template>
  <v-system-bar
    topbar
    window
    :color="appBarColor"
    class="moveable flex w-full grow-0 gap-1 p-0"
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
        small
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
    <div class="grow " />

    <TaskSpeedMonitor v-if="!noTask" />
    <AppSystemBarBadge
      v-if="!noTask"
      icon="assignment"
      :text="count === 0 ? t('task.empty') : t('task.nTaskRunning', { count })"
      @click="showTaskDialog()"
    />
    <AppSystemBarAvatar
      v-if="!noUser"
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
        class="xy-0 non-moveable mr-0 flex cursor-pointer select-none items-center px-3 py-1 after:hidden! hover:bg-[rgba(255,255,255,0.5)]"

        small
        @click="minimize"
      >minimize</v-icon>
      <v-icon
        v-if="!hideWindowControl"
        v-ripple
        tabindex="-1"
        class="non-moveable top-0 mr-0 flex cursor-pointer select-none items-center px-3 py-1 after:hidden! hover:bg-[rgba(255,255,255,0.5)]"
        small
        @click="maximize"
      >crop_din</v-icon>
      <v-icon
        v-if="!hideWindowControl"
        v-ripple
        class="non-moveable top-0 mr-0 flex cursor-pointer select-none items-center px-3 py-1 after:hidden! hover:bg-[rgb(209,12,12)]"
        small
        @click="close"
      >close</v-icon>
    </span>
  </v-system-bar>
</template>
<script lang="ts" setup>
import { useDialog } from '../composables/dialog'
import { useTaskCount } from '../composables/task'

import TaskSpeedMonitor from '../components/TaskSpeedMonitor.vue'
import { injection } from '@/util/inject'
import { useWindowStyle } from '@/composables/windowStyle'
import AppSystemBarAvatar from './AppSystemBarUserMenu.vue'
import { kTutorial } from '@/composables/tutorial'
import AppSystemBarBadge from '@/components/AppSystemBarBadge.vue'
import AppAudioPlayer from '@/components/AppAudioPlayer.vue'
import { kTheme } from '@/composables/theme'

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
const tutor = inject(kTutorial, undefined)

let onBack = () => {}
if (props.back) {
  const router = useRouter()
  onBack = () => {
    router.back()
  }
}
</script>
