<template>
  <v-system-bar
    topbar
    window
    :color="appBarColor"
    class="flex w-full moveable p-0 flex-grow-0 gap-1"
    :style="{ 'backdrop-filter': `blur(${blurAppBar}px)` }"
  >
    <span
      v-if="back"
      class="p-0 flex flex-shrink flex-grow-0"
    >
      <div
        v-if="shouldShiftBackControl"
        style="width: 80px"
      />
      <v-icon
        v-ripple
        small
        class="flex items-center py-2 hover:bg-[rgba(255,255,255,0.2)] cursor-pointer select-none non-moveable after:hidden"
        style="width: 80px;"
        @click="onBack"
      >
        arrow_back
      </v-icon>
    </span>
    <slot />

    <div class="flex-grow " />
    <TaskSpeedMonitor v-if="!noTask" />
    <div
      v-if="!noTask"
      class="non-moveable hover:bg-[rgba(255,255,255,0.2)] cursor-pointer px-2 py-1 rounded transition-all flex flex-grow-0"
      @click="showTaskDialog()"
    >
      <v-icon>
        assignment
      </v-icon>
      <span v-if="count === 0">
        {{ t('task.empty') }}
      </span>
      <span v-else>
        {{ t('task.nTaskRunning', { count } ) }}
      </span>
    </div>
    <AppSystemBarAvatar
      v-if="!noUser"
    />

    <span class="p-0 flex flex-shrink flex-grow-0 h-full">
      <v-icon
        v-ripple
        tabindex="-1"
        class="flex items-center px-3 py-1 xy-0 cursor-pointer select-none non-moveable hover:bg-[rgba(255,255,255,0.5)] after:hidden mr-0"

        small
        @click="showFeedbackDialog"
      >
        help_outline
      </v-icon>
      <v-icon
        v-if="!hideWindowControl"
        v-ripple
        tabindex="-1"
        class="flex items-center px-3 py-1 xy-0 cursor-pointer select-none non-moveable hover:bg-[rgba(255,255,255,0.5)] after:hidden mr-0"

        small
        @click="minimize"
      >minimize</v-icon>
      <v-icon
        v-if="!hideWindowControl"
        v-ripple
        tabindex="-1"
        class="flex items-center px-3 py-1 top-0 cursor-pointer select-none non-moveable hover:bg-[rgba(255,255,255,0.5)] after:hidden mr-0"
        small
        @click="maximize"
      >crop_din</v-icon>
      <v-icon
        v-if="!hideWindowControl"
        v-ripple
        class="flex items-center px-3 py-1 top-0 cursor-pointer select-none non-moveable hover:bg-[rgb(209,12,12)] after:hidden mr-0"
        small
        @click="close"
      >close</v-icon>
    </span>
  </v-system-bar>
</template>
<script lang="ts" setup>
import { useBarBlur } from '../composables/background'
import { kColorTheme } from '../composables/colorTheme'
import { useDialog } from '../composables/dialog'
import { useTaskCount } from '../composables/task'

import TaskSpeedMonitor from '../components/TaskSpeedMonitor.vue'
import { injection } from '@/util/inject'
import { useWindowStyle } from '@/composables/windowStyle'
import AppSystemBarAvatar from './AppSystemBarUser.vue'

defineProps<{
  noUser?: boolean
  noTask?: boolean
  back?: boolean
}>()

const { appBarColor } = injection(kColorTheme)
const { blurAppBar } = useBarBlur()
const { maximize, minimize, close } = windowController
const { shouldShiftBackControl, hideWindowControl } = useWindowStyle()
const { show: showFeedbackDialog } = useDialog('feedback')
const { show: showTaskDialog } = useDialog('task')
const { t } = useI18n()
const { count } = useTaskCount()

const { back: onBack } = useRouter()

</script>
