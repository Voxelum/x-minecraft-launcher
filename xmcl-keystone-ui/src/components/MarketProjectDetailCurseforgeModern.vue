<script setup lang="ts">
import { CategoryItem, ExternalResource, Info, ModGallery, ProjectDependency, ProjectDetail } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import { getCurseforgeProjectDescriptionModel, getCurseforgeProjectModel, useCurseforgeCategoryI18n, useCurseforgeProjectFiles } from '@/composables/curseforge'
import { useCurseforgeChangelog } from '@/composables/curseforgeChangelog'
import { getCurseforgeDependenciesModel, useCurseforgeTask } from '@/composables/curseforgeDependencies'
import { kCurseforgeInstaller } from '@/composables/curseforgeInstaller'
import { useDateString } from '@/composables/date'
import { useI18nSearchFlights } from '@/composables/flights'
import { useAutoI18nCommunityContent } from '@/composables/i18n'
import { useInCollection, useModrinthFollow } from '@/composables/modrinthAuthenticatedAPI'
import { useProjectDetailEnable, useProjectDetailUpdate } from '@/composables/projectDetail'
import { useService } from '@/composables/service'
import { useLoading, useSWRVModel } from '@/composables/swrv'
import { basename } from '@/util/basename'
import { getCurseforgeFileGameVersions, getCurseforgeRelationType, getCursforgeFileModLoaders, getCursforgeModLoadersFromString, getModLoaderTypesForFile } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { ModFile, getModMinecraftVersion, isModFile } from '@/util/mod'
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
        url: image?.thumbnailUrl ?? '',
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
    const minecraftVersion = isModFile(i) ? getModMinecraftVersion(i) : undefined
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
      minecraftVersion,
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
const { isFollowed, following, onFollow } = useModrinthFollow(modrinthId)

// Modern specific logic
const tab = ref(0)
const items = computed(() => [t('mod.description'), 'Gallery', t('mod.versions')])

