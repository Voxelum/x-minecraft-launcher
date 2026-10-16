<template>
  <div>
    <!-- Mod Loader Selection Header with Manage Button (Developer Mode Only) -->
    <div class="flex items-center justify-between my-4">
      <div class="text-sm font-bold opacity-70">{{ t('modrinth.categories.modloader') }}</div>
      <v-btn
        v-if="developerMode"
        variant="text"
        density="compact"
        size="small"
        class="text-xs opacity-75 hover:opacity-100"
        prepend-icon="tune"
        @click="showManageDialog = true"
      >
        {{ t('modloader.manage') }}
      </v-btn>
    </div>

    <!-- Cards Row -->
    <div class="flex flex-wrap gap-3 mb-6 items-center justify-center">
      <v-card
        v-for="loader in displayLoaders"
        :key="loader.id"
        :data-testid="`modloader-tab-${loader.id}`"
        :variant="currentTab === loader.id ? 'outlined' : 'tonal'"
        :color="currentTab === loader.id ? 'primary' : undefined"
        class="flex-1 min-w-[80px] max-w-[120px] flex flex-col items-center justify-center py-4 cursor-pointer hover:bg-white/5 transition-colors border-2"
        :style="{ borderColor: currentTab === loader.id ? 'rgba(var(--v-theme-primary), 1)' : 'transparent' }"
        tabindex="0"
        data-gamepad-focusable
        @click="selectLoader(loader.id)"
        @keydown.enter.prevent="selectLoader(loader.id)"
      >
        <img :src="loader.icon" width="36" height="36" class="mb-2 transition-transform hover:scale-110 object-contain" />
        <span class="text-xs font-semibold truncate max-w-[90px] px-1">{{ loader.name }}</span>
      </v-card>
    </div>

    <!-- Versions -->
    <VersionInputMinecraft
      v-if="showMinecraft"
      data-testid="version-input-minecraft"
      class="mb-4"
      :value="data.runtime.minecraft"
      :supported-versions="supportedMinecraftVersions"
      @input="onSelectMinecraft"
    />

    <v-expand-transition>
      <div v-if="currentTab !== 'vanilla'">
        <VersionInputNeoForged
          v-if="currentTab === 'neoforge'"
          data-testid="version-input-neoforge"
          :value="data.runtime.neoForged"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          :auto-select-latest="autoSelectLatestOnClick"
          @input="onSelectNeoForged"
        />
        <VersionInputForge
          v-else-if="currentTab === 'forge'"
          data-testid="version-input-forge"
          :value="data.runtime.forge"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          :auto-select-latest="autoSelectLatestOnClick"
          @input="onSelectForge"
        />
        <VersionInputFabric
          v-else-if="currentTab === 'fabric'"
          data-testid="version-input-fabric"
          :value="data.runtime.fabricLoader"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          :auto-select-latest="autoSelectLatestOnClick"
          @input="onSelectFabric"
        />
        <VersionInputQuilt
          v-else-if="currentTab === 'quilt'"
          data-testid="version-input-quilt"
          :value="data.runtime.quiltLoader"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          :auto-select-latest="autoSelectLatestOnClick"
          @input="onSelectQuilt"
        />
        <VersionInputOptifine
          v-else-if="currentTab === 'optifine'"
          :value="data.runtime.optifine"
          :forge="data.runtime.forge || ''"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          :auto-select-latest="true"
          @input="onSelectOptifine"
        />
        <VersionInputLabymod
          v-else-if="currentTab === 'labymod'"
          :value="data.runtime.labyMod"
          :minecraft="data.runtime.minecraft"
          :versions="versions"
          :auto-select-latest="autoSelectLatestOnClick"
          @input="onSelectLabyMod"
        />

        <!-- Custom Loader from API Version Selector -->
        <VersionInput
          v-else-if="currentCustomLoader"
          :icon="currentCustomLoader.icon"
          :title="currentCustomLoader.name"
          :url="currentCustomLoader.apiUrl || currentCustomLoader.name"
          :is-clearable="true"
          :items="customLoaderVersionItems"
          :clear-text="t('localVersion.auto')"
          :empty-text="t('modloader.emptyCustom')"
          :placeholder="selectedCustomVersion || t('localVersion.auto')"
          :auto-select="autoSelectLatestOnClick ? (customLoaderVersionItems[0]?.name ?? undefined) : undefined"
          :value="selectedCustomVersion"
          @refresh="refreshLoaderVersions(currentCustomLoader.id)"
          @input="onSelectCustomLoaderVersion"
        />
      </div>
    </v-expand-transition>

    <VersionInputLocal
      v-if="showLocal"
      class="mt-4"
      :value="currentTab === 'local' ? data.version : ''"
      :versions="versions"
      :placeholder="localPlaceholder"
      @input="onSelectLocalVersion"
    />

    <!-- Manage Modloaders Dialog (Developer Mode Only) -->
    <ModloaderCustomDialog v-if="developerMode" v-model="showManageDialog" />
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import VersionInput, { VersionItem } from '@/components/VersionInput.vue'
import VersionInputFabric from '@/components/VersionInputFabric.vue'
import VersionInputForge from '@/components/VersionInputForge.vue'
import VersionInputLabymod from '@/components/VersionInputLabymod.vue'
import VersionInputLocal from '@/components/VersionInputLocal.vue'
import VersionInputMinecraft from '@/components/VersionInputMinecraft.vue'
import VersionInputNeoForged from '@/components/VersionInputNeoForged.vue'
import VersionInputOptifine from '@/components/VersionInputOptifine.vue'
import { KNOWN_OPTIFINE_BUILDS } from '@/util/optifine'
import VersionInputQuilt from '@/components/VersionInputQuilt.vue'
import ModloaderCustomDialog from '@/components/ModloaderCustomDialog.vue'
import { BuiltinImages } from '@/constant'
import { useService } from '@/composables'
import { kInstanceCreation } from '@/composables/instanceCreation'
import { useInstanceEditVersions } from '@/composables/instanceEdit'
import { useModloadersCustom, DEFAULT_LOADER_IDS, KNOWN_LOADER_METAS, KNOWN_LOADER_ICONS, resolveFabricCustomLoader } from '@/composables/modloaderCustom'
import { useSettings } from '@/composables/setting'
import { useOptifineVersions, getLatestNeoforge } from '@/composables/version'
import { VersionHeader, VersionMetadataServiceKey } from '@xmcl/runtime-api'
import type { InstanceData } from '@xmcl/instance'

