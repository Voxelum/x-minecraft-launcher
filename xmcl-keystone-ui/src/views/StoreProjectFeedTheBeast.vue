<script lang="ts"  setup>
import StoreProject, { StoreProject as IStoreProject } from '@/components/StoreProject.vue'
import { StoreProjectVersion } from '@/components/StoreProjectInstallVersionDialog.vue'
import { TeamMember } from '@/components/StoreProjectMembers.vue'
import { getFeedTheBeastProjectModel, getFeedTheBeastVersionModel, useFeedTheBeastModpackInstall } from '@/composables/ftb'
import { kInstances } from '@/composables/instances'
import { useMarkdown } from '@/composables/markdown'
import { useSWRVModel } from '@/composables/swrv'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { injection } from '@/util/inject'
import { getSWRV } from '@/util/swrvGet'
import { FTBModpackVersionManifest } from '@xmcl/runtime-api'
import useSWRV from 'swrv'

const props = defineProps<{ id: number }>()

const projectId = computed(() => props.id)

const config = injection(kSWRVConfig)
const { render } = useMarkdown()
const { data: proj, isValidating, mutate, error } = useSWRVModel(getFeedTheBeastProjectModel(projectId), config)
const project = computed(() => {
  const p = proj.value
  if (!p) return undefined
  const links = [{
  }] as IStoreProject['links']
  const info = [] as IStoreProject['info']
  const categories: IStoreProject['categories'] = []

  const result: IStoreProject = ({
    id: p.id.toString(),
    title: p.name,
    iconUrl: p.art.find(a => a.type === 'square')?.url,
    url: '',
    description: p.synopsis,
    categories,
    downloads: p.installs,
    follows: p.plays,
    createDate: new Date(p.released * 1000).toString(),
    updateDate: new Date(p.refreshed * 1000).toString(),
    links,
    info,
    htmlDescription: render(p.description),
    gallery: p.art.map(g => ({
      url: g.url,
      description: g.type,
    })),
  })
  return result
})

const { data: allVersions, isValidating: loadingVersions } = useSWRV(computed(() => proj.value ? proj.value.id.toString() : undefined), async () => {
  const p = proj.value
  if (!p) return []
  const result = await Promise.all(p.versions.map(async (v) => {
    const ver = await getSWRV(getFeedTheBeastVersionModel(ref(p.id), ref(v)), config)
    return ver
  }))
  return result.filter((v): v is FTBModpackVersionManifest => !!v).toReversed()
})
const versions = computed(() => {
  return allVersions.value?.map(ver => {
    const x: StoreProjectVersion = {
      id: ver.id.toString(),
      name: ver?.name || '',
      version_type: ver.type,
      game_versions: ver?.targets.filter(t => t.type === 'game').map(v => v.version) || [],
      loaders: ver?.targets.filter(t => t.name === 'modloader').map(v => `${v.name}:${v.version}`) || [],
    }
    return x
  }) || []
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
const { installModpack } = useFeedTheBeastModpackInstall()
const onInstall = (v: StoreProjectVersion) => {
  if (!proj.value) return
  const versions = allVersions.value || []
  const ver = versions.find(f => f.id.toString() === v.id)
  if (!ver) return
  _installing.value = true
  installModpack(ver, proj.value).finally(() => {
    _installing.value = false
  })
}

const { instances, selectedInstance } = injection(kInstances)
const existed = computed(() => instances.value.find(i => i.upstream?.type === 'ftb-modpack' && i.upstream?.id === props.id))
const { push } = useRouter()
const onOpen = () => {
  const i = existed.value
  if (i) {
    selectedInstance.value = i.path
    push('/')
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
    :installing="_installing || loadingVersions"
    :installed="!!existed"
    :loading-members="false"
    :team-error="undefined"
    @install="onInstall"
    @open="onOpen"
  />
</template>
