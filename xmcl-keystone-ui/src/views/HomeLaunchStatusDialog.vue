<template>
  <v-dialog
    v-model="isShown"
    :width="380"
  >
    <v-card>
      <v-card-title v-if="exiting">
        {{ t('launchStatus.exit') }}
      </v-card-title>
      <v-container v-if="launching || !windowReady">
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
          <v-flex class="mx-10 my-3 flex flex-col items-center justify-center gap-1">
            <VTypical
              class="blink"
              :steps="launchingSteps"
            />
            <div
              class="text-transparent transition-all"
              :class="{ 'text-gray-500': launchingStatus !== '' }"
            >
              {{ hint + '...' }}
            </div>
          </v-flex>
        </v-layout>
      </v-container>

      <div
        v-if="exiting"
        class="flex p-3"
      >
        <v-btn
          text
          @click="onCancel"
        >
          {{ t('cancel') }}
        </v-btn>
        <div class="flex-grow" />
        <v-btn
          text
          color="red"
          @click="onKill"
        >
          <v-icon left>
            exit_to_app
          </v-icon>
          {{ t('yes') }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import VTypical from '@/components/VTyping.vue'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'
import { LaunchStatusDialogKey } from '../composables/launch'

const { t } = useI18n()
const { launching, windowReady, kill, launchingStatus } = injection(kInstanceLaunch)
const exiting = ref(false)
const { isShown, show, hide } = useDialog(LaunchStatusDialogKey, (isKilling) => {
  exiting.value = !!isKilling
})

const hint = computed(() => launchingStatus.value === 'preparing-authlib'
  ? t('launchStatus.injectingAuthLib')
  : launchingStatus.value === 'assigning-memory'
    ? t('launchStatus.assigningMemory')
    : launchingStatus.value === 'refreshing-user'
      ? t('launchStatus.refreshingUser')
      : launchingStatus.value === 'spawning-process'
        ? t('launchStatus.spawningProcess')
        : '')

const launchingSteps = computed(() => [
  t('launchStatus.launching'),
  4000,
  t('launchStatus.launchingSlow'),
])

watch(launching, (val) => {
  if (val) {
    show()
  }
})

const onKill = () => {
  kill()
  hide()
}
const onCancel = () => hide()

watch(windowReady, (ready) => {
  if (ready && isShown.value) {
    hide()
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