const props = withDefaults(defineProps<{
  data: Pick<InstanceData, 'runtime' | 'version'> & { icon?: string }
  versions: VersionHeader[]
  showMinecraft?: boolean
  showLocal?: boolean
  localPlaceholder?: string
  autoSelectLatestOnClick?: boolean
}>(), {
  showMinecraft: true,
  showLocal: true,
  localPlaceholder: undefined,
  autoSelectLatestOnClick: false,
})

const { t } = useI18n()
const { developerMode } = useSettings()

const creationContext = inject(kInstanceCreation, undefined)
const currentCustomLoaderFilePath = ref<string | undefined>()

function clearCreationFiles() {
  if (creationContext?.files && currentCustomLoaderFilePath.value) {
    creationContext.files.value = creationContext.files.value.filter(
      (f) => f.path !== currentCustomLoaderFilePath.value,
    )
    currentCustomLoaderFilePath.value = undefined
  }
}

const versions = toRef(props, 'versions')

const {
  onSelectMinecraft: rawOnSelectMinecraft,
  onSelectNeoForged: rawOnSelectNeoForged,
  onSelectForge: rawOnSelectForge,
  onSelectFabric: rawOnSelectFabric,
  onSelectQuilt: rawOnSelectQuilt,
  onSelectOptifine: rawOnSelectOptifine,
  onSelectLabyMod: rawOnSelectLabyMod,
  onSelectLocalVersion: rawOnSelectLocalVersion,
} = useInstanceEditVersions(props.data, versions)

function onSelectMinecraft(version: string) {
  rawOnSelectMinecraft(version)
  if (currentTab.value === 'optifine') {
    const latestBuild = KNOWN_OPTIFINE_BUILDS.find((b) => b.mcversion === version)
    const versionString = latestBuild ? `${latestBuild.type}_${latestBuild.patch}` : ''
    onSelectOptifine(versionString)
  } else if (currentCustomLoader.value) {
    const custom = currentCustomLoader.value
    if (custom.versions && custom.versions.length > 0) {
      const match = custom.versions.find((v) => v.gameVersions?.some((g) => g.toLowerCase() === version.toLowerCase())) ||
        custom.versions[0]
      if (match) {
        onSelectCustomLoaderVersion(match.version)
      }
    }
  }
}

