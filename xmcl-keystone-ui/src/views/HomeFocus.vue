<template>
  <div
    ref="content"
    class="h-full overflow-auto"
    @wheel="onWheel"
  >
    <Transition name="slide-y-transition">
      <div
        v-if="!inView"
        key="empty"
        class="h-full"
      >
        <HomeDatabaseError />
      </div>
      <HomeUpstreamCurseforge
        v-else-if="instance.upstream && instance.upstream.type === 'curseforge-modpack'"
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
    </Transition>

    <HomeFocusFooter
      class="absolute bottom-0 left-0 flex gap-6 px-8 pb-[26px]"
    />
  </div>
</template>
<script setup lang="ts">
import { kInstance } from '@/composables/instance'
import { useTutorial } from '@/composables/tutorial'
import { injection } from '@/util/inject'
import { DriveStep } from 'driver.js'
import debounce from 'lodash.debounce'
import HomeFocusFooter from './HomeFocusFooter.vue'
import HomeUpstreamCurseforge from './HomeUpstreamCurseforge.vue'
import HomeUpstreamModrinth from './HomeUpstreamModrinth.vue'
import HomeDatabaseError from './HomeDatabaseError.vue'

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

const content = ref<HTMLElement | null>(null)
let counter = 0
const inView = ref(false)
const scrollIn = debounce(() => {
  if (counter > 3 && instance.value.upstream) {
    inView.value = true
  }
  counter = 0
}, 300)

const scrollOut = debounce(() => {
  if (counter > 3 && instance.value.upstream) {
    inView.value = false
  }
  counter = 0
}, 300)

function onWheel(e: WheelEvent) {
  const v = content.value
  if (!v) return
  if (e.deltaY > 0) {
    if (!inView.value) {
      counter++
      scrollIn()
    }
  }
  if (e.deltaY < 0) {
    if (inView.value) {
      const el = content.value
      if (!el) return
      if (el.scrollTop === 0) {
        counter++
        scrollOut()
      }
    }
  }
}
</script>
