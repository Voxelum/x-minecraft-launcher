<script setup lang="ts">
import MarketProjectDetail, { ProjectDependency } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion as ProjectDetailVersion } from '@/components/MarketProjectDetailVersion.vue'
import { useInCollection, useModrinthFollow } from '@/composables/modrinthAuthenticatedAPI'
import { getModrinthDependenciesModel } from '@/composables/modrinthDependencies'
import { kModrinthInstaller } from '@/composables/modrinthInstaller'
import { useModrinthProject } from '@/composables/modrinthProject'
import { useModrinthProjectDetailData, useModrinthProjectDetailVersions } from '@/composables/modrinthProjectDetailData'
import { getModrinthVersionModel, useModrinthTask } from '@/composables/modrinthVersions'
import { useProjectDetailEnable, useProjectDetailUpdate } from '@/composables/projectDetail'
import { useService } from '@/composables/service'
import { useLoading, useSWRVModel } from '@/composables/swrv'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { injection } from '@/util/inject'
import { ProjectFile } from '@/util/search'
import { SearchResultHit } from '@xmcl/modrinth'
import { ProjectMapping, ProjectMappingServiceKey } from '@xmcl/runtime-api'
import Hint from './Hint.vue'

const props = defineProps<{
  modrinth?: SearchResultHit
  projectId: string
  installed: ProjectFile[]
  loader?: string
  categories: string[]
  gameVersion: string
  allFiles: ProjectFile[]
  updating?: boolean
  curseforge?: number
}>()

const emit = defineEmits<{
  (event: 'category', cat: string): void
  (event: 'uninstall', files: ProjectFile[]): void
  (event: 'enable', file: ProjectFile): void
  (event: 'disable', file: ProjectFile): void
}>()

// Project
const projectId = computed(() => props.projectId)
const { project, isValidating: isValidatingModrinth, refresh, error } = useModrinthProject(projectId)
const { lookupByModrinth } = useService(ProjectMappingServiceKey)

const mapping = shallowRef(undefined as ProjectMapping | undefined)

watch(projectId, async (id) => {
  const result = await lookupByModrinth(id).catch(() => undefined)
  if (id === projectId.value) {
    mapping.value = result
  }
}, { immediate: true })

const model = useModrinthProjectDetailData(projectId, project, computed(() => props.modrinth), mapping)
const loading = useLoading(isValidatingModrinth, project, projectId)
const modLoader = computed(() => props.loader)

// Versions
const { data: versions, isValidating: loadingVersions } = useSWRVModel(
  getModrinthVersionModel(projectId, undefined, modLoader, computed(() => props.gameVersion ? [props.gameVersion] : undefined)),
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
const { data: deps, isValidating } = useSWRVModel(getModrinthDependenciesModel(version, modLoader), { revalidateOnFocus: false })
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
const { install, installWithDependencies } = injection(kModrinthInstaller)
const onInstall = async (v: ProjectDetailVersion) => {
  try {
    installing.value = true
    await installWithDependencies(v.id, v.loaders, project.value?.icon_url, props.installed, deps.value ?? [])
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
    await install({ versionId: version.id, icon: resolvedDep.project.icon_url })
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

const curseforgeId = computed(() => props.curseforge ||
  props.allFiles.find(v => v.modrinth?.projectId === props.projectId && v.curseforge)?.curseforge?.projectId ||
  mapping.value?.curseforgeId)

const isNotFound = computed(() => error.value?.status === 404)
const { replace } = useRouter()
const goCurseforgeProject = (id: number) => {
  replace({ query: { ...currentRoute.query, id: `curseforge:${id}` } })
}

const { isFollowed, following, onFollow } = useModrinthFollow(projectId)
const { collectionId, onAddOrRemove, loadingCollections } = useInCollection(projectId)

const { t } = useI18n()
</script>

<template>
  <Hint
    v-if="isNotFound"
    icon="warning"
    color="red"
    class="px-10"
    :size="100"
    :text="t('errors.NotFoundError')"
  >
    <div>
      <v-btn color="primary" text v-if="curseforgeId" @click="goCurseforgeProject(curseforgeId)">
        <v-icon left>$vuetify.icons.curseforge</v-icon>
        Curseforge
      </v-btn>
    </div>
  </Hint>
  <MarketProjectDetail
    v-else
    :detail="model"
    :has-more="false"
    :enabled="enabled"
    :error="error"
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
    :followed="isFollowed"
    :following="following"
    :collection="collectionId"
    :loading-collections="loadingCollections"
    @collection="onAddOrRemove"
    current-target="modrinth"
    @open-dependency="onOpenDependency"
    @install="onInstall"
    @enable="enabled = $event"
    @delete="onDelete"
    @install-dependency="onInstallDependency"
    @select:category="emit('category', $event)"
    @refresh="refresh()"
    @follow="onFollow"
  />
</template>