function onSelectNeoForged(v: string) {
  clearCreationFiles()
  rawOnSelectNeoForged(v)
}
function onSelectForge(v: string) {
  clearCreationFiles()
  rawOnSelectForge(v)
}
function onSelectFabric(v: string) {
  clearCreationFiles()
  rawOnSelectFabric(v)
}
function onSelectQuilt(v: string) {
  clearCreationFiles()
  rawOnSelectQuilt(v)
}
function onSelectOptifine(v: string) {
  clearCreationFiles()
  rawOnSelectOptifine(v)
}
function onSelectLabyMod(v: string) {
  clearCreationFiles()
  rawOnSelectLabyMod(v)
}
function onSelectLocalVersion(v: string) {
  clearCreationFiles()
  rawOnSelectLocalVersion(v)
}

const {
  allLoaders,
  visibleLoaders,
  refreshLoaderVersions,
} = useModloadersCustom()

const displayLoaders = computed(() => {
  if (!creationContext) {
    return visibleLoaders.value.filter((l) => l.projectType !== 'mod')
  }
  return visibleLoaders.value
})

const showManageDialog = ref(false)
const currentTab = ref('vanilla')
const pendingLoader = ref<string | undefined>()
const selectedCustomVersion = ref('')

const isBuiltin = computed(() => DEFAULT_LOADER_IDS.includes(currentTab.value))

const currentCustomLoader = computed(() => {
  if (isBuiltin.value) return undefined
  return allLoaders.value.find((l) => l.id === currentTab.value)
})

const { versions: optifineVersions } = useOptifineVersions()

const optifineSupportedMcVersions = computed(() => {
  const set = new Set<string>()
  for (const b of KNOWN_OPTIFINE_BUILDS) {
    const mc = b.mcversion.endsWith('.0') ? b.mcversion.slice(0, -2) : b.mcversion
    set.add(mc)
  }
  for (const v of optifineVersions.value) {
    const mc = v.mcversion.endsWith('.0') ? v.mcversion.slice(0, -2) : v.mcversion
    set.add(mc)
  }
  return Array.from(set)
})

const supportedMinecraftVersions = computed<string[] | undefined>(() => {
  if (currentTab.value === 'optifine') {
    return optifineSupportedMcVersions.value
  }
  if (currentCustomLoader.value?.gameVersions && currentCustomLoader.value.gameVersions.length > 0) {
    return currentCustomLoader.value.gameVersions
  }
  if (KNOWN_LOADER_METAS[currentTab.value]?.gameVersions) {
    return KNOWN_LOADER_METAS[currentTab.value].gameVersions
  }
  return undefined
})

const customLoaderVersionItems = computed<VersionItem[]>(() => {
  if (!currentCustomLoader.value) return []
  const loader = currentCustomLoader.value

  // 1. If loader has API versions, display them!
  if (loader.versions && loader.versions.length > 0) {
    const currentMc = props.data.runtime.minecraft
    const filtered = (currentMc && loader.versions.some((v) => v.gameVersions && v.gameVersions.length > 0))
      ? loader.versions.filter((v) => !v.gameVersions || v.gameVersions.some((g) => g.toLowerCase() === currentMc.toLowerCase()))
      : loader.versions

    const finalVers = filtered.length > 0 ? filtered : loader.versions
    return finalVers.map((v) => ({
      name: v.version,
      tag: v.stable ? t('fabricVersion.stable') : t('fabricVersion.unstable'),
      tagColor: v.stable ? 'primary' : undefined,
    }))
  }

  // 2. Otherwise only match versions that actually contain this loader's id (do NOT dump all local instances)
  const pattern = loader.id.toLowerCase()
  const matching: VersionItem[] = []

  for (const ver of versions.value) {
    const isMatch = (
      ver.id.toLowerCase().includes(pattern) ||
      (ver.minecraft && ver.minecraft.toLowerCase().includes(pattern))
    )
    if (isMatch) {
      matching.push({
        name: ver.id,
        tag: ver.minecraft || 'Local',
        tagColor: 'primary',
      })
    }
  }

  return matching
})

const metadata = useService(VersionMetadataServiceKey)

let modLoaderSelectionToken = 0

