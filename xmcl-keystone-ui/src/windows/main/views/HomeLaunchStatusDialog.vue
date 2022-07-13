<template>
  <v-dialog
    v-model="isShown"
    :width="380"
    :persistent="status === 'launching'"
  >
    <v-card>
      <v-container>
        <v-layout
          align-center
          justify-center
          column
        >
          <div class="relative mt-8">
            <v-progress-circular
              color="primary"
              :size="70"
              :width="4"
              indeterminate
            />

            <v-progress-circular
              class="absolute top-[11px] left-[10px]"
              color="error"
              :size="50"
              :width="4"
              indeterminate
            />

            <v-progress-circular
              class="absolute top-[21px] left-[20px]"
              color="warning"
              :size="30"
              :width="4"
              indeterminate
            />
          </div>
          <v-flex
            class="mt-3 flex-col flex gap-1 mx-10 items-center justify-center"
          >
            <VTypical
              v-if="status !== 'checkingProblems'"
              class="blink"
              :steps="launchingSteps"
            />
            <div
              class="text-gray-500 transition-all"
              :class="{ 'text-transparent': status !== 'checkingProblems' }"
            >
              {{ t('launchStatus.checkingProblems') + '...' }}
            </div>
            <div
              class="text-gray-500 transition-all"
              :class="{ 'text-transparent': status !== 'injectingAuthLib' }"
            >
              {{ t('launchStatus.injectingAuthLib') + ` (${userProfile.authService})` + '...' }}
            </div>
          </v-flex>
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import { LaunchServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { LaunchStatusDialogKey, useLaunch } from '../composables/launch'
import { useI18n, useService } from '/@/composables'
import VTypical from '/@/components/VTyping.vue'
import { useCurrentUser } from '../composables/user'

const { t } = useI18n()
const { status } = useLaunch()
const { on } = useService(LaunchServiceKey)
const { userProfile } = useCurrentUser()
const { isShown, show, hide } = useDialog(LaunchStatusDialogKey)

const launchingSteps = computed(() => [
  t('launchStatus.launching'),
  4000,
  t('launchStatus.launchingSlow'),
])

on('minecraft-window-ready', () => {
  if (isShown.value) {
    hide()
  }
})
on('minecraft-exit', () => {
  if (isShown.value) {
    hide()
  }
})

watch(status, (s) => {
  switch (s) {
    case 'checkingProblems':
      show()
      break
    case 'injectingAuthLib':
      show()
      break
    case 'launching':
      show()
      break
    case 'idle':
      break
    default:
  }
})
</script>

<style scoped="true">
.blink::after {
  content: '|';
  animation: blink 1s infinite step-start;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

</style>
