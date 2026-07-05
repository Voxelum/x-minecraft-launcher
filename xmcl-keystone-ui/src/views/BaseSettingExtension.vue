<template>
  <div
    class="flex flex-1 flex-grow-0 flex-row items-center justify-start min-h-[52px]"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div
      v-roving-tabindex
      role="group"
      :aria-label="t('baseSetting.title', 2)"
      class="flex flex-grow-0 flex-shrink min-w-0 flex-row items-center justify-center gap-2"
    >
      <AvatarItemList v-if="!isNarrow" :items="items" />
      <v-divider v-if="!isNarrow" vertical />
      <v-btn
        v-shared-tooltip="() => t('BaseSettingGeneral.title')"
        variant="text"
        :aria-pressed="!targetQuery"
        :class="{ 'v-btn--active': !targetQuery }"
        @click="navigate('')"
      >
        <v-icon :start="!isNarrow && !targetQuery" class="material-icons-outlined"
          >settings_heart</v-icon
        >
        <span
          :style="{ width: !isNarrow && !targetQuery ? '80px' : 0 }"
          class="overflow-hidden transition-all!"
        >
          {{ t('BaseSettingGeneral.title') }}
        </span>
      </v-btn>
      <v-btn
        v-if="!isBedrock"
        v-shared-tooltip="() => t('modpack.name', 1)"
        variant="text"
        :aria-pressed="targetQuery === 'modpack'"
        :class="{ 'v-btn--active': targetQuery === 'modpack' }"
        @click="navigate('modpack')"
      >
        <v-icon :start="!isNarrow && targetQuery === 'modpack'" class="material-icons-outlined"
          >folder_zip</v-icon
        >
        <span
          :style="{ width: !isNarrow && targetQuery === 'modpack' ? '80px' : 0 }"
          class="overflow-hidden transition-all!"
        >
          {{ t('modpack.name', 1) }}
        </span>
      </v-btn>
      <v-btn
        v-shared-tooltip="() => t('instance.launchServer')"
        variant="text"
        :aria-pressed="targetQuery === 'server'"
        :class="{ 'v-btn--active': targetQuery === 'server' }"
        data-testid="base-setting-server-tab"
        @click="navigate('server')"
      >
        <v-icon :start="!isNarrow && targetQuery === 'server'" class="material-icons-outlined">dns</v-icon>
        <span
          :style="{ width: !isNarrow && targetQuery === 'server' ? 'auto' : 0 }"
          class="overflow-hidden transition-all!"
        >
          {{ t('instance.launchServer') }}
        </span>
      </v-btn>
      <v-btn
        v-shared-tooltip="() => t('setting.appearance')"
        variant="text"
        :aria-pressed="targetQuery === 'appearance'"
        :class="{ 'v-btn--active': targetQuery === 'appearance' }"
        @click="navigate('appearance')"
      >
        <v-icon :start="!isNarrow && targetQuery === 'appearance'" class="material-icons-outlined"
          >invert_colors</v-icon
        >
        <span
          :style="{ width: !isNarrow && targetQuery === 'appearance' ? 'auto' : 0 }"
          class="overflow-hidden transition-all!"
        >
          {{ t('setting.appearance') }}
        </span>
      </v-btn>
    </div>
    <div class="flex-grow mr-2" />
    <transition name="fade-transition" mode="out-in">
      <div
        key="launch-button-group"
        class="flex items-center justify-end overflow-visible"
        v-if="!targetQuery"
      >
        <HomeLaunchButtonStatus :active="active" />
        <HomeLaunchButton
          class="ml-4"
          :compact="compact"
          @mouseenter="active = true"
          @mouseleave="active = false"
        />
      </div>
      <div
        v-else-if="targetQuery === 'modpack'"
        class="flex items-center justify-end overflow-hidden"
      >
        <v-btn
          rounded="pill"
          color="primary"
          :loading="exporting || loading"
          @click="exportModpack"
          size="large"
        >
          <span
            v-if="isGamepadActive"
            class="gp-btn__key gp-btn__key--primary mr-2"
            style="transform: scale(0.85); vertical-align: middle;"
          >{{ buttonX }}</span>
          <v-icon v-else start> build </v-icon>
          {{ t('modpack.export') }}
        </v-btn>
      </div>
      <div
        v-else-if="targetQuery === 'server'"
        class="flex items-center justify-end gap-2 overflow-hidden"
      >
        <v-btn
          :color="serverLaunch.running.value ? 'error' : 'primary'"
          rounded="pill"
          :variant="serverLaunch.running.value ? 'tonal' : 'flat'"
          size="large"
          :prepend-icon="isGamepadActive ? undefined : (serverLaunch.running.value ? 'stop' : 'play_arrow')"
          data-testid="server-tab-launch"
          :loading="serverLaunch.loading.value"
          @click="serverLaunch.running.value ? serverLaunch.killServer() : serverLaunch.launchServer()"
        >
          <span
            v-if="isGamepadActive"
            class="gp-btn__key gp-btn__key--primary mr-2"
            style="transform: scale(0.85); vertical-align: middle;"
          >{{ buttonX }}</span>
          {{ serverLaunch.running.value ? t('launch.killServer') : t('instance.launchServer') }}
        </v-btn>
      </div>
    </transition>
  </div>
