<template>
  <v-card
    ref="root"
    flat
    class="rounded-lg overflow-hidden tabs-card"
  >
    <HomeScreenshotCard
      v-if="selected === 0"
      class="h-full"
      :height="240"
      :instance="instance"
      :galleries="galleries"
    />
    <HomeUpstreamHeader
      v-else-if="headerData"
      class="h-full rounded-t-lg"
      :value="headerData"
      dense
    />
    <div
      class="flex h-full flex-col transition-all duration-500 home-card rounded-lg"
      style="box-sizing: border-box"
    >
      <v-card-text class="flex flex-col gap-2 p-3 pt-2">
        <div class="flex gap-4 items-center">
        <div class="tabs flex gap-4 items-center" :style="{ '--underline-left': underlineLeft + 'px', '--underline-width': underlineWidth + 'px' }">
          <span ref="contentRef" @click="onSelectContent" class="cursor-pointer" :class="{ 'selected': selected === 0 }">
            {{ t('instance.contents') }}
          </span>
          <span v-if="!!upstream" ref="newsRef" @click="onSelectUpdates" class="cursor-pointer" :class="{ 'selected': selected === 1 }">
            {{ t('instance.updates') }}
          </span>
        </div>
          <div class="flex-grow" />
          <div class="controls" style="margin-right: 0.18rem">
            <v-btn icon small @click="onViewDashboard">
              <v-icon size="20" class="rotate-[45deg]">
                unfold_more
              </v-icon>
            </v-btn>
          </div>
        </div>
        <div class="flex flex-col gap-2 transition-all duration-400" :style="(active || dragover) ? { 'height': '136px', overflow: selected === 1 ? 'auto' : 'unset' } : { 'height': '4rem' }">
          <HomeCardListItem
            v-for="item in items"
            :key="item.icon + item.text"
            :icon="item.icon"
            :tooltip="item.tooltip"
            :text="item.text"
            :highlighted="item.highlighted"
            :loading="updating"
            @install="item.install"
            @setting="item.setting"
            @drop="item.drop"
          />
        </div>
      </v-card-text>
      <StoreProjectInstallVersionDialog
        :value="showVersionDialog"
        :versions="dialogVersions"
        :initial-selected-detail="selectedVersion"
        :get-version-detail="getVersionDetail"
        :installing="updating"
        @input="showVersionDialog = $event"
        @install="onInstallVersion"
      />
    </div>
  </v-card>
</template>
<script lang="ts" setup>
import HomeCardListItem from '@/components/HomeCardListItem.vue'
import type { StoreProjectVersion, StoreProjectVersionDetail } from '@/components/StoreProjectInstallVersionDialog.vue'
import StoreProjectInstallVersionDialog from '@/components/StoreProjectInstallVersionDialog.vue'
import { useService } from '@/composables'
import { getCurseforgeProjectFilesModel } from '@/composables/curseforge'
import { kDropHandler } from '@/composables/dropHandler'
import { useUpstreamData } from '@/composables/upstreamData'
import { kInstance } from '@/composables/instance'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kInstanceResourcePacks } from '@/composables/instanceResourcePack'
import { kInstanceSave } from '@/composables/instanceSave'
import { kInstanceShaderPacks } from '@/composables/instanceShaderPack'
import { getModrinthVersionModel } from '@/composables/modrinthVersions'
import { useSWRVModel } from '@/composables/swrv'
import { useInFocusMode } from '@/composables/uiLayout'
import { getCurseforgeFileGameVersions, getCursforgeFileModLoaders } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { useElementHover, useElementSize } from '@vueuse/core'
import { InstanceModsServiceKey, InstanceResourcePacksServiceKey, InstanceSavesServiceKey, InstanceShaderPacksServiceKey, ModpackServiceKey } from '@xmcl/runtime-api'
import HomeScreenshotCard from './HomeScreenshotCard.vue'
import HomeUpstreamHeader from './HomeUpstreamHeader.vue'
import { useDialog } from '@/composables/dialog'
import { InstanceInstallDialog } from '@/composables/instanceUpdate'
import { useDateString } from '@/composables/date'

const { enabledMods } = injection(kInstanceModsContext)
const { enabled: enabledResourcePacks } = injection(kInstanceResourcePacks)
const { shaderPack } = injection(kInstanceShaderPacks)

const isFocus = useInFocusMode()

function onViewDashboard() {
  isFocus.value = false
}

const { push } = useRouter()
const { t } = useI18n()

const { dragover } = injection(kDropHandler)
const { path, instance } = injection(kInstance)

