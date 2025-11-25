<template>
  <div class="w-full">
    <div class="relative footer flex-grow flex items-end">
      <HomeFooterCard />
      <div
        key="launch-button-group"
        class="flex flex-wrap justify-end items-center gap-y-6 gap-x-2"
      >
        <HomeHeaderInstallStatus
          v-if="status === 1 || status === 3"
          class="mr-2"
          :name="taskName"
          :total="total"
          :progress="progress"
        />
        <HomeLaunchButtonStatus
          class="mr-4 ml-2"
          v-else
          :active="active"
        />
        <HomeLaunchButton
          :status="status"
          top
          @pause="pause"
          @resume="resume"
          @mouseenter="active = true"
          @mouseleave="active = false"
        />
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { kLaunchTask } from '@/composables/launchTask'
import { injection } from '@/util/inject'
import HomeHeaderInstallStatus from './HomeHeaderInstallStatus.vue'
import HomeLaunchButton from './HomeLaunchButton.vue'
import HomeLaunchButtonStatus from './HomeLaunchButtonStatus.vue'
import HomeFooterCard from './HomeFooterCard.vue'

const active = ref(false)
const { total, progress, status, name: taskName, pause, resume } = injection(kLaunchTask)
</script>

<style>
.tabs>div[role="tablist"] {
  background: var(--color-sidebar-bg) !important;
  backdrop-filter: blur(var(--blur-card));
}
</style>
<style scoped>
.footer {
  @apply mx-6;
}

@media (max-width: 850px) {
  .footer {
    @apply mr-2;
  }
}
</style>