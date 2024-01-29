<script lang="ts" setup>
import { useLocalStorageCacheBool } from '@/composables/cache'
import { useDateString } from '@/composables/date'
import { useDialog } from '@/composables/dialog'
import { getFeedTheBeastProjectModel, getFeedTheBeastVersionChangelogModel, getFeedTheBeastVersionModel } from '@/composables/ftb'
import { kInstance } from '@/composables/instance'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { InstanceInstallDialog } from '@/composables/instanceUpdate'
import { useSWRVModel } from '@/composables/swrv'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { getSWRV } from '@/util/swrvGet'
import { CachedFTBModpackVersionManifest, FTBModpackVersionManifest, FTBUpstream } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import HomeUpstreamBase from './HomeUpstreamBase.vue'
import { UpstreamHeaderProps } from './HomeUpstreamHeader.vue'
import { ProjectVersionProps } from './HomeUpstreamVersion.vue'
import { useMarkdown } from '@/composables/markdown'

const props = defineProps<{
  id: number
}>()

const { instance } = injection(kInstance)
const upstream = computed(() => instance.value?.upstream as FTBUpstream)

const { t, te } = useI18n()
const { data: project } = useSWRVModel(getFeedTheBeastProjectModel(computed(() => props.id)))
const { getDateString } = useDateString()
const headerData = computed(() => {
  if (!project.value) return undefined
  const result: UpstreamHeaderProps = {
    url: '',
    icon: project.value.art.find(v => v.type === 'square')?.url || '',
    title: project.value.name || '',
    description: project.value?.synopsis || '',
    categories: project.value.tags.map((c) => {
      return {
        text: c.name,
      }
    }),
    type: 'ftb',
    store: '/store/ftb/' + project.value.id,
    infos: [{
      icon: 'file_download',
      name: t('modrinth.downloads'),
      value: getExpectedSize(project.value.installs, ''),
    }, {
      icon: 'star_rate',
      name: t('modrinth.followers'),
      value: project.value.plays.toString(),
    }, {
      icon: 'event',
      name: t('modrinth.createAt'),
      value: getDateString(project.value.released * 1000, { dateStyle: 'long' }),
    }, {
      icon: 'update',
      name: t('modrinth.updateAt'),
      value: getDateString(project.value.refreshed * 1000, { dateStyle: 'long' }),
    }],
  }

  return result
})

const { data: allVersions, isValidating: loadingVersions } = useSWRV(computed(() => project.value?.id.toString()), async () => {
  const p = project.value
  if (!p) return []
  const result = await Promise.all(p.versions.map(async (v) => {
    const ver = await getSWRV(getFeedTheBeastVersionModel(ref(p.id), ref(v)), config)
    return ver ? markRaw(ver) : ver
  }))
  return result.filter((v): v is FTBModpackVersionManifest => !!v)
})
const currentVersion = computed(() => {
  const val = upstream.value
  if (!val || val.type !== 'ftb-modpack') return undefined
  const ver = allVersions.value?.find(v => v.id === val?.versionId && v.parent === val.id)
  if (!ver) return undefined
  const result: ProjectVersionProps = shallowReactive({
    id: ver.id.toString(),
    name: ver.name,
    versionType: 'release',
    versionNumber: ver.type,
    loaders: ver.targets.filter(x => x.type === 'modloader').map(x => x.name),
    gameVersions: ver.targets.filter(x => x.type === 'game').map(x => x.version),
    datePublished: new Date(ver.updated * 1000).toString(),
    downloads: ver.installs,
    changelog: ver.changelog,
  })
  return result
})
const limit = ref(10)
const onlyCurrentVersion = useLocalStorageCacheBool(computed(() => `instanceUpstreamOnlyShowCurrentVersion/${instance.value.path}`), false)
const items = computed(() => {
  const result = {} as Record<string, ProjectVersionProps[]>

  let all = allVersions.value || []
  if (onlyCurrentVersion.value) {
    all = all.filter(d => d.targets.find(mc => mc.version === instance.value.runtime.minecraft))
  }
  for (const d of all.toReversed().slice(0, limit.value)) {
    if (currentVersion.value?.id === d.id.toString()) continue
    const date = getDateString(d.updated * 1000, { dateStyle: 'long' })
    if (!result[date]) {
      result[date] = []
    }
    result[date].push(shallowReactive({
      id: d.id.toString(),
      name: d.name,
      versionType: 'release',
      versionNumber: d.name,
      loaders: d.targets.filter(x => x.type === 'modloader').map(x => x.name),
      gameVersions: d.targets.filter(x => x.type === 'game').map(x => x.version),
      datePublished: new Date(d.updated * 1000).toString(),
      downloads: d.installs,
      changelog: d.changelog,
    }))
  }

  return result
})

const state = inject('scroll', {
  bottom: false,
})

watch(computed(() => state.bottom), (reached) => {
  if (reached) {
    limit.value += 10
  }
})

const { show } = useDialog(InstanceInstallDialog)
const updating = ref(false)
async function onUpdate(v: ProjectVersionProps) {
  updating.value = true

  try {
    const newVer = allVersions.value?.find(d => d.id.toString() === v.id)
    if (!newVer) return
    const oldVer = allVersions.value?.find(d => d.id === upstream.value.versionId)
    if (!oldVer) return
    show({
      type: 'ftb',
      oldManifest: markRaw({
        ...oldVer,
        iconUrl: project.value?.art.find(a => a.type === 'square')?.url || '',
        projectName: project.value?.name || '',
        authors: project.value?.authors || [],
      }),
      newManifest: markRaw({
        ...newVer,
        iconUrl: project.value?.art.find(a => a.type === 'square')?.url || '',
        projectName: project.value?.name || '',
        authors: project.value?.authors || [],
      }),
    })
  } finally {
    updating.value = false
  }
}

const { show: showAddInstanceDialog } = useDialog(AddInstanceDialogKey)
const duplicating = ref(false)
const onDuplicate = async (v: ProjectVersionProps) => {
  duplicating.value = true
  try {
    const version = allVersions.value?.find(d => d.id.toString() === v.id)
    if (!version) return
    const cached: CachedFTBModpackVersionManifest = markRaw({
      ...version,
      iconUrl: project.value?.art.find(a => a.type === 'square')?.url || '',
      projectName: project.value?.name || '',
      authors: project.value?.authors || [],
    })
    showAddInstanceDialog({ type: 'ftb', manifest: cached })
  } finally {
    duplicating.value = false
  }
}

const config = inject(kSWRVConfig)

const { render } = useMarkdown()
function onChangelog(version: ProjectVersionProps) {
  getSWRV(getFeedTheBeastVersionChangelogModel(ref(props.id), ref(Number(version.id))), config).then((changelog) => {
    if (changelog) {
      version.changelog = render(changelog)
    }
  })
}

</script>
<template>
  <HomeUpstreamBase
    :items="items"
    :current-version="currentVersion"
    :header="headerData"
    :duplicating="duplicating"
    :only-current-version.sync="onlyCurrentVersion"
    @duplicate="onDuplicate"
    @update="onUpdate"
    @changelog="onChangelog"
  />
</template>
