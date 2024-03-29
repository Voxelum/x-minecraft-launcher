<script setup lang="ts">
import MarketProjectDetail, { CategoryItem, ExternalResource, Info, ModGallery, ProjectDependency, ProjectDetail } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import { getCurseforgeProjectDescriptionModel, getCurseforgeProjectModel, useCurseforgeCategoryI18n, useCurseforgeProjectFiles } from '@/composables/curseforge'
import { useCurseforgeChangelog } from '@/composables/curseforgeChangelog'
import { getCurseforgeDependenciesModel, useCurseforgeTask } from '@/composables/curseforgeDependencies'
import { kCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useDateString } from '@/composables/date'
import { useModDetailEnable, useModDetailUpdate } from '@/composables/modDetail'
import { useSWRVModel } from '@/composables/swrv'
import { getCurseforgeFileGameVersions, getCurseforgeModLoaderTypeFromRuntime, getCurseforgeRelationType, getCursforgeFileModLoaders } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { ProjectFile } from '@/util/search'
import { Mod } from '@xmcl/curseforge'
import { Resource, RuntimeVersions } from '@xmcl/runtime-api'

const props = defineProps<{
  curseforge?: Mod
  curseforgeId: number
  installed: ProjectFile[]
  runtime: RuntimeVersions
  loaders: string[]
  allFiles: ProjectFile[]
  category?: number
  updating?: boolean
  modrinth?: string
}>()

const emit = defineEmits<{
  (event: 'category', cat: number): void
  (event: 'install', file: Resource[]): void
  (event: 'uninstall', files: ProjectFile[]): void
  (event: 'enable', file: ProjectFile): void
  (event: 'disable', file: ProjectFile): void
}>()

const { getDateString } = useDateString()

const cursforgeModId = computed(() => props.curseforgeId)

const { data: curseforgeProject, mutate } = useSWRVModel(getCurseforgeProjectModel(cursforgeModId))
const curseforgeMod = computed(() => {
  if (props.curseforge) return props.curseforge
  if (curseforgeProject.value) return curseforgeProject.value
  return undefined
})
const { data: description, isValidating: loadings } = useSWRVModel(getCurseforgeProjectDescriptionModel(cursforgeModId))
const model = computed(() => {
  const externals: ExternalResource[] = []
  const mod = curseforgeMod.value
  if (mod?.links.issuesUrl) {
    externals.push({
      icon: 'pest_control',
      name: t('modrinth.issueUrl'),
      url: mod.links.issuesUrl,
    })
  }
  if (mod?.links.websiteUrl) {
    externals.push({
      icon: 'web',
      name: 'Website',
      url: mod.links.websiteUrl,
    })
  }
  if (mod?.links.sourceUrl) {
    externals.push({
      icon: 'code',
      name: t('modrinth.sourceUrl'),
      url: mod.links.sourceUrl,
    })
  }
  if (mod?.links.wikiUrl) {
    externals.push({
      icon: 'public',
      name: t('modrinth.wikiUrl'),
      url: mod.links.wikiUrl,
    })
  }
  const categories: CategoryItem[] = mod?.categories.map(c => reactive({
    id: c.id.toString(),
    name: computed(() => tCategory(c.name)),
    iconUrl: c.iconUrl,
  })) || []
  const info: Info[] = []
  if (mod?.dateCreated) {
    info.push({
      name: t('curseforge.createdDate'),
      icon: 'event_available',
      value: getDateString(mod.dateCreated),
    })
  }
  if (mod?.dateModified) {
    info.push({
      name: t('curseforge.lastUpdate'),
      icon: 'edit_calendar',
      value: getDateString(mod.dateModified),
    })
  }
  if (mod?.dateReleased) {
    info.push({
      name: t('curseforge.releasedDate'),
      icon: 'calendar_month',
      value: getDateString(mod.dateReleased),
    })
  }
  if (mod?.slug) {
    info.push({
      name: 'Slug',
      icon: 'link',
      value: mod.slug,
    })
  }
  const galleries: ModGallery[] = []
  if (mod?.screenshots) {
    for (const image of mod.screenshots) {
      galleries.push({
        title: image.title,
        description: image.description,
        url: image.url,
      })
    }
  }
  const detail: ProjectDetail = {
    id: props.curseforgeId.toString(),
    title: mod?.name ?? '',
    icon: mod?.logo.url ?? '',
    description: mod?.summary ?? '',
    author: mod?.authors.map((a) => a.name).join(', ') ?? '',
    downloadCount: mod?.downloadCount ?? 0,
    follows: mod?.thumbsUpCount ?? 0,
    url: mod?.links.websiteUrl ?? '',
    categories,
    htmlContent: description.value ?? '',
    externals,
    galleries,
    info,
  }
  return detail
})

