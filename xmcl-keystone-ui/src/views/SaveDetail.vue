<script setup lang="ts">
import MarketProjectDetail, { ProjectDetail } from '@/components/MarketProjectDetail.vue'
import MarketProjectDetailSave from '@/components/MarketProjectDetailContentSave.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import SaveMapRenderer from '@/components/SaveMapRenderer.vue'
import { useService } from '@/composables'
import { useDateString } from '@/composables/date'
import { InstanceSaveFile, kInstanceSave } from '@/composables/instanceSave'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'

const props = defineProps<{
  save: ProjectEntry<InstanceSaveFile>
}>()

const emit = defineEmits<{
  (event: 'delete', save: InstanceSaveFile): void
}>()

const { getDateString } = useDateString()
const { t } = useI18n()
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
  >
    <template #content>
      <!-- <SaveMapRenderer :save-path="save.installed[0].path" /> -->
    </template>
    <template #properties>
      <MarketProjectDetailSave
        :save-file="save.installed[0]"
      />
    </template>
  </MarketProjectDetail>
</template>