const upstream = computed(() => instance.value?.upstream)
const modrinthProjectId = ref<string>()
const curseforgeProjectId = ref<number>()
const minecraftVersion = computed(() => instance.value?.runtime.minecraft)
const modLoaderType = computed(() => {
  const runtime = instance.value?.runtime
  if (!runtime) return undefined
  if (runtime.forge) return 'forge'
  if (runtime.fabricLoader) return 'fabric'
  if (runtime.neoForged) return 'neoforge'
  if (runtime.quiltLoader) return 'quilt'
  return undefined
})

watch(upstream, (u) => {
  if (u?.type === 'modrinth-modpack') {
    modrinthProjectId.value = u.projectId
  } else {
    modrinthProjectId.value = undefined
  }
  if (u?.type === 'curseforge-modpack') {
    curseforgeProjectId.value = u.modId
  } else {
    curseforgeProjectId.value = undefined
  }
}, { immediate: true })
const modrinthVersions = useSWRVModel(getModrinthVersionModel(modrinthProjectId, undefined, modLoaderType , computed(() => minecraftVersion.value ? [minecraftVersion.value] : undefined)))
const curseforgeModLoaderTypeRef = computed(() => {
  const type = modLoaderType.value
  if (type === 'forge') return 1
  if (type === 'fabric') return 4
  if (type === 'neoforge') return 6
  if (type === 'quilt') return 5
  return undefined
})
const curseforgeFiles = useSWRVModel(getCurseforgeProjectFilesModel(curseforgeProjectId, minecraftVersion , curseforgeModLoaderTypeRef ) )

const showVersionDialog = ref(false)
const selectedVersion = ref<StoreProjectVersion | undefined>(undefined)

const latestVersions = computed(() => {
  if (upstream.value?.type === 'modrinth-modpack') {
    return modrinthVersions.data.value || []
  } else if (upstream.value?.type === 'curseforge-modpack') {
    return (curseforgeFiles.data.value )?.data || []
  }
  return []
})

// Convert versions to StoreProjectVersion format
const dialogVersions = computed(() => {
  if (upstream.value?.type === 'modrinth-modpack') {
    const versions = modrinthVersions.data.value || []
    return versions.map((v): StoreProjectVersion => ({
      id: v.id,
      name: v.name,
      version_type: v.version_type,
      game_versions: v.game_versions,
      loaders: v.loaders,
    }))
  } else if (upstream.value?.type === 'curseforge-modpack') {
    const versions = (curseforgeFiles.data.value)?.data || []
    return versions.map((v): StoreProjectVersion => ({
      id: v.id.toString(),
      name: v.displayName,
      version_type: v.releaseType === 1 ? 'release' : v.releaseType === 2 ? 'beta' : 'alpha',
      game_versions: getCurseforgeFileGameVersions(v),
      loaders: getCursforgeFileModLoaders(v),
    }))
  }
  return []
})

// Get version detail for the dialog
async function getVersionDetail(version: StoreProjectVersion): Promise<StoreProjectVersionDetail> {
  if (upstream.value?.type === 'modrinth-modpack') {
    const target = (modrinthVersions.data.value || []).find(v => v.id === version.id)
    if (!target) return { changelog: '', dependencies: [], version }
    
    const projects = target.dependencies?.map(v => v.project_id).filter(v => !!v) || []
    const lookup = Object.fromEntries(target.dependencies?.map(p => [p.project_id, p.dependency_type]) || [])
    
    try {
      const { clientModrinthV2 } = await import('@/util/clients')
      const matched = projects.length > 0 ? await clientModrinthV2.getProjects(projects) : []
      const dependencies = matched.map((p) => ({
        title: p.title,
        description: p.description,
        icon: p.icon_url ?? '',
        href: `https://modrinth.com/${p.project_type}/${p.slug}`,
        dependencyType: lookup[p.id] || 'optional',
      }))
      return {
        version,
        changelog: target.changelog ?? '',
        dependencies,
      }
    } catch (e) {
      console.error(e)
      return { changelog: target.changelog ?? '', dependencies: [], version }
    }
  } else if (upstream.value?.type === 'curseforge-modpack') {
    const target = ((curseforgeFiles.data.value)?.data || []).find(v => v.id.toString() === version.id)
    if (!target) return { changelog: '', dependencies: [], version }
    
    try {
      const { clientCurseforgeV1 } = await import('@/util/clients')
      const { FileRelationType } = await import('@xmcl/curseforge')
      
      const mapping = {
        [FileRelationType.EmbeddedLibrary]: 'embedded',
        [FileRelationType.Include]: 'embedded',
        [FileRelationType.RequiredDependency]: 'required',
        [FileRelationType.OptionalDependency]: 'optional',
        [FileRelationType.Tool]: 'optional',
        [FileRelationType.Incompatible]: 'incompatible',
      }
      const lookup = Object.fromEntries(target.dependencies?.map(p => [p.modId, mapping[p.relationType]]) || [])
      const detail = target.dependencies && target.dependencies.length > 0
        ? await clientCurseforgeV1.getMods(target.dependencies.map(d => d.modId))
        : []
      const dependencies = detail.map(d => ({
        title: d.name,
        description: d.summary,
        icon: d.logo?.url || '',
        href: d?.links.websiteUrl ?? '',
        dependencyType: lookup[d.id] || 'optional',
      }))
      
      // Fetch changelog
      let changelog = ''
      if (curseforgeProjectId.value) {
        try {
          const changelogHtml = await clientCurseforgeV1.getModFileChangelog(curseforgeProjectId.value, target.id)
          changelog = changelogHtml
        } catch (e) {
          console.error('Failed to fetch changelog:', e)
        }
      }
      
      return {
        changelog,
        dependencies,
        version,
      }
    } catch (e) {
      console.error(e)
      return { changelog: '', dependencies: [], version }
    }
  }
  
  return { changelog: '', dependencies: [], version }
}