const { t } = useI18n()
const tCategory = useCurseforgeCategoryI18n()
const releaseTypes: Record<string, 'release' | 'beta' | 'alpha'> = {
  1: 'release',
  2: 'beta',
  3: 'alpha',
}

const { files, refreshing: loadingVersions, index, totalCount, pageSize } = useCurseforgeProjectFiles(cursforgeModId,
  computed(() => props.runtime.minecraft),
  computed(() => undefined))

const modId = ref(0)
const fileId = ref(undefined as number | undefined)
const { changelog, isValidating } = useCurseforgeChangelog(modId, fileId)

const modVersions = computed(() => {
  const versions: ProjectVersion[] = []
  const installed = [...props.installed]
  for (const file of files.value) {
    if (props.loaders.length > 0) {
      const loaders = getCursforgeFileModLoaders(file)
      if (!loaders.some(l => props.loaders.indexOf(l.toLowerCase() as any) !== -1)) {
        continue
      }
    }
    const installedFileIndex = installed.findIndex(f => f.curseforge?.fileId === file.id)
    const f = installedFileIndex === -1 ? undefined : installed.splice(installedFileIndex, 1)

    versions.push(reactive({
      id: file.id.toString(),
      name: file.displayName,
      version: file.fileName,
      disabled: false,
      changelog: computed(() => file.id === fileId.value ? changelog.value : undefined),
      changelogLoading: isValidating,
      type: releaseTypes[file.releaseType],
      installed: !!f,
      downloadCount: file.downloadCount,
      loaders: getCursforgeFileModLoaders(file),
      minecraftVersion: getCurseforgeFileGameVersions(file).join(', '),
      createdDate: file.fileDate,
    }))
  }

  for (const i of installed) {
    const mcDep = 'dependencies' in i ? (i as ModFile).dependencies.find(d => d.modId === 'minecraft') : undefined
    versions.push({
      id: i.curseforge?.fileId.toString() ?? '',
      name: i.resource.name ?? '',
      version: i.version,
      disabled: false,
      changelog: undefined,
      changelogLoading: false,
      type: 'release',
      installed: true,
      downloadCount: 0,
      loaders: (i as ModFile).modLoaders,
      minecraftVersion: (mcDep?.semanticVersion instanceof Array ? mcDep.semanticVersion.join(' ') : mcDep?.semanticVersion) ?? mcDep?.versionRange ?? '',
      createdDate: '',
    })
  }

  return versions
})

const loadChangelog = (version: ProjectVersion) => {
  modId.value = props.curseforgeId
  fileId.value = Number(version.id)
}

const onLoadMore = () => {
  index.value += pageSize.value
}

const selectedVersion = ref(modVersions.value.find(v => v.installed) ?? modVersions.value[0] as ProjectVersion | undefined)
provide('selectedVersion', selectedVersion)

const innerUpdating = useModDetailUpdate()

watch(() => props.curseforge, () => {
  innerUpdating.value = false
})
watch(() => props.installed, () => {
  innerUpdating.value = false
}, { deep: true })

