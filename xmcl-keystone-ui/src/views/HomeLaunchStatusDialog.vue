<template>
  <v-dialog
    v-model="isShown"
    :width="380"
  >
    <v-card class="h-full flex select-none flex-col">
      <v-card-title v-if="exiting">
        {{ t('launchStatus.exit') }}
      </v-card-title>
      <AppLoadingCircular
        v-if="launching || !windowReady"
        :texts="launchingSteps"
        :secondary-hint="launchingStatus !== ''"
        :hint="hint"
      />

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
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'
import { LaunchStatusDialogKey } from '../composables/launch'
import AppLoadingCircular from '@/components/AppLoadingCircular.vue'

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
