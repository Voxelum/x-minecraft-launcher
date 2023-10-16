<script setup lang="ts">
import { useService } from '@/composables'
import { useCurseforgeProject, useCurseforgeProjectDescription, useCurseforgeProjectFiles } from '@/composables/curseforge'
import { useCurseforgeChangelog } from '@/composables/curseforgeChangelog'
import { useCurseforgeDependencies, useCurseforgeTask } from '@/composables/curseforgeDependencies'
import { useCurseforgeInstallModFile } from '@/composables/curseforgeInstall'
import { kImageDialog } from '@/composables/imageDialog'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { useModDetailEnable, useModDetailUpdate } from '@/composables/modDetail'
import { getCurseforgeModLoaderTypeFromRuntime, getCurseforgeRelationType, getCursforgeFileModLoaders, getCursforgeModLoadersFromString } from '@/util/curseforge'
import { TimeUnit, getAgoOrDate } from '@/util/date'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { FileRelationType, Mod } from '@xmcl/curseforge'
import { InstanceModsServiceKey, Resource, RuntimeVersions } from '@xmcl/runtime-api'
import ModDetail, { CategoryItem, ExternalResource, Info, ModDependency, ModDetailData, ModGallery } from './ModDetail.vue'
import { ModVersion } from './ModDetailVersion.vue'
import { useInstanceModLoaderDefault } from '@/util/instanceModLoaderDefault'
import { isNoModLoader } from '@/util/isNoModloader'
import { kModsSearch } from '@/composables/modSearch'

const { te, t } = useI18n()
const tCategory = (k: string) => te(`curseforgeCategory.${k}`) ? t(`curseforgeCategory.${k}`) : k
const props = defineProps<{
  curseforge?: Mod
  curseforgeId: number
  installed: ModFile[]
  minecraft: string
  runtime: RuntimeVersions
  updating?: boolean
  modrinth?: boolean
}>()
const getDateString = (date: string) => {
  const result = getAgoOrDate(new Date(date).getTime())
  if (typeof result === 'string') {
    return result
  }
  const [ago, unit] = result
  switch (unit) {
    case TimeUnit.Hour:
      return t('ago.hour', { duration: ago }, { plural: ago })
    case TimeUnit.Minute:
      return t('ago.minute', { duration: ago }, { plural: ago })
    case TimeUnit.Second:
      return t('ago.second', { duration: ago }, { plural: ago })
    case TimeUnit.Day:
      return t('ago.day', { duration: ago }, { plural: ago })
  }
  return date
}

const cursforgeModId = computed(() => props.curseforgeId)
const { modLoaderFilters } = injection(kModsSearch)

