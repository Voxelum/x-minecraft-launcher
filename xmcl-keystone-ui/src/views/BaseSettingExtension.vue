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
      class="flex flex-grow-0 flex-row items-center justify-center gap-2"
    >
      <AvatarItemList :items="items" />
      <v-divider vertical />
      <v-btn
        v-shared-tooltip="() => t('BaseSettingGeneral.title')"
        variant="text"
        :aria-pressed="!targetQuery"
        :class="{ 'v-btn--active': !targetQuery }"
        @click="navigate('')"
      >
        <v-icon :start="!targetQuery" class="material-icons-outlined">settings_heart</v-icon>
        <span :style="{ width: !targetQuery ? '80px' : 0 }" class="overflow-hidden transition-all!">
          {{ t('BaseSettingGeneral.title') }}
        </span>
      </v-btn>
      <v-btn
        v-shared-tooltip="() => t('modpack.name', 1)"
        variant="text"
        :aria-pressed="targetQuery === 'modpack'"
        :class="{ 'v-btn--active': targetQuery === 'modpack' }"
        @click="navigate('modpack')"
      >
        <v-icon :start="targetQuery === 'modpack'" class="material-icons-outlined"
          >folder_zip</v-icon
        >
        <span
          :style="{ width: targetQuery === 'modpack' ? '80px' : 0 }"
          class="overflow-hidden transition-all!"
        >
          {{ t('modpack.name', 1) }}
        </span>
      </v-btn>
      <v-btn
        v-shared-tooltip="() => t('setting.appearance')"
        variant="text"
        :aria-pressed="targetQuery === 'appearance'"
        :class="{ 'v-btn--active': targetQuery === 'appearance' }"
        @click="navigate('appearance')"
      >
        <v-icon :start="targetQuery === 'appearance'" class="material-icons-outlined"
          >invert_colors</v-icon
        >
        <span
          :style="{ width: targetQuery === 'appearance' ? 'auto' : 0 }"
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
        <v-btn color="primary" :loading="exporting || loading" @click="exportModpack" size="large">
          <v-icon start> build </v-icon>
          {{ t('modpack.export') }}
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
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const { instance, runtime: version } = injection(kInstance)
const { versionHeader } = injection(kInstanceVersion)

const active = ref(false)
const { t } = useI18n()
const compact = injection(kCompact)

const items = useExtensionItemsVersion(instance, versionHeader)

const targetQuery = useQuery('target')

const { exportModpack, exporting, loading } = injection(kModpackExport)

const router = useRouter()
function navigate(target: '' | 'modpack' | 'appearance') {
  if (router.currentRoute.value.query.target === target) {
    return
  }
  if (target === '') {
    router.replace({ query: {} })
  } else {
    router.replace({ query: { target } })
  }
}
</script>
