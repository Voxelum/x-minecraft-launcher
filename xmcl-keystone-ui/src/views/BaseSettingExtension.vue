<template>
  <div
    class="flex flex-1 flex-grow-0 flex-row items-center justify-start min-h-[52px]"
    :class="{
      'mb-3': !compact,
      'mb-2': compact,
    }"
  >
    <div
      class="flex flex-grow-0 flex-row items-center justify-center gap-2"
    >
      <AvatarItemList 
        :items="items"
      />
      <v-divider vertical />
      <v-btn text :class="{ 'v-btn--active': !targetQuery }" @click="replace({ query: {} })">
        {{ t("BaseSettingGeneral.title") }}
      </v-btn>
      <v-btn text :class="{ 'v-btn--active': targetQuery === 'modpack' }" @click="replace({ query: { target: 'modpack' } })">
        {{ t("modpack.name", 1) }}
      </v-btn>
      <!-- <v-btn text :class="{ 'v-btn--active': targetQuery === 'advanced' }" @click="replace({ query: { target: 'advanced'} })">
        Advance
      </v-btn> -->
    </div>
    <div class="flex-grow mr-2" />
    <transition name="fade-transition" mode="out-in">
      <div
        key="launch-button-group"
        class="flex items-center justify-end overflow-visible"
        v-if="!targetQuery"
      >
        <HomeHeaderInstallStatus
          v-if="status === 1 || status === 3"
          class="mr-2"
          :name="taskName"
          :total="total"
          :progress="progress"
        />
        <HomeLaunchButtonStatus
          v-else
          :active="active"
        />
        <HomeLaunchButton
          class="ml-4"
          :compact="compact"
          @mouseenter="active = true"
          @mouseleave="active = false"
        />
      </div>
      <div v-else-if="targetQuery === 'modpack'" class="flex items-center justify-end overflow-hidden">
        <v-btn
          color="primary"
          large
          :loading="exporting || loading"
          @click="exportModpack"
        >
          <v-icon left>
            build
          </v-icon>
          {{ t("modpack.export") }}
        </v-btn>
      </div>
    </transition>
  </div>
</template>

<script lang=ts setup>
import AvatarItemList from '@/components/AvatarItemList.vue'
import { useExtensionItemsVersion } from '@/composables/extensionItems'
import { kInstance } from '@/composables/instance'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kLaunchTask } from '@/composables/launchTask'
import { kCompact } from '@/composables/scrollTop'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import HomeHeaderInstallStatus from './HomeHeaderInstallStatus.vue'
import HomeLaunchButton from './HomeLaunchButton.vue'
import HomeLaunchButtonStatus from './HomeLaunchButtonStatus.vue'
import { useQuery } from '@/composables/query'
import { kModpackExport } from '@/composables/modpack'

const { instance, runtime: version } = injection(kInstance)
const { versionHeader } = injection(kInstanceVersion)
const { total, progress, status, name: taskName } = injection(kLaunchTask)

const active = ref(false)
const { t } = useI18n()
const compact = injection(kCompact)

const items = useExtensionItemsVersion(instance, versionHeader)

const targetQuery = useQuery('target')

const { replace } = useRouter()

const { exportModpack, exporting, loading } = injection(kModpackExport)

</script>
