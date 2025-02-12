<script setup lang="ts">
import MarketProjectDetail, { CategoryItem, ExternalResource, Info, ModGallery, ProjectDependency, ProjectDetail } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import { getCurseforgeProjectDescriptionModel, getCurseforgeProjectModel, useCurseforgeCategoryI18n, useCurseforgeProjectFiles } from '@/composables/curseforge'
import { useCurseforgeChangelog } from '@/composables/curseforgeChangelog'
import { getCurseforgeDependenciesModel, useCurseforgeTask } from '@/composables/curseforgeDependencies'
import { kCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useDateString } from '@/composables/date'
import { useI18nSearchFlights } from '@/composables/flights'
import { useAutoI18nCommunityContent } from '@/composables/i18n'
import { useProjectDetailEnable, useProjectDetailUpdate } from '@/composables/projectDetail'
import { useService } from '@/composables/service'
import { useLoading, useSWRVModel } from '@/composables/swrv'
import { basename } from '@/util/basename'
import { getCurseforgeFileGameVersions, getCurseforgeRelationType, getCursforgeFileModLoaders, getCursforgeModLoadersFromString, getModLoaderTypesForFile } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { ProjectFile } from '@/util/search'
import { FileModLoaderType, Mod, ModStatus } from '@xmcl/curseforge'
import { ProjectMapping, ProjectMappingServiceKey } from '@xmcl/runtime-api'

const props = defineProps<{
  curseforge?: Mod
  curseforgeId: number
  installed: ProjectFile[]
  gameVersion: string
  loader?: string
  allFiles: ProjectFile[]
  category?: number
  updating?: boolean
  modrinth?: string
}>()

const emit = defineEmits<{
  (event: 'category', cat: number): void
  (event: 'uninstall', files: ProjectFile[]): void
  (event: 'enable', file: ProjectFile): void
  (event: 'disable', file: ProjectFile): void
}>()

const { getDateString } = useDateString()

const curseforgeModId = computed(() => props.curseforgeId)

const { data: curseforgeProject, mutate } = useSWRVModel(getCurseforgeProjectModel(curseforgeModId))
const { lookupByCurseforge } = useService(ProjectMappingServiceKey)

const curseforgeProjectMapping = shallowRef(undefined as ProjectMapping | undefined)

watch(curseforgeModId, async (id) => {
  const result = await lookupByCurseforge(id).catch(() => undefined)
  if (id === curseforgeModId.value) {
    curseforgeProjectMapping.value = result
  }
}, { immediate: true })

const { data: description, isValidating: isValidatingDescription } = useSWRVModel(getCurseforgeProjectDescriptionModel(curseforgeModId))

const i18nSearch = useI18nSearchFlights()

const localizedBody = ref('')

if (i18nSearch) {
  const { getContent } = useAutoI18nCommunityContent(i18nSearch)
  watch(curseforgeModId, async (id) => {
    localizedBody.value = ''
    const result = await getContent('curseforge', id)
    if (id === curseforgeModId.value) {
      localizedBody.value = result
    }
  }, { immediate: true })
}

const model = computed(() => {
  const externals: ExternalResource[] = []
  const mod = props.curseforge || curseforgeProject.value

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
        rawUrl: image.url,
        url: image.thumbnailUrl,
      })
    }
  }
  const mapping = {
    [FileModLoaderType.Forge]: 'forge',
    [FileModLoaderType.Fabric]: 'fabric',
    [FileModLoaderType.Quilt]: 'quilt',
    [FileModLoaderType.NeoForge]: 'neoforge',
  } as Record<FileModLoaderType, string>
  const modLoaders = [...new Set(mod?.latestFilesIndexes.map(v => mapping[v.modLoader]) || [])]
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
    modLoaders,
    externals,
    galleries,
    info,
    archived: ModStatus.Inactive === mod?.status || ModStatus.Abandoned === mod?.status,
  }

  if (curseforgeProjectMapping.value && curseforgeProjectMapping.value.curseforgeId === curseforgeModId.value) {
    const mapped = curseforgeProjectMapping.value
    detail.localizedTitle = mapped.name
    detail.localizedDescription = mapped.description
  }

  if (localizedBody.value) {
    detail.localizedHtmlContent = localizedBody.value
  }

  return detail
})