const { project: curseforgeProject, error: projectError, refreshing } = useCurseforgeProject(cursforgeModId)
const curseforgeMod = computed(() => {
  if (props.curseforge) return props.curseforge
  if (curseforgeProject.value) return curseforgeProject.value
})
const { description, refreshing: loadings } = useCurseforgeProjectDescription(reactive({ project: cursforgeModId }))
const model = computed(() => {
  const externals: ExternalResource[] = []
  const mod = curseforgeMod.value
  if (mod?.links.issuesUrl) {
    externals.push({
      icon: 'mdi-bug',
      name: 'Issue',
      url: mod.links.issuesUrl,
    })
  }
  if (mod?.links.websiteUrl) {
    externals.push({
      icon: 'mdi-web',
      name: 'Website',
      url: mod.links.websiteUrl,
    })
  }
  if (mod?.links.sourceUrl) {
    externals.push({
      icon: 'mdi-source-repository',
      name: 'Source',
      url: mod.links.sourceUrl,
    })
  }
  if (mod?.links.wikiUrl) {
    externals.push({
      icon: 'mdi-wikipedia',
      name: 'Wiki',
      url: mod.links.wikiUrl,
    })
  }
  const categories: CategoryItem[] = mod?.categories.map(c => reactive({
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
  const detail: ModDetailData = {
    id: cursforgeModId.value.toString(),
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
const releaseTypes: Record<string, 'release' | 'beta' | 'alpha'> = {
  1: 'release',
  2: 'beta',
  3: 'alpha',
}
const { files, refreshing: loadingVersions, index, totalCount, pageSize } = useCurseforgeProjectFiles(cursforgeModId,
  computed(() => props.minecraft),
  computed(() => undefined))

const modId = ref(0)
const fileId = ref(undefined as number | undefined)
const { changelog, isValidating } = useCurseforgeChangelog(modId, fileId)

const modVersions = computed(() => {
  const versions: ModVersion[] = []
  for (const file of files.value) {
    const loaders = getCursforgeFileModLoaders(file)
    if (!loaders.some(l => modLoaderFilters.value.indexOf(l.toLowerCase() as any) !== -1)) {
      continue
    }
    versions.push(reactive({
      id: file.id.toString(),
      name: file.displayName,
      version: file.fileName,
      disabled: false,
      changelog: computed(() => file.id === fileId.value ? changelog.value : undefined),
      changelogLoading: isValidating,
      type: releaseTypes[file.releaseType],
      installed: computed(() => props.installed.some(f => f.curseforge?.fileId === file.id)),
      downloadCount: file.downloadCount,
      loaders: getCursforgeFileModLoaders(file),
      minecraftVersion: file.gameVersions.filter(v => Number.isInteger(Number(v[0]))).join(', '),
      createdDate: file.fileDate,
      progress: undefined,
    }))
  }
  return versions
})

const loadChangelog = (version: ModVersion) => {
  modId.value = cursforgeModId.value
  fileId.value = Number(version.id)
}

const imageDialog = injection(kImageDialog)

const onLoadMore = () => {
  index.value += pageSize.value
}

const selectedVersion = ref(modVersions.value[0] as ModVersion | undefined)
provide('selectedVersion', selectedVersion)

const innerUpdating = useModDetailUpdate()

watch(() => props.curseforge, () => {
  innerUpdating.value = false
})

const { enabled, installed, hasInstalledVersion } = useModDetailEnable(selectedVersion, computed(() => props.installed), innerUpdating)

const { data: deps, error, isValidating: loadingDependencies } = useCurseforgeDependencies(
  computed(() => files.value.find(f => f.modId === cursforgeModId.value)),
  computed(() => props.minecraft),
  computed(() => getCurseforgeModLoaderTypeFromRuntime(props.runtime)),
)

const { mods } = injection(kInstanceModsContext)
const dependencies = computed(() => deps.value?.map((resolvedDep) => {
  const task = useCurseforgeTask(computed(() => resolvedDep.file.id))
  const file = computed(() => {
    for (const mod of mods.value) {
      if (mod.curseforge?.fileId === resolvedDep.file.id) {
        return mod
      }
    }
  })
  const otherFile = computed(() => {
    for (const mod of mods.value) {
      if (mod.curseforge?.projectId === resolvedDep.project.id && mod.curseforge?.fileId !== resolvedDep.file.id) {
        return mod
      }
    }
  })
  const dep: ModDependency = reactive({
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

const { path } = injection(kInstance)
const installCurseforgeFile = useCurseforgeInstallModFile(path)
const { uninstall: uninstallMod } = useService(InstanceModsServiceKey)
const installing = ref(false)
const installDefaultModLoader = useInstanceModLoaderDefault(path, computed(() => props.runtime))

const install = async (mod: ModVersion) => {
  const v = files.value.find(v => v.id.toString() === mod.id)
  if (!v) return
  try {
    installing.value = true
    if (isNoModLoader(props.runtime)) {
      // forge, fabric, quilt or neoforge
      const loaders = getCursforgeFileModLoaders(v)
      await installDefaultModLoader(loaders)
    }

    if (!hasInstalledVersion.value) {
      await Promise.all(deps.value
        ?.filter((v) => v.type === FileRelationType.RequiredDependency)
        .filter(v => mods.value.every(m => m.curseforge?.fileId !== v.project.id))
        .map((v) => installCurseforgeFile(v.file, v.project.logo?.url)) ?? [])
      await installCurseforgeFile(v, model.value.icon)
    } else {
      const resources = props.installed.map(i => i.resource)
      await Promise.all(deps.value
        ?.filter((v) => v.type === FileRelationType.RequiredDependency)
        .filter(v => mods.value.every(m => m.curseforge?.fileId !== v.project.id))
        .map((v) => installCurseforgeFile(v.file, v.project.logo?.url)) ?? [])
      await installCurseforgeFile(v, model.value.icon)
      await uninstallMod({ path: path.value, mods: resources })
    }
  } finally {
    installing.value = false
  }
}
const installDependency = async (dep: ModDependency) => {
  const d = deps.value?.find(d => d.project.id.toString() === dep.id)
  if (!d) return
  const ver = d.file
  try {
    installing.value = true
    const resources = [] as Resource[]
    if (dep.installedDifferentVersion) {
      for (const mod of mods.value) {
        if (mod.curseforge?.fileId === d.project.id) {
          resources.push(mod.resource)
        }
      }
    }
    await installCurseforgeFile(ver, dep.icon)
    if (resources.length > 0) {
      await uninstallMod({ path: path.value, mods: resources })
    }
  } finally {
    installing.value = false
  }
}

const onDelete = async () => {
  innerUpdating.value = true
  await uninstallMod({ path: path.value, mods: props.installed.map(i => i.resource) })
}

const { push, currentRoute } = useRouter()
const onOpenDependency = (dep: ModDependency) => {
  push({ query: { ...currentRoute.query, id: `curseforge:${dep.id}` } })
}

</script>
<template>
  <ModDetail
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
    curseforge
    :modrinth="modrinth"
    :loading-dependencies="loadingDependencies"
    @load-changelog="loadChangelog"
    @delete="onDelete"
    @show-image="imageDialog.show"
    @enable="enabled = $event"
    @load-more="onLoadMore"
    @open-dependency="onOpenDependency"
    @install="install"
    @install-dependency="installDependency"
  />
</template>