</template>

<script lang="ts" setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import { useExtensionItemsVersion } from '@/composables/extensionItems'
import { kInstance } from '@/composables/instance'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kCompact } from '@/composables/scrollTop'
import { injection } from '@/util/inject'
import HomeLaunchButton from './HomeLaunchButton.vue'
import HomeLaunchButtonStatus from './HomeLaunchButtonStatus.vue'
import { useQuery } from '@/composables/query'
import { kModpackExport } from '@/composables/modpack'
import { kInstanceServerLaunch } from '@/composables/instanceServerLaunch'
import { useGamepadInnerNav } from '@/composables/gamepad'
import { useGamepad } from '@/composables/gamepad'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { useMediaQuery } from '@vueuse/core'

import { isBedrockInstance } from '@xmcl/instance'

const { instance, runtime: version } = injection(kInstance)
const { versionHeader } = injection(kInstanceVersion)
const isBedrock = computed(() => isBedrockInstance(instance.value))

const active = ref(false)
const { t } = useI18n()
const compact = injection(kCompact)

// Below this width the expanded active-tab label would push the whole toolbar
// (tabs + action button) past the container and overflow. Collapse every tab
// to icon-only there; the shared tooltips keep them discoverable.
const isNarrow = useMediaQuery('(max-width: 900px)')

const items = useExtensionItemsVersion(instance, versionHeader)

const targetQuery = useQuery('target')

const { exportModpack, exporting, loading } = injection(kModpackExport)
const serverLaunch = injection(kInstanceServerLaunch)
const { isActive: isGamepadActive, buttonX } = useGamepad()

const router = useRouter()
function navigate(target: '' | 'modpack' | 'appearance' | 'server') {
  if (router.currentRoute.value.query.target === target) {
    return
  }
  if (target === '') {
    router.replace({ query: {} })
  } else {
    router.replace({ query: { target } })
  }
}

// Gamepad triggers (L2/R2) cycle through the base-setting tabs.
const TAB_GROUP: Array<'' | 'modpack' | 'server' | 'appearance'> = ['', 'modpack', 'server', 'appearance']
useGamepadInnerNav({
  handler: (dir) => {
    const raw = (targetQuery.value || '') as string
    const cur = raw === 'general' ? '' : raw
    let idx = TAB_GROUP.indexOf(cur as '' | 'modpack' | 'server' | 'appearance')
    if (idx === -1) idx = 0
    const next = dir === 'next'
      ? (idx + 1) % TAB_GROUP.length
      : (idx - 1 + TAB_GROUP.length) % TAB_GROUP.length
    navigate(TAB_GROUP[next])
  },
})
</script>
