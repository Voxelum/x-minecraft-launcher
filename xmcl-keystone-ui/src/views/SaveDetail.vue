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

const { path: instancePath, instance } = injection(kInstance)

const props = defineProps<{
  save: ProjectEntry<InstanceSaveFile>
}>()

const emit = defineEmits<{
  (event: 'delete', save: InstanceSaveFile): void
}>()

const { getDateString } = useDateString()
const { t } = useI18n()

const savePath = computed(() => props.save.installed[0]?.path || '')
const version = computed(() => JSON.stringify([instance.value.version, instance.value.runtime]))
const { progress, loading: loadingProgress, error: progressError, refresh: refreshProgress } = useInstanceSaveProgress(savePath, instancePath, version)

const hasQuests = computed(() => !!progress.value?.quests && progress.value.quests.chapters.length > 0)
const progressCategory = computed(() => hasQuests.value ? 'quests' : 'advancements')
const currentTab = ref<'progress' | 'map'>('progress')

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
        <v-tab value="progress">
          <v-icon size="small" class="mr-1.5">{{ hasQuests ? 'military_tech' : 'emoji_events' }}</v-icon>
          {{ t(`save.progress.${progressCategory}`) }}
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
          v-if="currentTab === 'progress'"
          class="h-full"
          :category="progressCategory"
          :progress="progress"
          :loading="loadingProgress"
          :error="progressError"
          @refresh="refreshProgress"
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
  height: clamp(320px, calc(100vh - 260px), 640px);
  width: 100%;
}
.save-content-wrapper {
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>
