<template>
  <div
    class="flex flex-1 flex-grow-0 flex-row items-center justify-start min-h-[52px]"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div
      class="flex flex-grow-0 flex-row items-center justify-center gap-1"
    >
      <AvatarItemList
        :items="items"
      />
    </div>
    <div class="flex-grow mr-2" />
    <transition name="fade-transition">
      <div
        key="launch-button-group"
        class="flex items-center justify-end overflow-visible"
        v-if="!isInFocusMode || !(router.currentRoute.path === '/')"
      >
        <HomeLaunchButtonStatus
          :active="active"
        />
        <HomeLaunchButton
          class="ml-4"
          :compact="compact"
          @mouseenter="active = true"
          @mouseleave="active = false"
        />
      </div>
    </transition>
  </div>
</template>

<script lang=ts setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import { useExtensionItemsGamePlay, useExtensionItemsVersion } from '@/composables/extensionItems'
import { kInstance } from '@/composables/instance'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kCompact } from '@/composables/scrollTop'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import HomeLaunchButton from './HomeLaunchButton.vue'
import HomeLaunchButtonStatus from './HomeLaunchButtonStatus.vue'

const { instance, runtime: version } = injection(kInstance)
const { versionHeader } = injection(kInstanceVersion)
const isInFocusMode = useInFocusMode()
const router = useRouter()

const active = ref(false)

const compact = injection(kCompact)

const versionItems = useExtensionItemsVersion(instance, versionHeader)
const playDataItems = useExtensionItemsGamePlay(instance)
const items = computed(() => [...versionItems.value, ...playDataItems.value])

</script>
