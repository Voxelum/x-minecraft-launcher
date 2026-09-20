<script setup lang="ts">
import MarketProjectDetail, { ProjectDetail } from '@/components/MarketProjectDetail.vue'
import MarketProjectDetailSave from '@/components/MarketProjectDetailContentSave.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import SaveWorldMap from '@/components/SaveWorldMap.vue'
import SaveProgress from '@/components/SaveProgress.vue'
import { useDateString } from '@/composables/date'
import { InstanceSaveFile, kInstanceSave } from '@/composables/instanceSave'
import { useInstanceSaveProgress } from '@/composables/instanceSaveProgress'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'

const { path: instancePath } = injection(kInstance)

const props = defineProps<{
  save: ProjectEntry<InstanceSaveFile>
}>()

const emit = defineEmits<{
  (event: 'delete', save: InstanceSaveFile): void
}>()

const { getDateString } = useDateString()
const { t } = useI18n()

const savePath = computed(() => props.save.installed[0]?.path || '')
const { progress, loading: loadingProgress } = useInstanceSaveProgress(savePath, instancePath)

const hasQuests = computed(() => !!progress.value?.quests && progress.value.quests.chapters.length > 0)
const hasAdvancements = computed(() => (progress.value?.advancements?.items?.length ?? 0) > 0)

const currentTab = ref<'advancements' | 'quests' | 'map'>('advancements')

watch([hasQuests, hasAdvancements], ([q, a]) => {
  if (currentTab.value === 'map') return
  if (q) {
    currentTab.value = 'quests'
  } else if (a) {
    currentTab.value = 'advancements'
  }
}, { immediate: true })

const model = computed(() => {
  const v = props.save
  const f = v.files![0]
  const detail: ProjectDetail = {
    id: v.id,
    icon: v.icon,
    title: v.title,
    description: v.description,
    author: v.author,
    downloadCount: 0,
    follows: 0,
    url: '',
    categories: [],
    modLoaders: [],
    htmlContent: '',
    externals: [],
    galleries: [],
    info: [{
      name: t('instance.lastPlayed'),
      value: getDateString(f.lastPlayed),
      icon: 'history',
    }],
  }

  return detail
})

const versions = computed(() => {
  const v = props.save
  const version: ProjectVersion = {
    id: v.id,
    name: v.title,
    version: '',
    disabled: !!v.disabled,
    installed: true,
    type: 'release',
    downloadCount: 0,
    loaders: [],
  }
  return [version]
})

const onInstall = () => { }
const { enableSave, disableSave } = injection(kInstanceSave)
const onEnable = (enable: boolean) => {
  if (enable) {
    enableSave(props.save.installed[0])
  } else {
    disableSave(props.save.installed[0])
  }
}

</script>
<template>
  <MarketProjectDetail
    :detail="model"
    :dependencies="[]"
    :enabled="!save.disabled"
    :has-installed-version="true"
    :selected-installed="true"
    :loading="false"
    :versions="versions"
    :updating="false"
    :has-more="false"
    :loading-versions="false"
    :no-delete="!!save.installed[0].linkTo"
    no-version
    @install="onInstall"
    @delete="emit('delete', save.installed[0])"
    @enable="onEnable"
    no-padding-content
  >
    <template #tabs>
      <v-tabs v-model="currentTab" bg-color="transparent">
        <v-tab v-if="!hasQuests" value="advancements">
          <v-icon size="small" class="mr-1.5">emoji_events</v-icon>
          {{ t('save.progress.advancements') }}
        </v-tab>
        <v-tab v-if="hasQuests" value="quests">
          <v-icon size="small" class="mr-1.5">military_tech</v-icon>
          {{ t('save.progress.quests') }}
        </v-tab>
        <v-tab value="map">
          <v-icon size="small" class="mr-1.5">map</v-icon>
          {{ t('save.map.tabTitle') }}
        </v-tab>
      </v-tabs>
    </template>
    <template #content>
      <div class="save-container relative overflow-hidden h-full w-full">
        <SaveProgress
          v-if="currentTab === 'advancements' || currentTab === 'quests'"
          class="h-full"
          :category="currentTab"
          :progress="progress"
          :loading="loadingProgress"
          :save-path="save.installed[0].path"
          :instance-path="instancePath"
        />
        <div v-else-if="currentTab === 'map'" class="save-content-wrapper h-full">
          <SaveWorldMap :save-path="save.installed[0].path" />
        </div>
      </div>
    </template>
    <template #properties>
      <MarketProjectDetailSave
        :save-file="save.installed[0]"
      />
    </template>
  </MarketProjectDetail>
</template>

<style scoped>
.save-container {
  height: 65vh;
  min-height: 480px;
  width: 100%;
}
.save-content-wrapper {
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>