const { enabled, installed, hasInstalledVersion } = useModDetailEnable(
  selectedVersion,
  computed(() => props.installed),
  innerUpdating,
  (f) => emit('enable', f),
  (f) => emit('disable', f),
)

const { data: deps, error, isValidating: loadingDependencies } = useSWRVModel(
  getCurseforgeDependenciesModel(
    computed(() => files.value.find(f => f.modId === props.curseforgeId)),
    computed(() => props.runtime.minecraft),
    computed(() => getCurseforgeModLoaderTypeFromRuntime(props.runtime)),
  ),
)

const dependencies = computed(() => deps.value?.map((resolvedDep) => {
  const task = useCurseforgeTask(computed(() => resolvedDep.file.id))
  const file = computed(() => {
    for (const file of props.allFiles) {
      if (file.curseforge?.fileId === resolvedDep.file.id) {
        return file
      }
    }
    return undefined
  })
  const otherFile = computed(() => {
    for (const file of props.allFiles) {
      if (file.curseforge?.projectId === resolvedDep.project.id && file.curseforge?.fileId !== resolvedDep.file.id) {
        return file
      }
    }
    return undefined
  })
  const dep: ProjectDependency = reactive({
    id: resolvedDep.project.id.toString(),
    icon: resolvedDep.project.logo?.url,
    title: resolvedDep.project.name,
    version: resolvedDep.file.displayName,
    description: resolvedDep.file.fileName,
    type: getCurseforgeRelationType(resolvedDep.type),
    installedVersion: computed(() => file.value?.version),
    installedDifferentVersion: computed(() => otherFile.value?.version),
    progress: computed(() => task.value ? task.value.progress / task.value.total : -1),
  })
  return dep
}) ?? [])

const installing = ref(false)

const { install, installWithDependencies } = injection(kCurseforgeInstaller)

const onInstall = async (mod: ProjectVersion) => {
  const file = files.value.find(v => v.id.toString() === mod.id)
  if (!file) return
  try {
    installing.value = true
    if (curseforgeProject.value) {
      await installWithDependencies(curseforgeProject.value, file, props.installed, deps.value ?? [])
    }
  } finally {
    installing.value = false
  }
}
const installDependency = async (dep: ProjectDependency) => {
  const d = deps.value?.find(d => d.project.id.toString() === dep.id)
  if (!d) return
  const ver = d.file
  try {
    installing.value = true
    const resources = [] as ProjectFile[]
    if (dep.installedDifferentVersion) {
      for (const file of props.allFiles) {
        if (file.curseforge?.fileId === d.project.id) {
          resources.push(file)
        }
      }
    }
    await install(ver, dep.icon)
    if (resources.length > 0) {
      emit('uninstall', resources)
    }
  } finally {
    installing.value = false
  }
}

const onDelete = async () => {
  innerUpdating.value = true
  emit('uninstall', props.installed)
}

const { push, currentRoute } = useRouter()
const onOpenDependency = (dep: ProjectDependency) => {
  push({ query: { ...currentRoute.query, id: `curseforge:${dep.id}` } })
}

const onRefresh = () => {
  mutate()
}
</script>
<template>
  <MarketProjectDetail
    :detail="model"
    :enabled="enabled"
    :selected-installed="installed"
    :dependencies="dependencies"
    :has-installed-version="hasInstalledVersion"
    :loading="loadings"
    :has-more="files.length < totalCount"
    :loading-versions="loadingVersions"
    :updating="innerUpdating || updating || installing"
    :versions="modVersions"
    :curseforge="curseforgeId"
    :modrinth="modrinth"
    :loading-dependencies="loadingDependencies"
    @load-changelog="loadChangelog"
    @delete="onDelete"
    @enable="enabled = $event"
    @load-more="onLoadMore"
    @open-dependency="onOpenDependency"
    @install="onInstall"
    @install-dependency="installDependency"
    @select:category="emit('category', Number($event))"
    @refresh="onRefresh"
  />
</template>
