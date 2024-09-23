<script setup lang="ts">
import MarketProjectDetail, { Info, ProjectDetail } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import { useService } from '@/composables'
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { useProjectDetailUpdate } from '@/composables/projectDetail'
import { ShaderPackProject } from '@/composables/shaderPackSearch'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { Resource, ResourceServiceKey, RuntimeVersions } from '@xmcl/runtime-api'

const props = defineProps<{
  shaderPack: ShaderPackProject
  runtime: RuntimeVersions
  installed: Resource[]
}>()

const versions = computed(() => {
  const files = props.shaderPack.files || []
  const all: ProjectVersion[] = files.map((f) => {
    const version: ProjectVersion = {
      id: f.path,
      name: f.resource.fileName,
      version: f.resource.fileName,
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
    if (!file) return []
    const resource = file
    result.push({
      icon: '123',
      name: t('fileDetail.fileSize'),
      value: getExpectedSize(resource.size),
    }, {
      icon: 'tag',
      name: t('fileDetail.hash'),
      value: resource.hash,
    })
    return result
  })

  const result: ProjectDetail = reactive({
    id: props.shaderPack.id,
    icon: props.shaderPack.icon,
    title: props.shaderPack.title,
    description: props.shaderPack.description,
    categories: [],
    externals: [],
    info,
    galleries: [],
    author: '',
    downloadCount: 0,
    follows: 0,
    url: '',
    htmlContent: props.shaderPack.description,
    installed: !!props.shaderPack.installed,
    modLoaders: [],
    enabled: true,
  })
  return result
})

const updating = useProjectDetailUpdate()

const { shaderPack: selectedShaderPack } = injection(kInstanceShaderPacks)
const { removeResources } = useService(ResourceServiceKey)
const onDelete = async () => {
  updating.value = true
  await removeResources(props.installed.map(i => i.hash))
}

const onEnable = (v: boolean) => {
  const file = props.installed.find(f => f.path === selectedVersion.value?.id)
  selectedShaderPack.value = v ? file?.fileName : ''
}

const enabled = computed(() => props.installed[0].fileName === selectedShaderPack.value)
watch(selectedShaderPack, (v) => {
  console.log(v)
})

</script>
<template>
  <MarketProjectDetail
    :detail="model"
    :dependencies="[]"
    :enabled="enabled"
    :has-installed-version="true"
    :selected-installed="true"
    :loading="false"
    :versions="versions"
    :updating="updating"
    :has-more="false"
    :loading-versions="false"
    @enable="onEnable"
    @delete="onDelete"
  />
</template>
