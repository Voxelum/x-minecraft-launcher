<template>
  <div
    class="relative h-full"
  >
    <transition name="fade-transition" mode="out-in">
      <div
        v-if="!upstreamQuery"
        class="h-full"
      >
        <HomeDatabaseError />
        <HomeFocusFooter
          class="absolute bottom-0 left-0 pb-[26px]"
        />
      </div>
      <template v-else>
        <HomeUpstreamCurseforge
          v-if="instance.upstream && instance.upstream.type === 'curseforge-modpack'"
          :id="instance.upstream.modId"
          key="curseforge"
          class="p-2"
        />
        <HomeUpstreamModrinth
          v-else-if="instance.upstream && instance.upstream.type === 'modrinth-modpack'"
          :id="instance.upstream.projectId"
          key="modrinth"
          class="p-2"
        />
        <HomeUpstreamFeedTheBeast
          v-else-if="instance.upstream && instance.upstream.type === 'ftb-modpack'"
          :id="instance.upstream.id"
          key="ftb"
          class="p-2"
        />
      </template>
    </transition>

  </div>
</template>
<script setup lang="ts">
import { kInstance } from '@/composables/instance'
import { useTutorial } from '@/composables/tutorial'
import { injection } from '@/util/inject'
import { DriveStep } from 'driver.js'
import HomeFocusFooter from './HomeFocusFooter.vue'
import HomeUpstreamCurseforge from './HomeUpstreamCurseforge.vue'
import HomeUpstreamModrinth from './HomeUpstreamModrinth.vue'
import HomeDatabaseError from './HomeDatabaseError.vue'
import HomeUpstreamFeedTheBeast from './HomeUpstreamFeedTheBeast.vue'
import { useScroll } from '@vueuse/core'
import { useQuery } from '@/composables/query'

const { instance } = injection(kInstance)
const { t } = useI18n()
useTutorial(computed(() => {
  const steps: DriveStep[] = [
    { element: '#user-avatar', popover: { title: t('userAccount.add'), description: t('tutorial.userAccountDescription') } },
    { element: '#my-stuff-button', popover: { title: t('instances.choose'), description: t('tutorial.instanceSelectDescription') } },
    { element: '#create-game-button', popover: { title: t('instances.add'), description: t('tutorial.instanceAddDescription') } },
    { element: '#launch-button', popover: { title: t('launch.launch'), description: t('tutorial.launchDescription') } },
    { element: '#feedback-button', popover: { title: t('feedback.name'), description: t('tutorial.feedbackDescription') } },
  ]
  return steps
}))

const upstreamQuery = useQuery('upstream')
</script>
