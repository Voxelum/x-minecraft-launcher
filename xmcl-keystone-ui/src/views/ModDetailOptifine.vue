<script setup lang="ts">
import MarketProjectDetail, { ProjectDetail } from '@/components/MarketProjectDetail.vue'
import { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { useMarkdown } from '@/composables/markdown'
import { useProjectDetailEnable } from '@/composables/projectDetail'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { useOptifineVersions } from '@/composables/version'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { ProjectEntry } from '@/util/search'
import { InstallServiceKey, InstanceModsServiceKey, InstanceServiceKey, RuntimeVersions } from '@xmcl/runtime-api'
import useSWRV from 'swrv'

const props = defineProps<{
  mod: ProjectEntry<ModFile>
  runtime: RuntimeVersions
}>()

const { versions: optVersions, isValidating } = useOptifineVersions()

const selectedVersion = ref(undefined as ProjectVersion | undefined)
provide('selectedVersion', selectedVersion)

const { render: renderMd } = useMarkdown()
const { data: changelog, isValidating: loadingChangelog } = useSWRV(computed(() => selectedVersion.value && `https://www.optifine.net/changelog?f=OptiFine_${selectedVersion.value.id}.jar`), async (url) => {
  const res = await fetch(url)
  const text = await res.text()
  const [content] = text.split('\r\n\r\n')
  return renderMd(content)
}, inject(kSWRVConfig))

const versions = computed(() => {
  const files = optVersions.value
  const all: ProjectVersion[] = files.filter(f => f.mcversion === props.runtime.minecraft).map((f) => {
    const version = `${f.type}_${f.patch}`
    const id = `${f.mcversion}_${version}`
    const modVersion: ProjectVersion = reactive({
      id: props.mod.installed[0]?.version === version ? props.mod.installed[0].path : id,
      name: version,
      version,
      downloadCount: 0,
      installed: computed(() => {
        if (props.runtime.optifine === version) return true
        if (props.mod.installed.length > 0 && props.mod.installed[0].version === version) return true
        return false
      }),
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

selectedVersion.value = versions.value.find(v => v.installed) ?? versions.value[0]

const { data: optifineHome, isValidating: loadingDescription } = useSWRV('/optifine-home', async () => {
  const response = await fetch('https://www.optifine.net/home')
  const content = await response.text()
  const parsed = new DOMParser().parseFromString(content, 'text/html')
  const contentHTML = parsed.querySelector('.content')
  return contentHTML?.innerHTML || ''
}, inject(kSWRVConfig))
const _optifineHome = computed(() => optifineHome.value || props.mod.description)

const model = computed(() => {
  const result: ProjectDetail = reactive({
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
    htmlContent: _optifineHome,
    modLoaders: [],
    installed: computed(() => props.mod.installed.length > 0),
    enabled: false,
  })
  return result
})

const { editInstance } = useService(InstanceServiceKey)
const { installOptifineAsResource } = useService(InstallServiceKey)
const { path } = injection(kInstance)
const updating = ref(false)
const { install: installMod, uninstall: uninstallMod } = useService(InstanceModsServiceKey)
const onInstall = async (m: ProjectVersion) => {
  try {
    updating.value = true
    const [mc, ...rest] = m.id.split('_')
    const restStr = rest.join('_')
    const index = restStr.lastIndexOf('_')
    const type = restStr.substring(0, index)
    const patch = restStr.substring(index + 1)

    if (!props.runtime.forge) {
      await editInstance({
        instancePath: path.value,
        runtime: {
          ...props.runtime,
          optifine: m.version,
        },
      })
    } else {
      if (hasInstalledVersion.value) {
        const oldFiles = props.mod.installed.map(i => i.resource)
        const resource = await installOptifineAsResource({ mcversion: mc, type, patch })
        await installMod({ path: path.value, mods: [resource] })
        await uninstallMod({ path: path.value, mods: oldFiles })
      } else {
        const resource = await installOptifineAsResource({ mcversion: mc, type, patch })
        await installMod({ path: path.value, mods: [resource] })
      }
    }
  } finally {
    updating.value = false
  }
}

const onDelete = () => {
  if (props.runtime.optifine) {
    const newRuntime = { ...props.runtime, optifine: '' }
    editInstance({
      instancePath: path.value,
      runtime: newRuntime,
    })
  }

  if (props.mod.installed.length > 0) {
    uninstallMod({ path: path.value, mods: props.mod.installed.map(i => i.resource) })
  }
}
const { enabled, installed, hasInstalledVersion } = useProjectDetailEnable(
  selectedVersion,
  computed(() => props.mod.installed),
  updating,
  () => { },
  () => { },
)

</script>
<template>
  <MarketProjectDetail
    :detail="model"
    :dependencies="[]"
    :enabled="enabled"
    :selected-installed="runtime.optifine === selectedVersion?.version || installed"
    :loading="loadingDescription"
    :versions="versions"
    :updating="updating"
    no-enabled
    :has-more="false"
    :loading-versions="isValidating"
    :loading-dependencies="false"
    @install="onInstall"
    @delete="onDelete"
  />
</template>
