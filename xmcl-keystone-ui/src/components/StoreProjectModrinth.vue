<script lang="ts"  setup>
import { useService } from '@/composables'
import { useMarkdown } from '@/composables/markdown'
import { useModrinthTags } from '@/composables/modrinth'
import { useModrinthProject } from '@/composables/modrinthProject'
import { useModrintTasks, useModrinthVersions } from '@/composables/modrinthVersions'
import { usePresence } from '@/composables/presence'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { clientModrinthV2 } from '@/util/clients'
import { resolveModpackInstanceConfig } from '@/util/modpackFilesResolver'
import { ProjectVersion } from '@xmcl/modrinth'
import { InstanceInstallServiceKey, InstanceServiceKey, ModpackServiceKey, ModrinthServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import StoreProjectBase, { StoreProject } from './StoreProject.vue'
import { TeamMember } from './StoreProjectMembers.vue'
import { generateDistinctName } from '@/util/instanceName'
import { injection } from '@/util/inject'
import { kInstances } from '@/composables/instances'
import { StoreProjectVersion } from './StoreProjectInstallFeaturedVersionDialog.vue'

const props = defineProps<{ id: string }>()

const { t } = useI18n()
const projectId = computed(() => props.id)

const { categories: modrinthCategories } = useModrinthTags()
const { project: proj, refreshing, refreshError, refresh } = useModrinthProject(projectId)
const { render } = useMarkdown()
const project = computed(() => {
  const p = proj.value
  if (!p) return undefined
  const links = [] as StoreProject['links']
  if (p.discord_url) {
    links.push({
      url: p.discord_url,
      name: 'Discord',
    })
  }
  if (p.issues_url) {
    links.push({
      url: p.issues_url,
      name: 'Issue',
    })
  }
  if (p.source_url) {
    links.push({
      url: p.source_url,
      name: 'Source',
    })
  }
  if (p.wiki_url) {
    links.push({
      url: p.wiki_url,
      name: 'Wiki',
    })
  }
  const info = [] as StoreProject['info']
  info.push({
    name: t('modrinth.clientSide'),
    value: p.client_side ? t('modrinth.environments.required') : t('modrinth.environments.optional'),
  })
  info.push({
    name: t('modrinth.serverSide'),
    value: p.server_side ? t('modrinth.environments.required') : t('modrinth.environments.optional'),
  })
  info.push({
    name: t('modrinth.license'),
    value: p.license.name,
    url: p.license.url,
  })
  info.push({
    name: t('modrinth.projectId'),
    value: p.id,
  })
  const categories = [] as StoreProject['categories']
  for (const c of p.categories) {
    const cat = modrinthCategories.value.find(cat => cat.name === c)
    if (cat) {
      categories.push({
        name: t(`modrinth.categories.${cat.name}`),
        icon: cat.icon,
      })
    }
  }
  const result: StoreProject = {
    id: p.id,
    title: p.title,
    iconUrl: p.icon_url,
    url: `https://modrinth.com/${p.project_type}/${p.slug}`,
    description: p.description,
    categories,
    downloads: p.downloads,
    follows: p.followers,
    createDate: p.published,
    updateDate: p.updated,
    links,
    info,
    htmlDescription: render(p.body),
    gallery: p.gallery.map(g => ({
      url: g.url,
      description: g.description,
    })),
  }
  return result
})
const { versions, error } = useModrinthVersions(computed(() => props.id), true)

const onInstall = (v: StoreProjectVersion) => {
  const ver = v as ProjectVersion
  installModpack(ver)
}

const { push } = useRouter()
const onOpen = () => {
  const i = existed.value
  if (i) {
    selectedInstance.value = i.path
    push('/')
  }
}

const tasks = useModrintTasks(computed(() => props.id))
const isDownloading = computed(() => Object.keys(tasks.value).length > 0)
const { getModpackInstallFiles } = useService(ModpackServiceKey)
const { installInstanceFiles } = useService(InstanceInstallServiceKey)
const { instances, selectedInstance } = injection(kInstances)
const existed = computed(() => instances.value.find(i => i.upstream?.type === 'modrinth-modpack' && i.upstream?.projectId === props.id))
const installModpack = async (v: ProjectVersion) => {
  const result = await installVersion({ version: v, icon: project.value?.iconUrl })
  const resource = result.resources[0]
  const config = resolveModpackInstanceConfig(resource)

  if (!config) return
  const name = generateDistinctName(config.name, instances.value.map(i => i.name))
  const path = await createInstance({
    ...config,
    name,
  })
  const files = await getModpackInstallFiles(resource.path)
  await installInstanceFiles({
    path,
    files,
  })
}

const { createInstance } = useService(InstanceServiceKey)
const { installVersion } = useService(ModrinthServiceKey)

const { isValidating: loadingMembers, error: teamError, data } = useSWRV(computed(() => `/modrinth/team/${props.id}`),
  () => clientModrinthV2.getProjectTeamMembers(props.id),
  inject(kSWRVConfig),
)
const members = computed(() => {
  if (!data.value) return []
  const result: TeamMember[] = []
  for (const m of data.value) {
    result.push({
      id: m.user.id,
      name: m.user.name || m.user.username,
      avatar: m.user.avatar_url,
      role: m.role,
    })
  }
  return result
})

// // modrinth project
// const { path } = inject(kInstance, ({ path: '' }) as any)

// // modrinth version status
// const holder = ref({} as Record<string, ProjectVersion>)
// provide(kModrinthVersionsHolder, holder)
// const versions = computed(() => Object.values(holder.value))
// const status = useModrinthVersionsResources(versions)
// const tasks = useModrintTasks(projectId)
// provide(kModrinthVersionsStatus, { ...status, tasks })

usePresence(computed(() => t('presence.modrinthProject', { name: project.value?.title || '' })))
</script>
<template>
  <StoreProjectBase
    :project="project"
    :featured-versions="versions"
    :error="error"
    :refreshing="refreshing"
    :tasks="tasks"
    :members="members"
    :installing="isDownloading"
    :installed="!!existed"
    :loading-members="loadingMembers"
    :team-error="teamError"
    @install="onInstall"
    @open="onOpen"
  />
</template>