const loading = useLoading(isValidatingDescription, description, curseforgeModId)

const { t } = useI18n()
const tCategory = useCurseforgeCategoryI18n()
const releaseTypes: Record<string, 'release' | 'beta' | 'alpha'> = {
  1: 'release',
  2: 'beta',
  3: 'alpha',
}

const { files, refreshing: loadingVersions, index, totalCount, pageSize } = useCurseforgeProjectFiles(curseforgeModId,
  computed(() => props.gameVersion),
  computed(() => getCursforgeModLoadersFromString(props.loader)[0]))

const modId = ref(0)
const fileId = ref(undefined as number | undefined)
const { changelog, isValidating } = useCurseforgeChangelog(modId, fileId)

const modVersions = computed(() => {
  const versions: ProjectVersion[] = []
  const installed = [...props.installed]
  for (const file of files.value) {
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
      name: basename(i.path) ?? '',
      version: i.version,
      disabled: false,
      changelog: undefined,
      changelogLoading: false,
      type: 'release',
      installed: true,
      downloadCount: 0,
      loaders: 'modLoaders' in i ? (i as ModFile).modLoaders : [],
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

const innerUpdating = useProjectDetailUpdate()

watch(() => props.curseforge, () => {
  innerUpdating.value = false
})
watch(() => props.installed, () => {
  innerUpdating.value = false
}, { deep: true })

const { enabled, installed, hasInstalledVersion } = useProjectDetailEnable(
  selectedVersion,
  computed(() => props.installed),
  innerUpdating,
  (f) => emit('enable', f),
  (f) => emit('disable', f),
)

const curseforgeFile = computed(() => files.value.find(f => f.id === Number(selectedVersion.value?.id)))
const { data: deps, error, isValidating: loadingDependencies } = useSWRVModel(
  getCurseforgeDependenciesModel(
    curseforgeFile,
    computed(() => props.gameVersion),
    // TODO: limit the modloaders
    computed(() => curseforgeFile.value ? getModLoaderTypesForFile(curseforgeFile.value).values().next().value! : FileModLoaderType.Any),
  ),
)

const dependencies = computed(() => !curseforgeFile.value
  ? []
  : deps.value?.map((resolvedDep) => {
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
      parent: resolvedDep.parent?.name ?? '',
      installedVersion: computed(() => file.value?.version),
      installedDifferentVersion: computed(() => otherFile.value?.version),
      progress: computed(() => task.value ? task.value.progress / task.value.total : -1),
    })
    return dep
  }) ?? [])

const installing = ref(false)

const { install, installWithDependencies } = injection(kCurseforgeInstaller)

const onInstall = async (mod: ProjectVersion) => {
  try {
    installing.value = true
    await installWithDependencies(Number(mod.id), mod.loaders, curseforgeProject.value?.logo.url, props.installed, deps.value ?? [])
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
    await install({ fileId: ver.id, icon: dep.icon })
    if (resources.length > 0) {
      emit('uninstall', resources)
    }
  } finally {
    installing.value = false
  }
}

const onDelete = () => {
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

const modrinthId = computed(() => props.modrinth || props.allFiles.find(v => v.curseforge?.projectId === props.curseforgeId && v.modrinth)?.modrinth?.projectId || curseforgeProjectMapping.value?.modrinthId)
</script>
<template>
  <MarketProjectDetail
    :detail="model"
    :enabled="enabled"
    :selected-installed="installed"
    :dependencies="dependencies"
    :supported-versions="curseforgeProject?.latestFilesIndexes.map(v => v.gameVersion) ?? []"
    :has-installed-version="hasInstalledVersion"
    :loading="loading"
    :has-more="files.length < totalCount"
    :loading-versions="loadingVersions"
    :updating="innerUpdating || updating || installing"
    :versions="modVersions"
    :curseforge="curseforgeId"
    :modrinth="modrinthId"
    :loading-dependencies="loadingDependencies"
    current-target="curseforge"
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
