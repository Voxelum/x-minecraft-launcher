<script lang="ts"  setup>
import StoreProject, { StoreProject as IStoreProject } from '@/components/StoreProject.vue'
import { StoreProjectVersion } from '@/components/StoreProjectInstallVersionDialog.vue'
import { TeamMember } from '@/components/StoreProjectMembers.vue'
import { getCurseforgeProjectDescriptionModel, getCurseforgeProjectFilesModel, getCurseforgeProjectModel, useCurseforgeCategoryI18n } from '@/composables/curseforge'
import { useCurseforgeInstallModpack } from '@/composables/curseforgeInstaller'
import { useDateString } from '@/composables/date'
import { kInstances } from '@/composables/instances'
import { useSWRVModel } from '@/composables/swrv'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { useTasks } from '@/composables/task'
import { getCurseforgeFileGameVersions, getCursforgeFileModLoaders } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { TaskState } from '@xmcl/runtime-api'

const props = defineProps<{ id: number }>()

const { t, te } = useI18n()
const projectId = computed(() => props.id)

const { data: proj, isValidating, mutate, error } = useSWRVModel(getCurseforgeProjectModel(projectId))
const { getDateString } = useDateString()
const tCategory = useCurseforgeCategoryI18n()
const description = useSWRVModel(getCurseforgeProjectDescriptionModel(projectId))
const project = computed(() => {
  const p = proj.value
  if (!p) return undefined
  const links = [] as IStoreProject['links']
  if (p.links.issuesUrl) {
    links.push({
      url: p.links.issuesUrl,
      name: t('modrinth.issueUrl'),
    })
  }
  if (p.links.sourceUrl) {
    links.push({
      url: p.links.sourceUrl,
      name: t('modrinth.sourceUrl'),
    })
  }
  if (p.links.wikiUrl) {
    links.push({
      url: p.links.wikiUrl,
      name: t('modrinth.wikiUrl'),
    })
  }
  const info = [] as IStoreProject['info']
  if (p?.dateCreated) {
    info.push({
      name: t('curseforge.createdDate'),
      icon: 'event_available',
      value: getDateString(p.dateCreated),
    })
  }
  if (p?.dateModified) {
    info.push({
      name: t('curseforge.lastUpdate'),
      icon: 'edit_calendar',
      value: getDateString(p.dateModified),
    })
  }
  if (p?.dateReleased) {
    info.push({
      name: t('curseforge.releasedDate'),
      icon: 'calendar_month',
      value: getDateString(p.dateReleased),
    })
  }
  if (p?.slug) {
    info.push({
      name: 'Slug',
      icon: 'link',
      value: p.slug,
    })
  }
  const categories: IStoreProject['categories'] = p?.categories.map(c => reactive({
    id: c.id.toString(),
    text: computed(() => tCategory(c.name)),
    icon: c.iconUrl,
  })) || []

  const result: IStoreProject = reactive({
    id: p.id.toString(),
    title: p.name,
    iconUrl: p.logo.url,
    url: p.links.websiteUrl,
    description: p.summary,
    categories,
    downloads: p.downloadCount,
    follows: p.thumbsUpCount,
    createDate: p.dateCreated,
    updateDate: p.dateModified,
    links,
    info,
    htmlDescription: computed(() => description.data.value || ''),
    gallery: p.screenshots.map(g => ({
      url: g.url,
      description: g.description,
    })),
  })
  return result
})

const allVersions = useSWRVModel(getCurseforgeProjectFilesModel(projectId, ref(undefined), ref(undefined)), inject(kSWRVConfig))
const versions = computed(() => {
  if (!proj.value) return []
  const result: StoreProjectVersion[] = []
  for (const v of (allVersions.data.value?.data || proj.value.latestFiles)) {
    const x: StoreProjectVersion = {
      id: v.id.toString(),
      name: v.displayName,
      version_type: v.releaseType === 1 ? 'release' : v.releaseType === 2 ? 'beta' : 'alpha',
      game_versions: getCurseforgeFileGameVersions(v),
      loaders: getCursforgeFileModLoaders(v),
    }
    result.push(x)
  }
  return result
})

const members = computed(() => {
  if (!proj.value) return []
  const result: TeamMember[] = []
  for (const m of proj.value.authors) {
    result.push({
      id: m.id.toString(),
      name: m.name,
      avatar: '',
      role: '',
    })
  }
  return result
})

const _installing = ref(false)
const onInstall = (v: StoreProjectVersion) => {
  if (!proj.value) return
  const files = (allVersions.data.value?.data || proj.value.latestFiles)
  const file = files.find(f => f.id.toString() === v.id)
  if (!file) return
  _installing.value = true
  installModpack(file).finally(() => {
    _installing.value = false
  })
}

const { instances, selectedInstance } = injection(kInstances)
const existed = computed(() => instances.value.find(i => i.upstream?.type === 'curseforge-modpack' && i.upstream?.modId === props.id))
const { push } = useRouter()
const onOpen = () => {
  const i = existed.value
  if (i) {
    selectedInstance.value = i.path
    push('/')
  }
}

const tasks = useTasks((t) => {
  if (t.state !== TaskState.Running) return false
  if (t.path === 'installCurseforgeFile' && t.param.modId === props.id) return true
  if (t.path === 'installInstanceFiles' && t.param.instance === existed.value?.path) return true
  return false
})
const isDownloading = computed(() => tasks.value.length > 0)
const installModpack = useCurseforgeInstallModpack(computed(() => project.value?.iconUrl))

</script>
<template>
  <StoreProject
    :project="project"
    :versions="versions"
    :error="error"
    :refreshing="isValidating"
    :members="members"
    :installing="isDownloading || _installing"
    :installed="!!existed"
    :loading-members="false"
    :team-error="undefined"
    @install="onInstall"
    @open="onOpen"
  />
</template>
