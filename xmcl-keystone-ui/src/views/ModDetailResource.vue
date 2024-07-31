<script setup lang="ts">
import MarketProjectDetail, { ExternalResource, Info, ProjectDetail } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { useProjectDetailEnable, useProjectDetailUpdate } from '@/composables/projectDetail'
import { clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { useInstanceModLoaderDefault } from '@/composables/instanceModLoaderDefault'
import { isNoModLoader } from '@/util/isNoModloader'
import { ModFile } from '@/util/mod'
import { ProjectEntry } from '@/util/search'
import { getExpectedSize } from '@/util/size'
import { InstanceModsServiceKey, ResourceServiceKey, RuntimeVersions } from '@xmcl/runtime-api'

const props = defineProps<{
  mod: ProjectEntry<ModFile>
  files: ModFile[]
  runtime: RuntimeVersions
  installed: ModFile[]
}>()

const versions = computed(() => {
  const files = props.files
  const all: ProjectVersion[] = files.map((f) => {
    const version: ProjectVersion = {
      id: f.path,
      name: f.resource.fileName,
      version: f.version,
      downloadCount: 0,
      installed: true,
      loaders: f.modLoaders,
      minecraftVersion: f.dependencies.find((d) => d.modId === 'minecraft')?.semanticVersion as string,
      type: 'release',
      disabled: false,
    }
    return version
  })
  return all
})

const installedVersions = computed(() => {
  const ver = props.mod.installed.map(v => versions.value.find(f => f.id === v.modId)).filter((v): v is ProjectVersion => !!v)
  return ver
})
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
  const file = props.files.find(f => f.path === selectedVersion.value?.id)

  const externals = computed(() => {
    const file = props.files.find(f => f.path === selectedVersion.value?.id)
    const result: ExternalResource[] = []
    if (file?.links.home) {
      result.push({
        icon: 'mdi-home',
        name: 'Home',
        url: file.links.home,
      })
    }
    if (file?.links.issues) {
      result.push({
        icon: 'mdi-bug',
        name: 'Issues',
        url: file.links.issues,
      })
    }
    if (file?.links.source) {
      result.push({
        icon: 'mdi-source-repository',
        name: 'Source',
        url: file.links.source,
      })
    }
    if (file?.links.update) {
      result.push({
        icon: 'mdi-file-document',
        name: 'Javadoc',
        url: file.links.update,
      })
    }

    return result
  })

  const info = computed(() => {
    const result: Info[] = []
    if (!file) return []
    if (file.license) {
      result.push({ icon: 'description', name: t('modrinth.license'), value: file.license.name, url: file.license.url })
    }
    const resource = file.resource
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
    id: props.mod.id,
    icon: props.mod.icon,
    title: props.mod.title,
    description: props.mod.description,
    categories: [],
    externals: externals.value,
    info,
    galleries: [],
    author: computed(() => file?.authors.join(', ') ?? ''),
    downloadCount: 0,
    follows: 0,
    url: computed(() => file?.links.home ?? ''),
    htmlContent: props.mod.description,
    installed: !!props.mod.installed,
    modLoaders: [],
    enabled: computed(() => file?.enabled ?? false),
  })
  return result
})

const updating = useProjectDetailUpdate()
const { install, uninstall, enable, disable } = useService(InstanceModsServiceKey)
const { enabled, installed, hasInstalledVersion } = useProjectDetailEnable(
  selectedVersion,
  computed(() => props.installed),
  updating,
  (f) => enable({ path: path.value, mods: [f.resource] }),
  (f) => disable({ path: path.value, mods: [f.resource] }),
)
const { path } = injection(kInstance)

const { updateResources } = useService(ResourceServiceKey)
watch(() => props.mod, async () => {
  updating.value = false

  const versions = await clientModrinthV2.getProjectVersionsByHash(props.files.map(f => f.hash), 'sha1')

  const options = Object.entries(versions).map(([hash, version]) => {
    const f = props.files.find(f => f.hash === hash)
    if (f) return { hash: f.hash, metadata: { modrinth: { projectId: version.project_id, versionId: version.id } } }
    return undefined
  }).filter((v): v is any => !!v)
  updateResources(options)
})

const installDefaultModLoader = useInstanceModLoaderDefault()
const onDelete = async () => {
  updating.value = true
  const file = props.files.find(f => f.path === selectedVersion.value.id)
  if (file) {
    await uninstall({ path: path.value, mods: [file.resource] })
  }
}

const onInstall = async () => {
  updating.value = true

  const _path = path.value
  const runtime = props.runtime
  const file = props.files.find(f => f.path === selectedVersion.value.id)
  if (file) {
    if (isNoModLoader(props.runtime)) {
      // forge, fabric, quilt or neoforge
      await installDefaultModLoader(_path, runtime, file.modLoaders)
    }

    await install({ path: _path, mods: [file.resource] })
  }
}

</script>
<template>
  <MarketProjectDetail
    :detail="model"
    :dependencies="[]"
    :enabled="enabled"
    :has-installed-version="hasInstalledVersion"
    :selected-installed="installed"
    :loading="false"
    :versions="versions"
    :updating="updating"
    :has-more="false"
    :loading-versions="false"
    @install="onInstall"
    @delete="onDelete"
    @enable="enabled = $event"
  />
</template>
