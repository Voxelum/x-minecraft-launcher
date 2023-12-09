<template>
  <div>
    <HomeFocusFooter
      class="absolute bottom-0 left-0 flex gap-6 px-8 pb-[26px]"
    />
  </div>
</template>
<script setup lang="ts">
import HomeFocusFooter from './HomeFocusFooter.vue'
import { useTutorial } from '@/composables/tutorial'
import { DriveStep } from 'driver.js'

const { t } = useI18n()
useTutorial(computed(() => {
  const steps: DriveStep[] = [
    { element: '#user-avatar', popover: { title: t('userAccount.add'), description: t('tutorial.userAccountDescription') } },
    { element: '#select-game-button', popover: { title: t('instances.choose'), description: t('tutorial.instanceSelectDescription') } },
    { element: '#launch-button', popover: { title: t('launch.launch'), description: t('tutorial.launchDescription') } },
    { element: '#feedback-button', popover: { title: t('feedback.name'), description: t('tutorial.feedbackDescription') } },
  ]
  return steps
}))
</script>
