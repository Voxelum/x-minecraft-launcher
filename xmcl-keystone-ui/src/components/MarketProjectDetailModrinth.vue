<script setup lang="ts">
import MarketProjectDetail, { ProjectDependency } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion as ProjectDetailVersion } from '@/components/MarketProjectDetailVersion.vue'
import { useService } from '@/composables'
import { kImageDialog } from '@/composables/imageDialog'
import { kInstance } from '@/composables/instance'
import { useModDetailEnable, useModDetailUpdate } from '@/composables/modDetail'
import { useModrinthDependencies } from '@/composables/modrinthDependencies'
import { useModrinthProject } from '@/composables/modrinthProject'
import { useModrinthProjectDetailData, useModrinthProjectDetailVersions } from '@/composables/modrinthProjectDetailData'
import { useModrinthTask, useModrinthVersions, useModrinthVersionsResources } from '@/composables/modrinthVersions'
import { injection } from '@/util/inject'
import { useInstanceModLoaderDefault } from '@/util/instanceModLoaderDefault'
import { isNoModLoader } from '@/util/isNoModloader'
import { ProjectFile } from '@/util/search'
import { ProjectVersion, SearchResultHit } from '@xmcl/modrinth'
import { ModrinthServiceKey, Resource, RuntimeVersions } from '@xmcl/runtime-api'

const props = defineProps<{
  modrinth?: SearchResultHit
  projectId: string
  installed: ProjectFile[]
  loaders: string[]
  categories: string[]
  runtime: RuntimeVersions
  allFiles: ProjectFile[]
  updating?: boolean
  curseforge?: number
}>()

const projectId = computed(() => props.projectId)
const { project, refreshing: loading } = useModrinthProject(projectId)

const emit = defineEmits<{
  (event: 'category', cat: string): void
  (event: 'install', file: Resource[]): void
  (event: 'uninstall', files: ProjectFile[]): void
  (event: 'enable', file: ProjectFile): void
  (event: 'disable', file: ProjectFile): void
}>()

const { versions, refreshing: loadingVersions } = useModrinthVersions(projectId,
  undefined,
  computed(() => props.loaders),
  computed(() => [props.runtime.minecraft]))

const model = useModrinthProjectDetailData(projectId, project, computed(() => props.modrinth))
const modVersions = useModrinthProjectDetailVersions(versions, computed(() => props.installed))

const imageDialog = injection(kImageDialog)

const selectedVersion = ref(modVersions.value[0] as ProjectDetailVersion | undefined)
provide('selectedVersion', selectedVersion)

const { data: deps, isValidating, error } = useModrinthDependencies(computed(() => versions.value.find(v => v.id === selectedVersion.value?.id)))
const dependencies = computed(() => {
  if (!deps.value) return []

  return deps.value.map(({ recommendedVersion, versions, project, type }) => {
    // TODO: optimize this perf
    const file = computed(() => {
      for (const file of props.allFiles) {
        if (file.modrinth?.versionId === recommendedVersion.id) {
          return file
        }
      }
    })
    const otherFile = computed(() => {
      for (const file of props.allFiles) {
        if (file.modrinth?.projectId === project.id && file.modrinth?.versionId !== recommendedVersion.id) {
          return file
        }
      }
    })
    const task = useModrinthTask(computed(() => recommendedVersion.id))
    const dep: ProjectDependency = reactive({
      id: project.id,
      icon: project.icon_url,
      title: project.title,
      version: recommendedVersion.name,
      description: recommendedVersion.files[0].filename,
      type,
      installedVersion: computed(() => file.value?.version),
      installedDifferentVersion: computed(() => otherFile.value?.version),
      progress: computed(() => task.value ? task.value.progress / task.value.total : -1),
    })
    return dep
  }) ?? []
})

const { path } = injection(kInstance)
const { installVersion } = useService(ModrinthServiceKey)
const { getResource } = useModrinthVersionsResources(versions)
const installModrinthVersion = async (v: ProjectVersion) => {
  const resource = getResource(v)
  if (resource) {
    emit('install', [resource])
  } else {
    const { resources } = await installVersion({ version: v, icon: project.value?.icon_url })
    emit('install', resources)
  }
}

const innerUpdating = useModDetailUpdate()
watch(() => props.modrinth, () => {
  innerUpdating.value = false
})

const installDefaultModLoader = useInstanceModLoaderDefault(path, computed(() => props.runtime))

const installing = ref(false)
const install = async (version: ProjectDetailVersion) => {
  const v = versions.value.find(v => v.id === version.id)
  if (!v) return
  try {
    installing.value = true
    if (isNoModLoader(props.runtime)) {
      // forge, fabric, quilt or neoforge
      await installDefaultModLoader(v.loaders)
    }
    const resources = [...props.installed]
    await Promise.all(deps.value
      ?.filter((v) => v.type === 'required')
      .filter(v => props.allFiles.every(m => m.modrinth?.projectId !== v.project.id))
      .map((v) => installModrinthVersion(v.recommendedVersion)) ?? [])
    await installModrinthVersion(v)
    if (hasInstalledVersion.value) {
      emit('uninstall', resources)
    }
  } finally {
    installing.value = false
  }
}
const installDependency = async (dep: ProjectDependency) => {
  const resolvedDep = deps.value?.find(d => d.project.id === dep.id)
  if (!resolvedDep) return
  const version = resolvedDep.recommendedVersion
  try {
    installing.value = true
    const files = [] as ProjectFile[]
    if (dep.installedDifferentVersion) {
      for (const file of props.allFiles) {
        if (file.modrinth?.projectId === resolvedDep.project.id) {
          files.push(file)
        }
      }
    }
    await installModrinthVersion(version)
    if (files.length > 0) {
      emit('uninstall', files)
    }
  } finally {
    installing.value = false
  }
}

const { enabled, installed, hasInstalledVersion } = useModDetailEnable(
  selectedVersion,
  computed(() => props.installed),
  innerUpdating,
  f => emit('enable', f),
  f => emit('disable', f),
)

const onDelete = async () => {
  innerUpdating.value = true
  emit('uninstall', props.installed)
}

const { push, currentRoute } = useRouter()
const onOpenDependency = (dep: ProjectDependency) => {
  push({ query: { ...currentRoute.query, id: `modrinth:${dep.id}` } })
}

</script>

<template>
  <MarketProjectDetail
    :detail="model"
    :has-more="false"
    :enabled="enabled"
    :selected-installed="installed"
    :has-installed-version="hasInstalledVersion"
    :versions="modVersions"
    :updating="innerUpdating || installing || updating"
    :loading-dependencies="isValidating"
    :dependencies="dependencies"
    :loading="loading"
    :loading-versions="loadingVersions"
    :modrinth="projectId"
    :curseforge="curseforge"
    @open-dependency="onOpenDependency"
    @show-image="imageDialog.show($event.url, { description: $event.description, date: $event.date })"
    @install="install"
    @enable="enabled = $event"
    @delete="onDelete"
    @install-dependency="installDependency"
    @select:category="emit('category', $event)"
  />
</template>
