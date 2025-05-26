<template>
  <div class="w-full">
    <div class="relative mx-6 flex-grow flex gap-6 items-end">
      <v-card flat class="rounded-lg tabs-card" color="transparent" @mouseenter="onMouseEnter" @mouseleave="onMouseLeaved">
        <div class="flex absolute top-0 h-4 z-4 right-0 p-1 icons" :class="{ visibled: pinned || counter > 0 }">
          <div class="flex-grow" />
          <v-btn :class="{ 'v-btn--active': pinned }" icon small @click="onPin">
            <v-icon class="material-symbols-outlined ">
              keep
            </v-icon>
          </v-btn>
          <v-btn icon small @click="onViewDashboard">
            <v-icon class="rotate-[45deg]">
              unfold_more
            </v-icon>
          </v-btn>
        </div>
        <v-tabs-items
          ref="tabItems"
          v-model="tab"
          class="bg-transparent! tabs-items"
          :class="{ visibled: pinned || counter > 0 }"
        >
          <v-tab-item>
            <HomeModCard class="rounded-t-lg" :row="1" :row-count="rowCount" />
          </v-tab-item>
          <v-tab-item>
            <HomeResourcePacksCard class="rounded-t-lg" :row="1" :row-count="rowCount" />
          </v-tab-item>
          <v-tab-item>
            <HomeShaderPackCard class="rounded-t-lg" :row="1" :row-count="rowCount" />
          </v-tab-item>
          <v-tab-item>
            <HomeSavesCard class="rounded-t-lg" :row="1" :row-count="rowCount" />
          </v-tab-item>
          <v-tab-item>
            <HomeScreenshotCard :height="screenshotHeight" :instance="instance" />
          </v-tab-item>
          <v-tab-item
            v-if="headerData"
          >
            <HomeUpstreamHeader
              :value="headerData"
              dense
            />
          </v-tab-item>
        </v-tabs-items>
        <v-tabs v-model="tab" :show-arrows="true" class="tabs">
          <v-tab>
            {{ t('mod.name') }}
          </v-tab>
          <v-tab>
            {{ t('resourcepack.name') }}
          </v-tab>
          <v-tab>
            {{ t('shaderPack.name') }}
          </v-tab>
          <v-tab>
            {{ t('save.name') }}
          </v-tab>
          <v-tab>
            {{ t('screenshots.name') }}
          </v-tab>
          <v-tab
            v-if="headerData"
          >
            {{ instance.upstream && instance.upstream.type === 'curseforge-modpack' ? 'Curseforge' : 'Modrinth' }}
          </v-tab>
        </v-tabs>
      </v-card>
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
          class="ml-4"
          :status="status"
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
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kLaunchTask } from '@/composables/launchTask'
import { useQuery, useQueryNumber } from '@/composables/query'
import { useInFocusMode } from '@/composables/uiLayout'
import { injection } from '@/util/inject'
import { useLocalStorage, useWindowSize } from '@vueuse/core'
import HomeHeaderInstallStatus from './HomeHeaderInstallStatus.vue'
import HomeLaunchButton from './HomeLaunchButton.vue'
import HomeLaunchButtonStatus from './HomeLaunchButtonStatus.vue'
import HomeModCard from './HomeModCard.vue'
import HomeResourcePacksCard from './HomeResourcePacksCard.vue'
import HomeSavesCard from './HomeSavesCard.vue'
import HomeScreenshotCard from './HomeScreenshotCard.vue'
import HomeShaderPackCard from './HomeShaderPackCard.vue'
import HomeUpstreamHeader from './HomeUpstreamHeader.vue'
import { getCurseforgeProjectModel, useCurseforgeUpstreamHeader } from '@/composables/curseforge'
import { useSWRVModel } from '@/composables/swrv'
import { useModrinthHeaderData } from '@/composables/modrinth'
import { getModrinthProjectModel } from '@/composables/modrinthProject'
import { kTheme } from '@/composables/theme'

const active = ref(false)
const { path, refreshing, instance } = injection(kInstance)
const { total, progress, status, name: taskName, pause, resume } = injection(kLaunchTask)
const tab = useQueryNumber('homeTab', 0)
const { t } = useI18n()
const tabItems = ref(null as null | Vue)
const counter = ref(0)
const visible = ref(false)
const { blurCard, cardColor } = injection(kTheme)

const { data: project } = useSWRVModel(getCurseforgeProjectModel(computed(() => instance.value.upstream?.type === 'curseforge-modpack' ? Number(instance.value.upstream.modId) : undefined)))
const curseforgeHeaderData = useCurseforgeUpstreamHeader(project)
const { data: modrinthProject } = useSWRVModel(getModrinthProjectModel(computed(() => instance.value.upstream?.type === 'modrinth-modpack' ? instance.value.upstream.projectId : undefined)))
const modrinthHeaderData = useModrinthHeaderData(modrinthProject)
const headerData = computed(() => {
  const val = instance.value.upstream
  if (!val) return undefined
  if (val.type === 'curseforge-modpack') {
    return curseforgeHeaderData.value
  }
  if (val.type === 'modrinth-modpack') {
    return modrinthHeaderData.value
  }
  return undefined
})


const isFoucs = useInFocusMode()
const { height } = useWindowSize()

const screenshotHeight = computed(() => {
  const el = tabItems.value?.$el
  if (!el) {
    return 240
  }
  return el.getBoundingClientRect().height
})
const rowCount = computed(() => {
  const el = tabItems.value?.$el
  // oxlint-disable-next-line
  const windowHeight = height.value // keep the effect
  if (!el) {
    return 52
  }

  const rect = el.getBoundingClientRect()
  const rows = Math.floor((rect.height - 64 - 52 - 22 - 16) / 30)
  const cols = Math.floor((rect.width - 32) / 30)

  return rows * cols
})

const pinned = useLocalStorage('home-pinned', true)
function onPin() {
  pinned.value = !pinned.value
}

function onViewDashboard() {
  isFoucs.value = false
}

function onMouseLeaved() {
  counter.value -= 1
  if (counter.value <= 0) {
    counter.value = 0
    setTimeout(() => {
      visible.value = false
    }, 2000)
  }
}

function onMouseEnter() {
  counter.value += 1
}
</script>

<style scoped>
.tabs-card {
  max-width: 450px;
  min-width: 450px;
  
}

.tabs-card>.icons, .tabs-card>.tabs-items {
transition: all 0.2s ease-in-out;
  opacity: 0;
}

.visibled {
  opacity: 1 !important;
}

.tabs {
  @apply rounded;
}

.tabs-items, .tabs-items .v-window-item {
  min-height: 280px;
  max-height: 280px;
  height: 280px;
}

@media (min-width: 1350px) {
  .tabs-card {
    max-width: max(450px, 33%);
    min-width: max(450px, 33%);
  }
}

/* when height > 830px */
@media (min-height: 830px) {
  .tabs-items, .tabs-items .v-window-item {
    min-height: max(280px, 33vh);
    max-height: max(280px, 33vh);
    height: max(280px, 33vh);
  }
}

/* when height < 600px */
@media (max-height: 600px) {
  .tabs-items, .tabs-items .v-window-item {
    min-height: min(280px, 46vh);
    max-height: min(280px, 46vh);
    height: min(280px, 46vh);
  }
}

/* when height < 490px */
</style>
<style>
.tabs>div[role="tablist"] {
  background: var(--color-sidebar-bg) !important;
  backdrop-filter: blur(var(--blur-card));
}
</style>