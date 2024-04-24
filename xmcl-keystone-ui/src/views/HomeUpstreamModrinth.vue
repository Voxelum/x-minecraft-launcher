<script lang="ts" setup>
import { useService } from '@/composables'
import { useLocalStorageCacheBool } from '@/composables/cache'
import { useDateString } from '@/composables/date'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { InstanceInstallDialog } from '@/composables/instanceUpdate'
import { useMarkdown } from '@/composables/markdown'
import { kModrinthTags } from '@/composables/modrinth'
import { useModrinthInstanceResource } from '@/composables/modrinthInstanceResource'
import { getModrinthProjectModel } from '@/composables/modrinthProject'
import { getModrinthVersionModel } from '@/composables/modrinthVersions'
import { useSWRVModel } from '@/composables/swrv'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { ModrinthServiceKey, ModrinthUpstream } from '@xmcl/runtime-api'
import HomeUpstreamBase from './HomeUpstreamBase.vue'
import { UpstreamHeaderProps } from './HomeUpstreamHeader.vue'
import { ProjectVersionProps } from './HomeUpstreamVersion.vue'

const props = defineProps<{
  id: string
}>()

const { instance } = injection(kInstance)
const upstream = computed(() => instance.value?.upstream as ModrinthUpstream)

const { t } = useI18n()
const { data: project } = useSWRVModel(getModrinthProjectModel(computed(() => props.id)))
const { categories } = injection(kModrinthTags)
const { getDateString } = useDateString()
const headerData = computed(() => {
  if (!project.value) return undefined
  const result: UpstreamHeaderProps = {
    url: `https://modrinth.com/${project.value.project_type}/${project.value.slug}`,
    icon: project.value?.icon_url || '',
    title: project.value?.title || '',
    description: project.value?.description || '',
    categories: project.value.categories.map((c) => {
      const cat = categories.value.find(cat => cat.name === c)
      return {
        text: t(`modrinth.categories.${cat?.name}`) || '',
        icon: cat?.icon || '',
      }
    }),
    type: 'modrinth',
    store: '/store/modrinth/' + project.value.id,
    infos: [{
      icon: 'file_download',
      name: t('modrinth.downloads'),
      value: getExpectedSize(project.value.downloads, ''),
    }, {
      icon: 'star_rate',
      name: t('modrinth.followers'),
      value: project.value.followers,
    }, {
      icon: 'event',
      name: t('modrinth.createAt'),
      value: getDateString(project.value.published),
    }, {
      icon: 'update',
      name: t('modrinth.updateAt'),
      value: getDateString(project.value.updated),
    }],
  }

  return result
})
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
    result[date].push({
      id: d.id,
      name: d.name,
      versionType: d.version_type as any,
      versionNumber: d.version_number,
      loaders: d.loaders,
      gameVersions: d.game_versions,
      datePublished: (d.date_published),
      downloads: d.downloads,
      changelog: d.changelog ? render(d.changelog) : '',
    })
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
const { installVersion } = useService(ModrinthServiceKey)
const { getResourceByUpstream, getResourceByVersion } = useModrinthInstanceResource()
const updating = ref(false)
async function onUpdate(v: ProjectVersionProps) {
  updating.value = true

  try {
    const resource = await getResourceByUpstream(upstream.value)
    const nextVersion = data.value?.find(d => d.id === v.id)
    if (!nextVersion) return
    let newResource = await getResourceByVersion(nextVersion)
    if (!newResource) {
      // download
      const result = await installVersion({
        version: nextVersion,
        icon: project.value?.icon_url || '',
      })
      newResource = result.resources[0]
    }
    show({
      type: 'modrinth',
      currentResource: resource,
      resource: newResource,
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
    const nextVersion = data.value?.find(d => d.id === v.id)
    if (!nextVersion) return
    let newResource = await getResourceByVersion(nextVersion)
    if (!newResource) {
      // download
      const result = await installVersion({
        version: nextVersion,
        icon: project.value?.icon_url || '',
      })
      newResource = result.resources[0]
    }
    showAddInstanceDialog({ type: 'resource', resource: newResource })
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