async function handleModBasedLoader(loaderId: string, versionStr?: string) {
  if (!creationContext) return
  const token = ++modLoaderSelectionToken

  const custom = allLoaders.value.find((l) => l.id === loaderId)
  if (!custom) return
  if (DEFAULT_LOADER_IDS.includes(custom.id)) return
  if (custom.projectType !== 'mod') return

  // 1. Resolve verObj first
  let verObj = custom.versions?.find((v) => v.version === versionStr) || custom.versions?.[0]
  if (!verObj?.fileUrl && custom.id) {
    try {
      const res = await fetch(`https://api.modrinth.com/v2/project/${custom.id}/version`)
      if (token !== modLoaderSelectionToken || currentTab.value !== loaderId) return
      if (res.ok) {
        const verData = await res.json()
        if (token !== modLoaderSelectionToken || currentTab.value !== loaderId) return
        if (Array.isArray(verData) && verData.length > 0) {
          const match = (versionStr ? verData.find((v: any) => (v.version_number || v.name || v.id) === versionStr) : verData[0]) || verData[0]
          const file = match.files?.find((f: any) => f.primary) || match.files?.[0]
          if (file) {
            verObj = {
              version: String(match.version_number || match.name || match.id),
              fileUrl: file.url,
              fileName: file.filename,
              size: file.size,
              sha1: file.hashes?.sha1,
              gameVersions: match.game_versions,
              loaders: match.loaders,
            }
          }
        }
      }
    } catch {}
  }

  if (token !== modLoaderSelectionToken || currentTab.value !== loaderId) return

  // 2. Adapt Minecraft version using artifact metadata or custom loader fallback
  const supportedGames = verObj?.gameVersions && verObj.gameVersions.length > 0
    ? verObj.gameVersions
    : custom.gameVersions
  if (supportedGames && supportedGames.length > 0) {
    const currentMc = props.data.runtime.minecraft
    if (!currentMc || !supportedGames.some((g) => g.toLowerCase() === currentMc.toLowerCase())) {
      props.data.runtime.minecraft = supportedGames[0]
      if (creationContext?.data?.runtime) {
        creationContext.data.runtime.minecraft = supportedGames[0]
      }
    }
  }

  // 3. Base runtime setup using artifact loaders or custom targetLoaders
  const targetLoaders = verObj?.loaders && verObj.loaders.length > 0
    ? verObj.loaders
    : custom.targetLoaders
  if (targetLoaders && targetLoaders.length > 0) {
    const target = targetLoaders[0].toLowerCase()
    const mc = props.data.runtime.minecraft || '1.20.1'
    if (target.includes('neoforge') && !props.data.runtime.neoForged) {
      const neos = await metadata.getNeoForgedVersions(mc).catch(() => [])
      if (token !== modLoaderSelectionToken || currentTab.value !== loaderId) return
      const ver = neos?.[0]
      if (ver) {
        props.data.runtime.neoForged = ver
        if (creationContext?.data?.runtime) creationContext.data.runtime.neoForged = ver
      }
    } else if (target.includes('forge') && !props.data.runtime.forge) {
      const forges = await metadata.getForgeVersions(mc).catch(() => [])
      if (token !== modLoaderSelectionToken || currentTab.value !== loaderId) return
      const ver = forges?.find((f) => f.type === 'recommended')?.version || forges?.[0]?.version
      if (ver) {
        props.data.runtime.forge = ver
        if (creationContext?.data?.runtime) creationContext.data.runtime.forge = ver
      }
    } else if (target.includes('fabric') && !props.data.runtime.fabricLoader) {
      const { loaderVersions } = await metadata.getFabricVersions().catch(() => ({ loaderVersions: [] }))
      if (token !== modLoaderSelectionToken || currentTab.value !== loaderId) return
      const ver = loaderVersions?.[0]?.version
      if (ver) {
        props.data.runtime.fabricLoader = ver
        if (creationContext?.data?.runtime) creationContext.data.runtime.fabricLoader = ver
      }
    }
  }

  if (token !== modLoaderSelectionToken || currentTab.value !== loaderId) return

  // 4. File download details and preservation
  if (currentTab.value === custom.id && verObj?.fileUrl && creationContext?.files) {
    const fileName = verObj.fileName || `${custom.id}-${verObj.version}.jar`
    const filePath = `mods/${fileName}`
    const hashes: Record<string, string> = {}
    if (verObj.sha1) hashes.sha1 = verObj.sha1
    const fileUrl = verObj.fileUrl.startsWith('http://dl.liteloader.com')
      ? verObj.fileUrl.replace('http://', 'https://')
      : verObj.fileUrl
    const downloads = [fileUrl]
    const fileItem = {
      path: filePath,
      downloads,
      hashes,
      size: verObj.size || 0,
    }
    if (currentCustomLoaderFilePath.value) {
      creationContext.files.value = creationContext.files.value.filter(
        (f) => f.path !== currentCustomLoaderFilePath.value,
      )
    }
    creationContext.files.value = [...creationContext.files.value.filter((f) => f.path !== filePath), fileItem]
    currentCustomLoaderFilePath.value = filePath
  }
}