const getIcon = (link: { name: string; url: string; icon: string }) => {
  const url = link.url.toLowerCase()
  const name = link.name.toLowerCase()
  if (url.includes('discord') || name.includes('discord')) return 'discord'
  if (url.includes('github') || name.includes('github')) return 'code'
  if (url.includes('reddit') || name.includes('reddit')) return 'reddit'
  if (url.includes('youtube') || name.includes('youtube')) return 'youtube'
  if (name.includes('source')) return 'code'
  if (name.includes('issue')) return 'bug_report'
  if (name.includes('wiki')) return 'menu_book'
  return link.icon || 'open_in_new'
}
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden bg-transparent">
    <div class="flex flex-col h-full relative overflow-y-auto custom-scrollbar">
      <!-- Decor Background -->
       <div class="absolute inset-0 z-0 h-80 overflow-hidden pointer-events-none">
          <img v-if="model.icon" :src="model.icon" class="w-full h-full object-cover blur-3xl opacity-30 scale-150 transform translate-y-[-20%]" />
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-[#121212]"></div>
      </div>

       <!-- Header Content -->
       <div class="relative z-10 px-8 pt-8 pb-4 flex flex-row gap-6 items-start shrink-0">
          <v-img 
            :src="model.icon" 
            max-width="128" 
            max-height="128" 
            class="rounded-xl shadow-2xl shrink-0"
            contain
          ></v-img>
          
          <div class="flex flex-col flex-1 gap-2">
            <h1 class="text-4xl font-extrabold shadow-black drop-shadow-lg">{{ model.title }}</h1>
             <div class="flex items-center gap-4 text-gray-300">
               <span class="flex items-center gap-1 font-bold text-primary">
                 <v-icon small color="primary">person</v-icon>
                 {{ model.author }}
               </span>
               <span class="text-gray-500">|</span>
               <span class="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg active:bg-white/10 cursor-pointer transition-colors" @click="onFollow">
                 <v-icon small :color="isFollowed ? 'red' : 'gray'">{{ isFollowed ? 'favorite' : 'favorite_border' }}</v-icon>
                 {{ model.follows }}
               </span>
               <span class="flex items-center gap-1">
                 <v-icon small>file_download</v-icon>
                 {{ (model.downloadCount / 1000).toFixed(1) }}k
               </span>
             </div>
             <p class="text-gray-400 mt-2 line-clamp-2 max-w-3xl font-medium text-lg leading-relaxed">{{ model.description }}</p>
          </div>

           <div class="flex gap-2 self-start actions-group">
               <v-btn
                large
                color="primary"
                class="rounded-lg shadow-lg"
                :loading="installing || innerUpdating"
                :disabled="!selectedVersion"
                @click="selectedVersion && onInstall(selectedVersion)"
               >
                 <v-icon left>download</v-icon>
                 {{ installed.length > 0 ? t('modInstall.reinstall') : t('modInstall.install') }}
               </v-btn>
           </div>
      </div>

      <!-- Navigation -->
      <div class="px-8 z-10 sticky top-0 bg-[#121212]/95 backdrop-blur-md border-b border-white/5 shrink-0 flex items-center justify-between">
         <v-tabs v-model="tab" background-color="transparent" slider-color="warning">
           <v-tab v-for="item in items" :key="item" class="font-bold tracking-wide">{{ item }}</v-tab>
         </v-tabs>
      </div>

      <!-- Content Area -->
      <div class="flex flex-1 p-8 gap-8 relative z-10">
          <!-- Main Panel -->
          <div class="flex-1 min-w-0">
             <div v-show="tab === 0" class="prose prose-invert max-w-none prose-img:rounded-lg prose-a:text-warning" ref="descriptionRef">
                <div v-html="model.htmlContent" class="select-text"></div>
             </div>
             
             <div v-show="tab === 1" class="grid grid-cols-2 md:grid-cols-3 gap-4">
               <v-img 
                 v-for="img in model.galleries" 
                 :key="img.url" 
                 :src="img.url"
                 aspect-ratio="1.7778"
                 class="rounded-lg cursor-pointer hover:ring-2 ring-warning transition-all shadow-md bg-white/5"
                ></v-img>
             </div>

              <div v-show="tab === 2" class="flex flex-col gap-2">
                 <!-- Version List Implementation would go here - preserving original component logic mostly -->
              </div>
          </div>

          <!-- Sidebar -->
          <div class="w-80 shrink-0 flex flex-col gap-6">
              <!-- Categories -->
              <div class="flex flex-col gap-3">
                 <h3 class="text-xs font-bold text-gray-400 tracking-wider uppercase">{{ t('mod.categories') }}</h3>
                 <div class="flex flex-wrap gap-2">
                    <v-chip
                      v-for="cat in model.categories" 
                      :key="cat.id"
                      small
                      label
                      outlined
                      class="cursor-default font-weight-medium"
                    >
                      <v-avatar left v-if="cat.iconUrl" class="mr-1">
                        <v-img :src="cat.iconUrl"></v-img>
                      </v-avatar>
                      {{ cat.name }}
                    </v-chip>
                 </div>
              </div>

               <!-- Metadata -->
              <div class="flex flex-col gap-3">
                 <h3 class="text-xs font-bold text-gray-400 tracking-wider uppercase">{{ t('mod.links') }}</h3>
                 <div class="flex flex-col gap-1">
                   <a
                     v-for="link in model.externals" 
                     :key="link.name" 
                     :href="link.url" 
                     target="_blank"
                     class="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/5 transition-all group no-underline text-gray-300"
                   >
                      <v-icon class="text-gray-400 group-hover:text-white transition-colors" size="20">{{ getIcon(link) }}</v-icon>
                      <span class="font-medium group-hover:text-white transition-colors">{{ link.name }}</span>
                      <v-icon small class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</v-icon>
                   </a>
                 </div>
              </div>
              
               <!-- Technical Info -->
              <div class="flex flex-col gap-3">
                 <h3 class="text-xs font-bold text-gray-400 tracking-wider uppercase">{{ t('mod.technical') }}</h3>
                 <div class="flex flex-col gap-2 text-sm bg-white/5 rounded-lg p-3">
                   <div class="flex justify-between items-center">
                     <span class="text-gray-400">{{ t('mod.projectId') }}</span>
                     <span class="font-mono text-gray-200 select-all bg-black/20 px-2 rounded">{{ props.curseforgeId }}</span>
                   </div>
                 </div>
              </div>
          </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
