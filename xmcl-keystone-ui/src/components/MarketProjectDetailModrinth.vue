<script setup lang="ts">
import MarketProjectDetail, { ProjectDependency } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion as ProjectDetailVersion } from '@/components/MarketProjectDetailVersion.vue'
import { getModrinthDependenciesModel } from '@/composables/modrinthDependencies'
import { kModrinthInstaller } from '@/composables/modrinthInstaller'
import { useModrinthProject } from '@/composables/modrinthProject'
import { useModrinthProjectDetailData, useModrinthProjectDetailVersions } from '@/composables/modrinthProjectDetailData'
import { getModrinthVersionModel, useModrinthTask } from '@/composables/modrinthVersions'
import { useProjectDetailEnable, useProjectDetailUpdate } from '@/composables/projectDetail'
import { useLoading, useSWRVModel } from '@/composables/swrv'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { injection } from '@/util/inject'
import { ProjectFile } from '@/util/search'
import { SearchResultHit } from '@xmcl/modrinth'
import { Resource } from '@xmcl/runtime-api'

const props = defineProps<{
  modrinth?: SearchResultHit
  projectId: string
  installed: ProjectFile[]
  loaders: string[]
  categories: string[]
  gameVersion: string
  allFiles: ProjectFile[]
  updating?: boolean
  curseforge?: number
}>()

const emit = defineEmits<{
  (event: 'category', cat: string): void
  (event: 'install', file: Resource[]): void
  (event: 'uninstall', files: ProjectFile[]): void
  (event: 'enable', file: ProjectFile): void
  (event: 'disable', file: ProjectFile): void
}>()

// Project
const projectId = computed(() => props.projectId)
const { project, isValidating: isValidatingModrinth, refresh } = useModrinthProject(projectId)
const model = useModrinthProjectDetailData(projectId, project, computed(() => props.modrinth))
const loading = useLoading(isValidatingModrinth, project, projectId)

// Versions
const { data: versions, isValidating: loadingVersions } = useSWRVModel(
  getModrinthVersionModel(projectId, undefined, computed(() => props.loaders), computed(() => [props.gameVersion])),
  inject(kSWRVConfig))
const modVersions = useModrinthProjectDetailVersions(versions, computed(() => props.installed))

const selectedVersion = ref(modVersions.value.find(v => v.installed) ?? modVersions.value[0] as ProjectDetailVersion | undefined)
provide('selectedVersion', selectedVersion)

const supportedVersions = computed(() => {
  if (!project.value) return []
  return project.value.game_versions
})

// Dependencies
const version = computed(() => versions.value?.find(v => v.id === selectedVersion.value?.id))
const { data: deps, isValidating, error } = useSWRVModel(getModrinthDependenciesModel(version))
const dependencies = computed(() => {
  if (!version.value) return []
  if (!deps.value) return []

  return deps.value.map(({ recommendedVersion, versions, project, type, parent }) => {
    // TODO: optimize this perf
    const file = computed(() => {
      for (const file of props.allFiles) {
        if (file.modrinth?.versionId === recommendedVersion.id) {
          return file
        }
      }
      return undefined
    })
    const otherFile = computed(() => {
      for (const file of props.allFiles) {
        if (file.modrinth?.projectId === project.id && file.modrinth?.versionId !== recommendedVersion.id) {
          return file
        }
      }
      return undefined
    })
    const task = useModrinthTask(computed(() => recommendedVersion.id))
    const dep: ProjectDependency = reactive({
      id: project.id,
      icon: project.icon_url,
      title: project.title,
      version: recommendedVersion.name,
      description: recommendedVersion.files[0].filename,
      type,
      parent: parent?.title ?? '',
      installedVersion: computed(() => file.value?.version),
      installedDifferentVersion: computed(() => otherFile.value?.version),
      progress: computed(() => task.value ? task.value.progress / task.value.total : -1),
    })
    return dep
  }) ?? []
})

const innerUpdating = useProjectDetailUpdate()
watch(() => props.modrinth, () => {
  innerUpdating.value = false
})
watch(() => props.installed, () => {
  innerUpdating.value = false
}, { deep: true })

// Install
const installing = ref(false)
const { installWithDependencies, install } = injection(kModrinthInstaller)
const onInstall = async (v: ProjectDetailVersion) => {
  const version = versions.value?.find(ver => ver.id === v.id)
  if (!version) return
  try {
    installing.value = true
    if (project.value) {
      await installWithDependencies(project.value, version, props.installed, deps.value ?? [])
    }
  } finally {
    installing.value = false
  }
}
const onInstallDependency = async (dep: ProjectDependency) => {
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
    await install(resolvedDep.project, version)
    if (files.length > 0) {
      emit('uninstall', files)
    }
  } finally {
    installing.value = false
  }
}

const { enabled, installed, hasInstalledVersion } = useProjectDetailEnable(
  selectedVersion,
  computed(() => props.installed),
  innerUpdating,
  f => emit('enable', f),
  f => emit('disable', f),
)

const onDelete = () => {
  innerUpdating.value = true
  emit('uninstall', props.installed)
}

const { push, currentRoute } = useRouter()
const onOpenDependency = (dep: ProjectDependency) => {
  push({ query: { ...currentRoute.query, id: `modrinth:${dep.id}` } })
}

const curseforgeId = computed(() => props.curseforge || props.allFiles.find(v => v.modrinth?.projectId === props.projectId && v.curseforge)?.curseforge?.projectId)

const archived = computed(() => {
  return project.value?.status === 'archived'
})
// watchEffect(() => {
//   console.log(project.value.status)
// })

</script>

<template>
  <MarketProjectDetail
    :detail="model"
    :has-more="false"
    :enabled="enabled"
    :supported-versions="supportedVersions"
    :selected-installed="installed"
    :has-installed-version="hasInstalledVersion"
    :versions="modVersions"
    :updating="innerUpdating || installing || updating"
    :loading-dependencies="isValidating"
    :dependencies="dependencies"
    :loading="loading"
    :loading-versions="loadingVersions"
    :modrinth="projectId"
    :curseforge="curseforgeId"
    current-target="modrinth"
    @open-dependency="onOpenDependency"
    @install="onInstall"
    @enable="enabled = $event"
    @delete="onDelete"
    @install-dependency="onInstallDependency"
    @select:category="emit('category', $event)"
    @refresh="refresh()"
  />
</template>