function onSelectCustomLoaderVersion(version: string) {
  selectedCustomVersion.value = version
  if (!version) {
    props.data.version = ''
    if (currentCustomLoader.value) {
      const custom = currentCustomLoader.value
      const isFabricFork = ['babric', 'legacy-fabric', 'ornithe'].includes(custom.id) ||
        Boolean(custom.apiUrl && (custom.apiUrl.includes('fabricmc.net') || custom.apiUrl.includes('legacyfabric') || custom.apiUrl.includes('ornithemc') || custom.apiUrl.includes('babric')))
      if (isFabricFork) {
        props.data.runtime.fabricLoader = ''
        if (creationContext?.data?.runtime) {
          creationContext.data.runtime.fabricLoader = ''
        }
      }
    }
    clearCreationFiles()
    return
  }

  // Check if this version exists in local versions
  const matched = versions.value.find((v) => v.id === version)
  if (matched) {
    onSelectLocalVersion(version)
  } else {
    // Custom API version selection: local version override is cleared
    props.data.version = ''
  }

  if (currentCustomLoader.value) {
    const custom = currentCustomLoader.value
    const isFabricFork = ['babric', 'legacy-fabric', 'ornithe'].includes(custom.id) ||
      Boolean(custom.apiUrl && (custom.apiUrl.includes('fabricmc.net') || custom.apiUrl.includes('legacyfabric') || custom.apiUrl.includes('ornithemc') || custom.apiUrl.includes('babric')))
    const isModBased = custom.projectType === 'mod'

    if (isFabricFork) {
      const forkIcon = custom.icon || KNOWN_LOADER_ICONS[custom.id] || ''
      props.data.icon = forkIcon
      if (creationContext?.data) {
        creationContext.data.icon = forkIcon
      }
      clearCreationFiles()
      props.data.runtime.fabricLoader = version
      props.data.runtime.forge = ''
      props.data.runtime.neoForged = ''
      props.data.runtime.quiltLoader = ''
      props.data.runtime.labyMod = ''
      props.data.runtime.optifine = ''
      props.data.version = ''
      if (creationContext?.data) {
        creationContext.data.version = ''
        creationContext.data.runtime.fabricLoader = version
        creationContext.data.runtime.forge = ''
        creationContext.data.runtime.neoForged = ''
        creationContext.data.runtime.quiltLoader = ''
        creationContext.data.runtime.labyMod = ''
        creationContext.data.runtime.optifine = ''
      }
    } else if (isModBased) {
      handleModBasedLoader(custom.id, version)
      const verTag = `${props.data.runtime.minecraft}-${custom.name}-${version}`
      props.data.version = verTag
      if (creationContext?.data) {
        creationContext.data.version = verTag
      }
    } else {
      if (matched) {
        onSelectLocalVersion(version)
      } else {
        const verTag = `${props.data.runtime.minecraft}-${custom.name}-${version}`
        props.data.version = verTag
        if (creationContext?.data) {
          creationContext.data.version = verTag
        }
      }
    }
    const supportedGames = custom.gameVersions && custom.gameVersions.length > 0
      ? custom.gameVersions
      : KNOWN_LOADER_METAS[custom.id]?.gameVersions
    if (supportedGames && supportedGames.length > 0) {
      if (!supportedGames.some((g) => g.toLowerCase() === props.data.runtime.minecraft?.toLowerCase())) {
        props.data.runtime.minecraft = supportedGames[0]
        if (creationContext?.data?.runtime) {
          creationContext.data.runtime.minecraft = supportedGames[0]
        }
      }
    }
  }
}

