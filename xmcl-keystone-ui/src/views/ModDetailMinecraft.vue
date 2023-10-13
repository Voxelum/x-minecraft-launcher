
<script setup lang="ts">
import { useMinecraftVersions, useOptifineVersions } from '@/composables/version'
import { Mod } from '@/util/mod'
import { InstallServiceKey, InstanceServiceKey, ResourceDomain, ResourceServiceKey, RuntimeVersions } from '@xmcl/runtime-api'
import { ModVersion } from './ModDetailVersion.vue'
import ModDetail, { ModDetailData } from './ModDetail.vue'
import useSWRV from 'swrv'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { useMarkdown } from '@/composables/markdown'
import { useService } from '@/composables'
import { injection } from '@/util/inject'
import { kInstance } from '@/composables/instance'
import { kLocalVersions } from '@/composables/versionLocal'

const props = defineProps<{
  mod: Mod
  runtime: RuntimeVersions
}>()

const { versions: localVersions } = injection(kLocalVersions)
const { versions: mcVersions, refreshing, installed } = useMinecraftVersions(localVersions)

const selectedVersion = ref(undefined as ModVersion | undefined)
provide('selectedVersion', selectedVersion)

const { render: renderMd } = useMarkdown()
const { data: changelog, isValidating: loadingChangelog } = useSWRV(computed(() => selectedVersion.value && `https://www.optifine.net/changelog?f=OptiFine_${selectedVersion.value.id}.jar`), async (url) => {
  const res = await fetch(url)
  const text = await res.text()
  return renderMd(text)
}, inject(kSWRVConfig))

const versions = computed(() => {
  const versions = mcVersions.value
  const all: ModVersion[] = versions.map((v) => {
    const version = v.id
    const id = v.id
    const modVersion: ModVersion = reactive({
      id,
      name: version,
      version,
      downloadCount: 0,
      installed: props.runtime.minecraft === version,
      loaders: ['vanilla'],
      minecraftVersion: v.id,
      type: 'release',
      disabled: false,
      changelog: '',
      changelogLoading: loadingChangelog,
    })
    return modVersion
  })
  return all.reverse()
})

selectedVersion.value = versions.value[0]

const model = computed(() => {
  const result: ModDetailData = reactive({
    id: props.mod.id,
    icon: props.mod.icon,
    title: props.mod.title,
    description: props.mod.description,
    categories: [],
    externals: [],
    info: [],
    galleries: [],
    author: props.mod.author,
    downloadCount: 0,
    follows: 0,
    url: 'https://www.optifine.net/home',
    htmlContent: props.mod.description,
    installed: !!props.mod.installed,
    enabled: false,
  })
  return result
})

const { editInstance } = useService(InstanceServiceKey)
const { installOptifine } = useService(InstallServiceKey)
const { getResourcesByUris } = useService(ResourceServiceKey)
const { path, runtime } = injection(kInstance)
const updating = ref(false)
const onInstall = async (m: ModVersion) => {
  try {
    updating.value = true
    await editInstance({
      instancePath: path.value,
      runtime: {
        ...runtime.value,
        minecraft: m.version,
      },
    })
  } finally {
    updating.value = false
  }
}

</script>
<template>
  <ModDetail
    :detail="model"
    :dependencies="[]"
    :enabled="false"
    :has-installed-version="!!runtime.optifine"
    :selected-installed="runtime.optifine === selectedVersion?.version"
    :loading="false"
    :versions="versions"
    :updating="false"
    no-enabled
    no-delete
    :has-more="false"
    :loading-versions="refreshing"
    :loading-dependencies="false"
    @install="onInstall"
  />
</template>
