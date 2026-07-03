<template>
  <div ref="scrollElement" class="select-none">
    <HomeCriticalError />
    <transition name="slide-y-reverse-transition" mode="out-in">
      <div v-if="!isFocus" class="mx-3 relative">
        <Transition name="slide-y-reverse-transition">
          <div v-if="!isBedrock" class="flex items-center justify-center gap-1 sticky top-40 z-3">
            <v-divider class="divider mx-0" />
            <v-btn
              class="z-4"
              icon
              variant="text"
              :aria-label="t('setting.layout.focus')"
              @click="isFocus = true"
            >
              <v-icon aria-hidden="true"> keyboard_arrow_down </v-icon>
            </v-btn>
            <v-divider class="divider mx-0" />
          </div>
        </Transition>
        <HomeBedrock v-if="isBedrock" />
        <template v-else>
          <HomeGrid />
          <HomeUpstreamCurseforge
            v-if="instance.upstream && instance.upstream.type === 'curseforge-modpack'"
            :id="instance.upstream.modId"
          />
          <HomeUpstreamModrinth
            v-else-if="instance.upstream && instance.upstream.type === 'modrinth-modpack'"
            :id="instance.upstream.projectId"
          />
          <HomeUpstreamFeedTheBeast
            v-else-if="instance.upstream && instance.upstream.type === 'ftb-modpack'"
            :id="instance.upstream.id"
          />
        </template>
      </div>
      <HomeFocusFooter v-else class="absolute bottom-0 left-0 pb-[26px]" />
    </transition>
  </div>
</template>
<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { useGlobalDrop } from '@/composables/dropHandler'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { useGamepadAction } from '@/composables/gamepad'
import { kUpstream } from '@/composables/instanceUpdate'
import { kCompact } from '@/composables/scrollTop'
import { useTutorial } from '@/composables/tutorial'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import { isBedrockInstance } from '@xmcl/instance'
import type { DriveStep } from 'driver.js'
import HomeCriticalError from './HomeCriticalError.vue'
import HomeFocusFooter from './HomeFocusFooterV2.vue'
import HomeBedrock from './HomeBedrock.vue'
import HomeGrid from './HomeGrid.vue'
import HomeUpstreamCurseforge from './HomeUpstreamCurseforge.vue'
import HomeUpstreamFeedTheBeast from './HomeUpstreamFeedTheBeast.vue'
import HomeUpstreamModrinth from './HomeUpstreamModrinth.vue'

const isFocus = useInFocusMode()
const { instance } = injection(kInstance)
const isBedrock = computed(() => isBedrockInstance(instance.value))

watch(isBedrock, (bedrock) => {
  if (bedrock) {
    isFocus.value = false
  }
}, { immediate: true })
provide(
  kUpstream,
  computed(() => ({
    upstream: instance.value.upstream,
    minecraft: instance.value.runtime.minecraft,
  })),
)

const compact = injection(kCompact)
onMounted(() => {
  compact.value = false
})

const { show } = useDialog('HomeDropModpackDialog')

useGlobalDrop({
  onDrop: async (e) => {
    const files = e.files
    const file = files?.[0]
    if (file) {
      const ext = file.name.split('.').pop()
      if (ext === 'zip' || ext === 'mrpack') {
        show(file.path)
        return
      }
    }
  },
})

const scrollElement = ref(null as HTMLElement | null)
provide('scrollElement', scrollElement)

const { t } = useI18n()

// Gamepad face-button actions scoped to the home page (auto-unregister on leave).
const router = useRouter()
const { launch: launchGame } = injection(kInstanceLaunch)
useGamepadAction('X', {
  label: () => t('gamepad.guide.launch'),
  handler: () => launchGame(),
})
useGamepadAction('Y', {
  label: () => t('gamepad.guide.instanceSettings'),
  handler: () => router.push('/base-setting'),
})

useTutorial(
  computed(() => {
    const steps: DriveStep[] = [
      {
        element: '#my-stuff-button',
        popover: { title: t('userAccount.add'), description: t('tutorial.userAccountDescription') },
      },
      {
        element: '#create-instance-button',
        popover: { title: t('instances.add'), description: t('tutorial.instanceAddDescription') },
      },
      {
        element: '#launch-button',
        popover: { title: t('launch.launch'), description: t('tutorial.launchDescription') },
      },
      {
        element: '#feedback-button',
        popover: { title: t('feedback.name'), description: t('tutorial.feedbackDescription') },
      },
    ]
    return steps
  }),
)
</script>