watch([() => props.data.runtime, () => props.data.version], ([rt, version]) => {
  if (pendingLoader.value === currentTab.value) {
    const hasRuntimeVersion = rt.labyMod || rt.quiltLoader || rt.fabricLoader || rt.neoForged || rt.forge || rt.optifine || version
    if (!hasRuntimeVersion) return
    pendingLoader.value = undefined
  }

  // If already on a custom loader tab, keep it active!
  const isCustomTab = allLoaders.value.some((c) => !DEFAULT_LOADER_IDS.includes(c.id) && c.id === currentTab.value)
  if (isCustomTab) {
    const custom = allLoaders.value.find((c) => c.id === currentTab.value)
    const isFabricFork = custom && (['babric', 'legacy-fabric', 'ornithe'].includes(custom.id) ||
      Boolean(custom.apiUrl && (custom.apiUrl.includes('fabricmc.net') || custom.apiUrl.includes('legacyfabric') || custom.apiUrl.includes('ornithemc') || custom.apiUrl.includes('babric'))))
    if (isFabricFork && rt.fabricLoader) {
      selectedCustomVersion.value = rt.fabricLoader
    } else if (version) {
      selectedCustomVersion.value = version
    }
    return
  }

  // 1. Check if version matches any custom loader first
  if (version) {
    const matchedCustomLoader = allLoaders.value.find(
      (c) =>
        !DEFAULT_LOADER_IDS.includes(c.id) &&
        (version.toLowerCase().includes(c.id.toLowerCase()) ||
          c.versions?.some((v) => v.version === version)),
    )
    if (matchedCustomLoader) {
      currentTab.value = matchedCustomLoader.id
      selectedCustomVersion.value = version
      return
    }
  }

  // 2. Built-in loaders
  if (rt.labyMod) currentTab.value = 'labymod'
  else if (rt.quiltLoader) currentTab.value = 'quilt'
  else if (rt.fabricLoader) {
    const custom = resolveFabricCustomLoader(rt.minecraft, rt.fabricLoader)
    if (custom) {
      const match = allLoaders.value.find((c) => c.name.toLowerCase() === custom.name.toLowerCase() || c.id.toLowerCase() === custom.name.toLowerCase().replace(/\s+/g, '-'))
      if (match) {
        currentTab.value = match.id
        selectedCustomVersion.value = rt.fabricLoader
        return
      }
    }
    currentTab.value = 'fabric'
  }
  else if (rt.neoForged) currentTab.value = 'neoforge'
  else if (rt.forge) currentTab.value = 'forge'
  else if (rt.optifine) currentTab.value = 'optifine'
  else if (version) {
    currentTab.value = 'local'
  } else {
    currentTab.value = 'vanilla'
    selectedCustomVersion.value = ''
  }
}, { deep: true, immediate: true })

function clearVersionSelection() {
  props.data.runtime.forge = ''
  props.data.runtime.fabricLoader = ''
  props.data.runtime.quiltLoader = ''
  props.data.runtime.neoForged = ''
  props.data.runtime.labyMod = ''
  props.data.runtime.optifine = ''
  props.data.version = ''
  selectedCustomVersion.value = ''
  const isLoaderIcon = (icon?: string) => {
    if (!icon) return false
    return allLoaders.value.some((c) => c.icon === icon) || Object.values(KNOWN_LOADER_ICONS).includes(icon)
  }
  if (props.data.icon && isLoaderIcon(props.data.icon)) {
    props.data.icon = ''
  }
  if (creationContext?.data?.icon && isLoaderIcon(creationContext.data.icon)) {
    creationContext.data.icon = ''
  }
  clearCreationFiles()
}

function resetToVanilla() {
  currentTab.value = 'vanilla'
  pendingLoader.value = undefined
  clearVersionSelection()
}

