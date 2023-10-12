
<script setup lang="ts">
import { useOptifineVersions } from '@/composables/version'
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
const { versions: optVersions, refreshing, installed } = useOptifineVersions(computed(() => props.runtime.minecraft), computed(() => props.runtime.forge || ''), localVersions)

const selectedVersion = ref(undefined as ModVersion | undefined)
provide('selectedVersion', selectedVersion)

const { render: renderMd } = useMarkdown()
const { data: changelog, isValidating: loadingChangelog } = useSWRV(computed(() => selectedVersion.value && `https://www.optifine.net/changelog?f=OptiFine_${selectedVersion.value.id}.jar`), async (url) => {
  const res = await fetch(url)
  const text = await res.text()
  return renderMd(text)
}, inject(kSWRVConfig))

const versions = computed(() => {
  const files = optVersions.value
  const all: ModVersion[] = files.map((f) => {
    const version = `${f.type}_${f.patch}`
    const id = `${f.mcversion}_${version}`
    const modVersion: ModVersion = reactive({
      id,
      name: version,
      version,
      downloadCount: 0,
      installed: props.runtime.optifine === version,
      loaders: ['vanilla', 'forge'],
      minecraftVersion: f.mcversion,
      type: 'release',
      disabled: false,
      changelog: computed(() => id === selectedVersion.value?.id ? changelog.value : undefined),
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
    if (!runtime.value.forge) {
      await editInstance({
        instancePath: path.value,
        runtime: {
          ...runtime.value,
          optifine: m.version,
        },
      })
      const [mc, type, patch] = m.id.split('_')
      if (installed.value[m.version]) {
        const installedVersion = installed.value[m.version]
        const filePath = localVersions.value.find(v => v.id === installedVersion)?.path
        
      } else {
        const [_, resource] = await installOptifine({ mcversion: mc, type, patch })
      }
    }
  } finally {
    updating.value = false
  }
}

const onDelete = () => {
  const newRuntime = { ...runtime.value, optifine: '' }
  editInstance({
    instancePath: path.value,
    runtime: newRuntime,
  })
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
    :has-more="false"
    :loading-versions="refreshing"
    :loading-dependencies="false"
    @install="onInstall"
    @delete="onDelete"
  />
</template>
