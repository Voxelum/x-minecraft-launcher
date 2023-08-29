<template>
  <v-dialog
    v-model="isShown"
    :width="380"
    :persistent="true"
  >
    <v-card color="secondary">
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
              class="absolute left-[10px] top-[11px]"
              color="error"
              :size="50"
              :width="4"
              indeterminate
            />

            <v-progress-circular
              class="absolute left-[20px] top-[21px]"
              color="warning"
              :size="30"
              :width="4"
              indeterminate
            />
          </div>
          <v-flex
            class="mx-10 my-3 flex flex-col items-center justify-center gap-1"
          >
            <VTypical
              v-if="notReady || launching"
              class="blink"
              :steps="launchingSteps"
            />
            <!-- <div
              class="transition-all text-transparent"
              :class="{ 'text-gray-500': status === 'injectingAuthLib' }"
            >
              {{ t('launchStatus.injectingAuthLib') + ` (${userProfile.authService})` + '...' }}
            </div> -->
          </v-flex>
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import VTypical from '@/components/VTyping.vue'
import { useService } from '@/composables'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'
import { LaunchServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { LaunchStatusDialogKey, kLaunchStatus } from '../composables/launch'

const { t } = useI18n()
const { launching } = injection(kLaunchStatus)
const { on } = useService(LaunchServiceKey)
const { userProfile } = injection(kUserContext)
const { isShown, show, hide } = useDialog(LaunchStatusDialogKey)
const notReady = ref(false)

const launchingSteps = computed(() => [
  t('launchStatus.launching'),
  4000,
  t('launchStatus.launchingSlow'),
])

on('minecraft-window-ready', () => {
  if (isShown.value) {
    hide()
    notReady.value = false
  }
})
on('minecraft-exit', () => {
  if (isShown.value) {
    hide()
    notReady.value = false
  }
})

watch(launching, (s) => {
  if (s) {
    show()
    notReady.value = true
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
