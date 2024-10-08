<script setup lang="ts">
import MarketProjectDetail, { Info, ProjectDetail } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { InstanceResourcePack, kInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { useProjectDetailUpdate } from '@/composables/projectDetail'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'
import { getExpectedSize } from '@/util/size'
import { InstanceResourcePacksServiceKey, RuntimeVersions } from '@xmcl/runtime-api'

const props = defineProps<{
  resourcePack: ProjectEntry<InstanceResourcePack>
  runtime: RuntimeVersions
  installed: InstanceResourcePack[]
}>()

const isUnmapped = computed(() => {
  return props.installed[0].path === ''
})

const isVanilla = computed(() => {
  return props.resourcePack.id === 'vanilla' || props.resourcePack.id === 'file/mod_resources'
})

const versions = computed(() => {
  const files = props.resourcePack.files || []
  const all: ProjectVersion[] = files.map((f) => {
    const version: ProjectVersion = {
      id: f.path || f.id,
      name: basename(f.path || f.id),
      version: f.version,
      downloadCount: 0,
      installed: true,
      loaders: [],
      type: 'release',
      disabled: false,
    }
    return version
  })
  return all
})

const installedVersions = versions
const selectedVersion = ref(installedVersions.value[0] ?? versions.value[0])
provide('selectedVersion', selectedVersion)
watch(installedVersions, (v) => {
  if (v) {
    selectedVersion.value = installedVersions.value[0]
  } else {
    selectedVersion.value = versions.value[0]
  }
})

const { t } = useI18n()
const model = computed(() => {
  const file = props.installed.find(f => f.path === selectedVersion.value?.id)

  const info = computed(() => {
    const result: Info[] = []
    if (!file || !file.size || !file.hash) return []
    result.push({
      icon: '123',
      name: t('fileDetail.fileSize'),
      value: getExpectedSize(file.size),
    }, {
      icon: 'tag',
      name: t('fileDetail.hash'),
      value: file.hash,
    })
    return result
  })

  const result: ProjectDetail = reactive({
    id: props.resourcePack.id,
    icon: props.resourcePack.icon,
    title: props.resourcePack.title,
    description: props.resourcePack.description,
    categories: [],
    externals: [],
    info,
    galleries: [],
    author: '',
    downloadCount: 0,
    follows: 0,
    url: '',
    htmlContent: '',
    modLoaders: [],
    installed: !!props.resourcePack.installed,
    enabled: true,
  })
  return result
})

const updating = useProjectDetailUpdate()

const { uninstall } = useService(InstanceResourcePacksServiceKey)
const { path } = injection(kInstance)
const onDelete = async () => {
  updating.value = true
  disable(props.installed)
  await uninstall(path.value, props.installed.map(i => i.path))
}

const { enable, disable } = injection(kInstanceResourcePacks)
const onEnable = (v: boolean) => {
  if (v) {
    enable(props.installed)
  } else {
    disable(props.installed)
  }
}

</script>
<template>
  <MarketProjectDetail
    :detail="model"
    :dependencies="[]"
    :enabled="props.installed[0].enabled"
    :has-installed-version="true"
    :selected-installed="true"
    :no-delete="isVanilla"
    :no-enabled="isUnmapped || isVanilla"
    :loading="false"
    :versions="versions"
    :updating="updating"
    :no-version="versions.length === 0"
    :has-more="false"
    :loading-versions="false"
    @enable="onEnable"
    @delete="onDelete"
  />
</template>
