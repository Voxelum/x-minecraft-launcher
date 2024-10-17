<script setup lang="ts">
import MarketProjectDetail, { Info, ProjectDetail } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { InstanceShaderFile, kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { useProjectDetailUpdate } from '@/composables/projectDetail'
import { ShaderPackProject } from '@/composables/shaderPackSearch'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { InstanceShaderPacksServiceKey, RuntimeVersions } from '@xmcl/runtime-api'

const props = defineProps<{
  shaderPack: ShaderPackProject
  runtime: RuntimeVersions
  installed: InstanceShaderFile[]
}>()

const versions = computed(() => {
  const files = props.shaderPack.files || []
  const all: ProjectVersion[] = files.map((f) => {
    const version: ProjectVersion = {
      id: f.path,
      name: f.fileName,
      version: f.fileName,
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

const { path } = injection(kInstance)
const { shaderPack: selectedShaderPack } = injection(kInstanceShaderPacks)
const { uninstall } = useService(InstanceShaderPacksServiceKey)
const onDelete = async () => {
  updating.value = true
  await uninstall(path.value, props.installed.map(i => basename(i.path)))
}

const onEnable = (v: boolean) => {
  const file = props.installed.find(f => f.path === selectedVersion.value?.id)
  emit('enable', v ? file?.fileName : '')
}

const enabled = computed(() => props.installed[0].fileName === selectedShaderPack.value)

const emit = defineEmits(['enable'])

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
