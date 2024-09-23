<script lang="ts"  setup>
import StoreProjectBase, { StoreProject } from '@/components/StoreProject.vue'
import { StoreProjectVersion } from '@/components/StoreProjectInstallVersionDialog.vue'
import { TeamMember } from '@/components/StoreProjectMembers.vue'
import { kInstances } from '@/composables/instances'
import { useMarkdown } from '@/composables/markdown'
import { kModrinthTags } from '@/composables/modrinth'
import { useModrinthInstallModpack } from '@/composables/modrinthInstaller'
import { useModrinthProject } from '@/composables/modrinthProject'
import { useModrinthVersions } from '@/composables/modrinthVersions'
import { useNotifier } from '@/composables/notifier'
import { usePresence } from '@/composables/presence'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { useTasks } from '@/composables/task'
import { clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { ProjectVersion } from '@xmcl/modrinth'
import { TaskState } from '@xmcl/runtime-api'
import useSWRV from 'swrv'

const props = defineProps<{ id: string }>()

const { t } = useI18n()
const projectId = computed(() => props.id)

const { categories: modrinthCategories } = injection(kModrinthTags)
const { project: proj, isValidating: refreshing } = useModrinthProject(projectId)
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
      name: t('modrinth.issueUrl'),
    })
  }
  if (p.source_url) {
    links.push({
      url: p.source_url,
      name: t('modrinth.sourceUrl'),
    })
  }
  if (p.wiki_url) {
    links.push({
      url: p.wiki_url,
      name: t('modrinth.wikiUrl'),
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
        text: t(`modrinth.categories.${cat.name}`),
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
const { versions, error } = useModrinthVersions(computed(() => props.id))

const _installing = ref(false)
const { notify } = useNotifier()
const onInstall = (v: StoreProjectVersion) => {
  const ver = v as ProjectVersion
  _installing.value = true
  installModpack(ver).catch((e) => {
    notify({ level: 'error', title: e.message })
  }).finally(() => {
    _installing.value = false
  })
}

const { instances, selectedInstance } = injection(kInstances)
const existed = computed(() => instances.value.find(i => i.upstream?.type === 'modrinth-modpack' && i.upstream?.projectId === props.id))
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
  if (t.path === 'installModrinthFile' && t.param.projectId === project.value) return true
  if (t.path === 'installInstanceFiles' && t.param.instance === existed.value?.path) return true
  return false
})
const isDownloading = computed(() => tasks.value.length > 0)
const { installModpack } = useModrinthInstallModpack(computed(() => project.value?.iconUrl))

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

usePresence(computed(() => t('presence.modrinthProject', { name: project.value?.title || '' })))
</script>
<template>
  <StoreProjectBase
    :project="project"
    :versions="versions"
    :error="error"
    :refreshing="refreshing"
    :tasks="tasks"
    :members="members"
    :installing="isDownloading || _installing"
    :installed="!!existed"
    :loading-members="loadingMembers"
    :team-error="teamError"
    @install="onInstall"
    @open="onOpen"
  />
</template>
