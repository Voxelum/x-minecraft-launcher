<script lang="ts" setup>
import StoreProject, { StoreProject as IStoreProject } from '@/components/StoreProject.vue'
import { StoreProjectVersion } from '@/components/StoreProjectInstallVersionDialog.vue'
import { TeamMember } from '@/components/StoreProjectMembers.vue'
import { getCurseforgeProjectDescriptionModel, getCurseforgeProjectFilesModel, getCurseforgeProjectModel, useCurseforgeCategoryI18n } from '@/composables/curseforge'
import { getCurseforgeChangelogModel } from '@/composables/curseforgeChangelog'
import { useDateString } from '@/composables/date'
import { kInstances } from '@/composables/instances'
import { useModpackInstaller } from '@/composables/modpackInstaller'
import { useSWRVModel } from '@/composables/swrv'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { useTasks } from '@/composables/task'
import { clientCurseforgeV1 } from '@/util/clients'
import { getCurseforgeFileGameVersions, getCursforgeFileModLoaders } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { getSWRV } from '@/util/swrvGet'
import { FileRelationType } from '@xmcl/curseforge'
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
      rawUrl: g.url,
      url: g.thumbnailUrl,
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
  _installing.value = true
  installModpack({ modId: proj.value!.id, fileId: Number(v.id), icon: project.value?.iconUrl, market: 1 }).finally(() => {
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
const installModpack = useModpackInstaller()
const config = injection(kSWRVConfig)

async function getVersionDetail(version: StoreProjectVersion) {
  const target = allVersions.data.value?.data.find(v => v.id === Number(version.id))
  if (!target) return { changelog: '', dependencies: [], version }

  const mapping = {
    [FileRelationType.EmbeddedLibrary]: 'embedded',
    [FileRelationType.Include]: 'embedded',
    [FileRelationType.RequiredDependency]: 'required',
    [FileRelationType.OptionalDependency]: 'optional',
    [FileRelationType.Tool]: 'optional',
    [FileRelationType.Incompatible]: 'incompatible',
  }
  const lookup = Object.fromEntries(target.dependencies.map(p => [p.modId, mapping[p.relationType]]))
  const detail =
    target.dependencies.length > 0
      ? await clientCurseforgeV1.getMods(target.dependencies.map(d => d.modId))
      : []
  const dependencies = detail.map(d => ({
    title: d.name,
    description: d.summary,
    icon: d.logo.url,
    href: d?.links.websiteUrl ?? '',
    dependencyType: lookup[d.id],
  }))
  const changelog = await getSWRV(getCurseforgeChangelogModel(target.modId, target.id), config)
  return {
    changelog,
    dependencies,
    version,
  }
}

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
    :get-version-detail="getVersionDetail"
    @install="onInstall"
    @open="onOpen"
  />
</template>