const { headerData, galleries } = useUpstreamData()

const root = ref<HTMLElement | null>(null)
const active = useElementHover(root)

const contentRef = ref<HTMLElement>()
const newsRef = ref<HTMLElement>()
const contentSize = useElementSize(contentRef)
function noop(v: any) {
}

const underlineLeft = computed(() => {
  const current = contentSize.width.value
  noop(current)
  if (selected.value === 0) return 0
  const contentWidth = contentRef.value?.offsetWidth || 0
  return contentWidth + 16
})

const underlineWidth = computed(() => {
  const current = contentSize.width.value
  noop(current)
  if (selected.value === 0) return contentRef.value?.offsetWidth || 0
  return newsRef.value?.offsetWidth || 0
})

const { install: installMod } = useService(InstanceModsServiceKey)
function onDropMod(e: DragEvent) {
  if (e.dataTransfer) {
    const filePaths = Array.from(e.dataTransfer.files).map(f => f.path)
    installMod({
      path: path.value,
      files: filePaths,
    })
    e.preventDefault()
  }
}

const { install: installResourcePack } = useService(InstanceResourcePacksServiceKey)
function onDropResourcePack(e: DragEvent) {
  if (e.dataTransfer) {
    const filePaths = Array.from(e.dataTransfer.files).map(f => f.path)
    installResourcePack({ path: path.value, files: filePaths })
    e.preventDefault()
  }
}

const { install: installShaderPack } = useService(InstanceShaderPacksServiceKey)
function onDropShaderPack(e: DragEvent) {
  if (e.dataTransfer) {
    const filePaths = Array.from(e.dataTransfer.files).map(f => f.path)
    installShaderPack({ path: path.value, files: filePaths })
    e.preventDefault()
  }
}

const { saves } = injection(kInstanceSave)
const savesLength = computed(() => saves.value.length)
const { importSave } = useService(InstanceSavesServiceKey)
function onDropSave(e: DragEvent) {
  if (e.dataTransfer) {
    const filePaths = Array.from(e.dataTransfer.files).map(f => f.path)
    importSave({ instancePath: path.value, path: filePaths[0] })
    e.preventDefault()
  }
}

// Install version handler
const { show: showInstallDialog } = useDialog(InstanceInstallDialog)
const updating = ref(false)
const { installModapckFromMarket } = useService(ModpackServiceKey)
async function onInstallVersion(v: StoreProjectVersion) {
  if (updating.value) return
  try {
    updating.value = true
    const instancePath = instance.value.path
    const [modpack] = await installModapckFromMarket(upstream.value?.type === 'curseforge-modpack' ? {
      market: 1,
      file: { fileId: Number(v.id), icon: headerData.value?.icon || '' },
    } : {
      market: 0,
      version: { versionId: v.id, icon: headerData.value?.icon || '' }
    })
    showVersionDialog.value = false
    showInstallDialog({
      type: 'upstream',
      modpack,
      instancePath,
      upstream: upstream.value?.type === 'curseforge-modpack' ? {
        type: 'curseforge-modpack',
        modId: curseforgeProjectId.value || 0,
        fileId: Number(v.id),
      } : {
        type: 'modrinth-modpack',
        projectId: modrinthProjectId.value || '',
        versionId: v.id,
      }
    })
  } finally {
    updating.value = false
  }
}

