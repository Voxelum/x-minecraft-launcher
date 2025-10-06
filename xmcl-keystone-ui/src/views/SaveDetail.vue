<script setup lang="ts">
import MarketProjectDetail, { ProjectDetail } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import { useDateString } from '@/composables/date'
import { InstanceSaveFile, kInstanceSave } from '@/composables/instanceSave'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'
import SaveMapRenderer from '@/components/SaveMapRenderer.vue'
import MarketProjectDetailSave from '@/components/MarketProjectDetailSave.vue'

const props = defineProps<{
  save: ProjectEntry<InstanceSaveFile>
}>()

const emit = defineEmits<{
  (event: 'delete', save: InstanceSaveFile): void
}>()

const { getDateString } = useDateString()
const { t } = useI18n()

const onSaved = () => {
  // Trigger a refresh of the save data
  const { revalidate } = injection(kInstanceSave)
  revalidate()
}

const model = computed(() => {
  const v = props.save
  const f = v.files![0]
  
  // Get the Minecraft version for Chunkbase link (if available)
  const mcVersion = f.gameVersion || '1_21_4'
  const chunkbaseUrl = `https://www.chunkbase.com/apps/seed-map#seed=${f.seed}&platform=java_${mcVersion.replace(/\./g, '_')}&dimension=overworld&x=0&z=0&zoom=0.25`
  
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
    externals: [{
      icon: 'public',
      name: t('save.viewSeedMap'),
      url: chunkbaseUrl,
    }],
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
  <div class="relative">
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
    >
      <template #properties>
        <MarketProjectDetailSave
          :save-file="save.installed[0]"
          @saved="onSaved"
        />
      </template>
    </MarketProjectDetail>
    
    <div class="mt-4">
      <SaveMapRenderer :save-path="save.installed[0].path" />
    </div>
  </div>
</template>
