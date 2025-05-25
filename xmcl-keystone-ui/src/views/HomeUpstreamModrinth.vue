<script lang="ts" setup>
import { useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { useDateString } from '@/composables/date'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { InstanceInstallDialog } from '@/composables/instanceUpdate'
import { useMarkdown } from '@/composables/markdown'
import { useModrinthHeaderData } from '@/composables/modrinth'
import { getModrinthProjectModel } from '@/composables/modrinthProject'
import { getModrinthVersionModel } from '@/composables/modrinthVersions'
import { useSWRVModel } from '@/composables/swrv'
import { injection } from '@/util/inject'
import { ModpackServiceKey, ModrinthUpstream } from '@xmcl/runtime-api'
import HomeUpstreamBase from './HomeUpstreamBase.vue'
import { ProjectVersionProps } from './HomeUpstreamVersion.vue'

const props = defineProps<{
  id: string
}>()

const { instance } = injection(kInstance)
const upstream = computed(() => instance.value?.upstream as ModrinthUpstream)

const { data: project } = useSWRVModel(getModrinthProjectModel(computed(() => props.id)))
const { getDateString } = useDateString()
const headerData = useModrinthHeaderData(project)
const { data } = useSWRVModel(getModrinthVersionModel(computed(() => props.id), undefined, ref(undefined), ref(undefined)))
const { render } = useMarkdown()
const currentVersion = computed(() => {
  const val = upstream.value
  if (!val || val.type !== 'modrinth-modpack') return undefined
  const ver = data.value?.find(v => v.id === val?.versionId)
  if (!ver) return undefined
  const result: ProjectVersionProps = {
    id: ver.id,
    name: ver.name,
    versionType: ver.version_type as any,
    versionNumber: ver.version_number,
    loaders: ver.loaders,
    gameVersions: ver.game_versions,
    datePublished: (ver.date_published),
    downloads: ver.downloads,
    changelog: ver.changelog ? render(ver.changelog) : '',
  }
  return result
})
const limit = ref(10)
const onlyCurrentVersion = useLocalStorageCacheBool(computed(() => `instanceUpstreamOnlyShowCurrentVersion/${instance.value.path}`), false)
const items = computed(() => {
  const result = {} as Record<string, ProjectVersionProps[]>

  let all = data.value || []
  if (onlyCurrentVersion.value) {
    all = all.filter(d => d.game_versions.includes(instance.value.runtime.minecraft))
  }
  for (const d of all.slice(0, limit.value)) {
    if (d.id === currentVersion.value?.id) continue
    const date = getDateString(d.date_published, { dateStyle: 'long' })
    if (!result[date]) {
      result[date] = []
    }
    result[date].push(markRaw({
      id: d.id,
      name: d.name,
      versionType: d.version_type as any,
      versionNumber: d.version_number,
      loaders: d.loaders,
      gameVersions: d.game_versions,
      datePublished: (d.date_published),
      downloads: d.downloads,
      changelog: d.changelog ? render(d.changelog) : '',
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
const { installModapckFromMarket } = useService(ModpackServiceKey)
const updating = ref(false)
async function onUpdate(v: ProjectVersionProps) {
  updating.value = true

  try {
    const instancePath = instance.value.path
    const [result] = await installModapckFromMarket({
      market: 0,
      version: { versionId: v.id, icon: project.value?.icon_url },
    })
    show({
      type: 'upstream',
      modpack: result,
      instancePath,
      upstream: {
        type: 'modrinth-modpack',
        versionId: v.id,
        projectId: props.id,
      }
    })
  } finally {
    updating.value = false
  }
}

const { show: showAddInstanceDialog } = useDialog(AddInstanceDialogKey)
const duplicating = ref(false)
async function onDuplicate(v: ProjectVersionProps) {
  duplicating.value = true

  try {
    const [result] = await installModapckFromMarket({
      market: 0,
      version: { versionId: v.id, icon: project.value?.icon_url },
    })
    showAddInstanceDialog({ format: 'modpack', path: result })
  } finally {
    duplicating.value = false
  }
}

</script>
<template>
  <HomeUpstreamBase
    :items="items"
    :current-version="currentVersion"
    :header="headerData"
    :updating="updating"
    :duplicating="duplicating"
    :only-current-version.sync="onlyCurrentVersion"
    @update="onUpdate"
    @duplicate="onDuplicate"
  />
</template>