const { getDateString } = useDateString()
const items = computed(() => {
  if (selected.value === 0) {
    return [
      {
        icon: 'extension',
        tooltip: t('mod.name'),
        text: dragover.value ? t('mod.dropHint') : t('mod.enabled', { count: enabledMods.value.length }),
        highlighted: false,
        install: () => push('/mods?source=remote'),
        setting: () => push('/mods'),
        drop: onDropMod
      },
      {
        icon: 'palette',
        tooltip: t('resourcepack.name'),
        text: dragover.value ? t('resourcepack.dropHint') : t('resourcepack.enable', { count: enabledResourcePacks.value.length }),
        highlighted: false,
        install: () => push('/resourcepacks?source=remote'),
        setting: () => push('/resourcepacks'),
        drop: onDropResourcePack
      },
      {
        icon: 'gradient',
        tooltip: t('shaderPack.name'),
        text: dragover.value ? t('shaderPack.dropHint') : !shaderPack.value ? t('shaderPack.empty') : shaderPack.value,
        highlighted: false,
        install: () => push('/shaderpacks?source=remote'),
        setting: () => push('/shaderpacks'),
        drop: onDropShaderPack
      },
      {
        icon: 'map',
        tooltip: t('save.name'),
        text: dragover.value ? t('save.dropHint') : t('save.createdWorlds', { count: savesLength.value }),
        highlighted: false,
        install: () => push('/save?source=remote'),
        setting: () => push('/save'),
        drop: onDropSave
      }
    ]
  } else if (selected.value === 1) {
    return latestVersions.value.map((v) => {
      const version: StoreProjectVersion = 'name' in v ? {
        id: v.id,
        name: v.name,
        version_type: v.version_type,
        game_versions: v.game_versions,
        loaders: v.loaders,
      } : {
        id: v.id.toString(),
        name: v.displayName,
        version_type: v.releaseType === 1 ? 'release' : v.releaseType === 2 ? 'beta' : 'alpha',
        game_versions: getCurseforgeFileGameVersions(v),
        loaders: getCursforgeFileModLoaders(v),
      }
      return {
        icon: 'update',
        tooltip: getDateString('fileDate' in v ? v.fileDate : v.date_published),
        text: 'name' in v ? v.name : v.displayName,
        highlighted: upstream.value?.type === 'modrinth-modpack' && upstream.value.versionId === v.id || upstream.value?.type === 'curseforge-modpack' && upstream.value.fileId === v.id,
        install: () => {
          onInstallVersion(version)
          showVersionDialog.value = false
        },
        setting: () => {
          selectedVersion.value = version
          showVersionDialog.value = true
        },
        drop: () => {}
      }
    })
  } else {
    return [{
      icon: 'extension',
      tooltip: t('mod.name'),
      text: dragover.value ? t('mod.dropHint') : t('mod.enabled', { count: enabledMods.value.length }),
      highlighted: false,
      install: () => push('/mods?source=remote'),
      setting: () => push('/mods'),
      drop: onDropMod
    }]
  }
})

const selected = ref(0)
function onSelectContent() {
  selected.value = 0
}

function onSelectUpdates() {
  selected.value = 1
}
watch(instance, () => {
  selected.value = 0
})
</script>
<style scoped>
.tabs-card>.icons, .tabs-card>.tabs-items {
transition: all 0.2s ease-in-out;
  opacity: 0;
}

.dark .controls .v-icon {
  color: var(--icon-color);
}

.dark .controls .v-icon:hover {
  color: var(--icon-color-hovered);
}

.tabs {
  position: relative;
}

.tabs::after {
  content: '';
  position: absolute;
  bottom: -2px;
  height: 3px;
  background: var(--highlight-color);
  border-radius: 2px;
  left: var(--underline-left);
  width: var(--underline-width);
  transition: left 0.3s ease, width 0.3s ease;
}

.tabs-card {
  max-width: 450px;
  min-width: 450px;
}

.tabs-card>.icons, .tabs-card>.tabs-items {
transition: all 0.2s ease-in-out;
  opacity: 0;
}

.dark .tabs-card>.icons .v-icon {
  color: var(--icon-color);
}

.dark .tabs-card>.icons .v-icon:hover {
  color: var(--icon-color-hovered);
}

.visibled {
  opacity: 1 !important;
}

.tabs {
  @apply rounded-md!;
  margin-bottom: 0.125rem;
}

.tabs-items, .tabs-items .v-window-item {
  min-height: 8rem;
  max-height: 8rem;
  height: 8rem;
}
</style>