function selectLoader(loader: string) {
  if (loader === 'vanilla') {
    resetToVanilla()
    return
  }
  if (currentTab.value === loader) {
    resetToVanilla()
    return
  }
  currentTab.value = loader
  pendingLoader.value = loader
  clearVersionSelection()

  if (loader === 'forge') {
    props.data.icon = ''
    if (creationContext?.data) creationContext.data.icon = ''
    onSelectForge('')
    metadata.getForgeVersions(props.data.runtime.minecraft).then((forges) => {
      if (currentTab.value === 'forge') {
        const ver = forges.find((f) => f.type === 'recommended')?.version || forges[0]?.version || ''
        if (ver) onSelectForge(ver)
      }
    }).catch(() => {})
  } else if (loader === 'fabric') {
    props.data.icon = ''
    if (creationContext?.data) creationContext.data.icon = ''
    onSelectFabric('')
    metadata.getFabricVersions().then(({ loaderVersions }) => {
      if (currentTab.value === 'fabric') {
        const ver = loaderVersions[0]?.version || ''
        if (ver) onSelectFabric(ver)
      }
    }).catch(() => {})
  } else if (loader === 'quilt') {
    props.data.icon = ''
    if (creationContext?.data) creationContext.data.icon = ''
    onSelectQuilt('')
    metadata.getQuiltVersions().then(({ loaderVersions }) => {
      if (currentTab.value === 'quilt') {
        const ver = loaderVersions[0]?.version || ''
        if (ver) onSelectQuilt(ver)
      }
    }).catch(() => {})
  } else if (loader === 'neoforge') {
    props.data.icon = ''
    if (creationContext?.data) creationContext.data.icon = ''
    onSelectNeoForged('')
    metadata.getNeoForgedVersions(props.data.runtime.minecraft).then((neos) => {
      if (currentTab.value === 'neoforge') {
        const ver = neos[0] || ''
        if (ver) onSelectNeoForged(ver)
      }
    }).catch(() => {})
  } else if (loader === 'optifine') {
    props.data.icon = ''
    if (creationContext?.data) creationContext.data.icon = ''
    // If current minecraft version is not supported by OptiFine, adapt to latest supported
    if (!optifineSupportedMcVersions.value.some((s) => s.toLowerCase() === props.data.runtime.minecraft?.toLowerCase())) {
      props.data.runtime.minecraft = optifineSupportedMcVersions.value[0] || '26.2'
    }
    const latestBuild = KNOWN_OPTIFINE_BUILDS.find((b) => b.mcversion === props.data.runtime.minecraft)
    const versionString = latestBuild ? `${latestBuild.type}_${latestBuild.patch}` : ''
    onSelectOptifine(versionString)
  } else if (loader === 'labymod') {
    props.data.icon = ''
    if (creationContext?.data) creationContext.data.icon = ''
    onSelectLabyMod('')
  } else {
    const custom = allLoaders.value.find((l) => l.id === loader)
    if (custom) {
      props.data.icon = custom.icon
      if (creationContext?.data) creationContext.data.icon = custom.icon
      const supportedGames = custom.gameVersions && custom.gameVersions.length > 0
        ? custom.gameVersions
        : KNOWN_LOADER_METAS[custom.id]?.gameVersions
      if (supportedGames && supportedGames.length > 0) {
        if (!supportedGames.some((g) => g.toLowerCase() === props.data.runtime.minecraft?.toLowerCase())) {
          props.data.runtime.minecraft = supportedGames[0]
          if (creationContext?.data?.runtime) {
            creationContext.data.runtime.minecraft = supportedGames[0]
          }
        }
      }
      if (custom.apiUrl && (!custom.versions || custom.versions.length === 0)) {
        refreshLoaderVersions(custom.id).then(() => {
          if (currentTab.value === custom.id && custom.versions && custom.versions.length > 0) {
            const mc = props.data.runtime.minecraft
            const matchedVer = custom.versions.find((v) => v.gameVersions?.some((g) => g.toLowerCase() === mc?.toLowerCase())) || custom.versions[0]
            onSelectCustomLoaderVersion(matchedVer.version)
          }
        })
      }
      if (custom.versions && custom.versions.length > 0) {
        const mc = props.data.runtime.minecraft
        const matchedVer = custom.versions.find((v) => v.gameVersions?.some((g) => g.toLowerCase() === mc?.toLowerCase())) || custom.versions[0]
        onSelectCustomLoaderVersion(matchedVer.version)
      } else if (KNOWN_LOADER_METAS[custom.id]?.defaultVersion) {
        onSelectCustomLoaderVersion(KNOWN_LOADER_METAS[custom.id].defaultVersion!)
      } else {
        const matched = versions.value.find((v) =>
          v.id.toLowerCase().includes(custom.id.toLowerCase()),
        )
        if (matched) {
          onSelectLocalVersion(matched.id)
        } else {
          handleModBasedLoader(custom.id)
        }
      }
    }
  }
}
</script>
