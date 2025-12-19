<script setup lang="ts">
import { ProjectDependency } from '@/components/MarketProjectDetail.vue'
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
import { CategoryItem } from '@/components/MarketProjectDetail.vue'

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

// Modern specific logic
const tab = ref(0)
const items = computed(() => [t('mod.description'), 'Gallery', t('mod.versions')])

const getIcon = (link: { name: string; url: string; icon: string }) => {
  const url = link.url.toLowerCase()
  const name = link.name.toLowerCase()
  if (url.includes('discord') || name.includes('discord')) return 'discord'
  if (url.includes('github') || name.includes('github')) return 'code' // github icon often aliased to code or specific
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
     <Hint
      v-if="isNotFound"
      icon="warning"
      color="red"
      class="px-10 h-full"
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
    
    <div v-else class="flex flex-col h-full relative overflow-y-auto custom-scrollbar">
      <!-- Decor Background -->
      <div class="absolute inset-0 z-0 h-80 overflow-hidden pointer-events-none">
          <img v-if="project?.icon_url" :src="project?.icon_url" class="w-full h-full object-cover blur-3xl opacity-30 scale-150 transform translate-y-[-20%]" />
          <div class="absolute inset-0 bg-gradient-to-b from-transparent to-[#121212]"></div>
      </div>

      <!-- Header Content -->
      <div class="relative z-10 px-8 pt-8 pb-4 flex flex-row gap-6 items-start shrink-0">
          <v-img 
            :src="project?.icon_url" 
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
                 {{ installed ? t('modInstall.reinstall') : t('modInstall.install') }}
               </v-btn>
           </div>
      </div>

      <!-- Navigation -->
      <div class="px-8 z-10 sticky top-0 bg-[#121212]/95 backdrop-blur-md border-b border-white/5 shrink-0 flex items-center justify-between">
         <v-tabs v-model="tab" background-color="transparent" slider-color="primary">
           <v-tab v-for="item in items" :key="item" class="font-bold tracking-wide">{{ item }}</v-tab>
         </v-tabs>
      </div>

      <!-- Content Area -->
      <div class="flex flex-1 p-8 gap-8 relative z-10">
          <!-- Main Panel -->
          <div class="flex-1 min-w-0">
             <div v-show="tab === 0" class="prose prose-invert max-w-none prose-img:rounded-lg prose-a:text-primary">
                <div v-html="model.htmlContent" class="select-text"></div>
             </div>
             
             <div v-show="tab === 1" class="grid grid-cols-2 md:grid-cols-3 gap-4">
               <v-img 
                 v-for="img in model.galleries" 
                 :key="img.url" 
                 :src="img.url"
                 aspect-ratio="1.7778"
                 class="rounded-lg cursor-pointer hover:ring-2 ring-primary transition-all shadow-md bg-white/5"
                 @click="/* Show full image */"
                ></v-img>
             </div>

              <div v-show="tab === 2" class="flex flex-col gap-2">
                 <!-- Version List Implementation would go here - preserving original component logic mostly -->
                 <!-- Reusing the list logic but styling it better -->
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
                      class="cursor-pointer font-weight-medium"
                      @click="emit('category', cat.id)"
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
                     <span class="font-mono text-gray-200 select-all bg-black/20 px-2 rounded">{{ projectId }}</span>
                   </div>
                   <div class="flex justify-between items-center" v-if="project?.license">
                     <span class="text-gray-400">{{ t('mod.license') }}</span>
                     <a :href="project?.license.url" target="_blank" class="text-primary hover:underline decoration-primary font-medium">{{ project?.license.name }}</a>
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
