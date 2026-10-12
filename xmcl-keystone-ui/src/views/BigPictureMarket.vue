<template>
  <div class="flex-1 flex flex-col overflow-hidden px-2 pt-2">
    <!-- Top Filter Bar -->
    <div class="flex flex-wrap items-center justify-between gap-4 pb-4">
      <!-- Search Input -->
      <div class="w-full sm:w-80">
        <v-text-field
          v-model="query"
          prepend-inner-icon="search"
          :append-inner-icon="gamepadConnected ? 'keyboard' : undefined"
          :placeholder="t('store.searchHint')"
          variant="outlined"
          density="compact"
          rounded="lg"
          clearable
          hide-details
          class="bg-white/5"
          data-gamepad-focusable
          @click:append-inner="openVirtualKeyboard()"
          @keydown.enter="doSearch"
        />
      </div>

      <!-- Project Type Tabs -->
      <div class="bp-nav" role="tablist">
        <button
          v-for="cat in projectTypes"
          :key="cat.id"
          type="button"
          class="bp-nav-item !px-4 !py-1.5 !text-sm"
          :class="{ 'active': selectedType === cat.id }"
          role="tab"
          data-gamepad-focusable
          @click="selectType(cat.id)"
        >
          <v-icon size="16">{{ cat.icon }}</v-icon>
          <span>{{ cat.label }}</span>
        </button>
      </div>

      <!-- Filter & Sort Options -->
      <div class="flex items-center gap-3">
        <button
          v-if="selectedType !== 'modpack' && runtime.minecraft"
          type="button"
          class="flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all text-xs font-bold cursor-pointer select-none"
          :class="filterCompatible
            ? 'bg-primary/20 border-primary text-primary shadow-[0_0_12px_rgba(var(--v-theme-primary),0.3)]'
            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'"
          data-gamepad-focusable
          @click="filterCompatible = !filterCompatible; doSearch()"
        >
          <v-icon size="15" :color="filterCompatible ? 'primary' : 'white/40'">
            {{ filterCompatible ? 'check_circle' : 'radio_button_unchecked' }}
          </v-icon>
          <span>{{ filterCompatible ? t('bigPicture.filterCompatibleOnly', { version: runtime.minecraft }) : t('bigPicture.showAllVersions') }}</span>
        </button>

        <div class="w-44">
          <v-select
            v-model="sortIndex"
            :items="sortOptions"
            item-title="label"
            item-value="value"
            variant="outlined"
            density="compact"
            rounded="lg"
            hide-details
            class="bg-white/5 text-sm"
            data-gamepad-focusable
            @update:model-value="doSearch"
          />
        </div>
      </div>
    </div>

    <!-- Projects Grid -->
    <div class="flex-1 overflow-y-auto custom-scrollbar pb-6">
      <!-- Loading Skeleton State -->
      <div v-if="loading" class="flex flex-col gap-6 p-4 pt-5 pb-8">
        <div class="flex items-center justify-center gap-3 py-4">
          <v-progress-circular indeterminate size="28" width="3" color="primary" />
          <span class="text-white/70 font-bold text-base tracking-wide">{{ t('task.running') }}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          <div
            v-for="n in 10"
            :key="n"
            class="bp-card !w-full !h-auto !min-h-[220px] p-4 flex flex-col justify-between animate-pulse pointer-events-none"
          >
            <div>
              <div class="flex items-center gap-3 mb-3">
                <div class="w-12 h-12 rounded-xl bg-white/10 flex-shrink-0" />
                <div class="flex-1 flex flex-col gap-2 min-w-0">
                  <div class="h-4 bg-white/15 rounded w-3/4" />
                  <div class="h-3 bg-white/10 rounded w-1/2" />
                </div>
              </div>
              <div class="space-y-2 mb-3">
                <div class="h-3 bg-white/10 rounded w-full" />
                <div class="h-3 bg-white/10 rounded w-5/6" />
                <div class="h-3 bg-white/5 rounded w-2/3" />
              </div>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-white/5">
              <div class="h-3 bg-white/10 rounded w-16" />
              <div class="h-4 bg-white/10 rounded-full w-14" />
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="projects.length === 0"
        class="flex flex-col items-center justify-center py-24 text-center text-white/50"
      >
        <v-icon size="64" class="mb-4">search_off</v-icon>
        <h3 class="text-xl font-bold mb-1">{{ t('store.empty') }}</h3>
        <p class="text-sm text-white/40">{{ t('store.emptyHint') }}</p>
      </div>

      <div
        v-else
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 p-4 pt-5 pb-8"
      >
        <div
          v-for="proj in projects"
          :key="proj.project_id"
          class="bp-card !w-full !h-auto !min-h-[220px] p-4 flex flex-col justify-between"
          tabindex="0"
          role="button"
          data-gamepad-focusable
          @click="openProject(proj)"
          @keydown.enter.prevent="openProject(proj)"
        >
          <div>
            <div class="flex items-center gap-3 mb-3">
              <img
                :src="proj.icon_url || ''"
                class="w-12 h-12 rounded-xl object-contain bg-black/40 flex-shrink-0"
                alt="Icon"
                loading="lazy"
              >
              <div class="min-w-0 flex-1">
                <div class="font-bold text-base text-white truncate" :title="proj.title">
                  {{ proj.title }}
                </div>
                <div class="text-xs text-white/50 truncate">
                  by {{ proj.author }}
                </div>
              </div>
            </div>

            <p class="text-xs text-white/70 line-clamp-3 mb-3 leading-relaxed">
              {{ proj.description }}
            </p>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-white/60">
            <span class="flex items-center gap-1">
              <v-icon size="14">download</v-icon>
              {{ formatNumber(proj.downloads) }}
            </span>
            <span class="bp-tag !text-[10px] !py-0.5 !px-2 font-bold tracking-wider">
              {{ getProjectTag(proj) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Project Detail & Install Modal -->
    <v-dialog
      v-model="detailModal"
      max-width="700"
      content-class="elevation-0"
    >
      <div v-if="selectedProject" class="bp-subpage-card !m-0 !p-6 flex flex-col max-h-[85vh]">
        <!-- Header -->
        <div class="flex items-start justify-between pb-4 border-b border-white/10">
          <div class="flex items-center gap-4">
            <img
              :src="selectedProject.icon_url || ''"
              class="w-16 h-16 rounded-2xl object-contain bg-black/40 border border-white/10 shadow-lg"
              alt="Icon"
            >
            <div>
              <h2 class="text-2xl font-bold">{{ selectedProject.title }}</h2>
              <div class="text-sm text-white/60">
                by {{ selectedProject.author }} • {{ formatNumber(selectedProject.downloads) }} downloads
              </div>
            </div>
          </div>
          <v-btn icon="close" variant="text" size="small" @click="detailModal = false" />
        </div>

        <!-- Description -->
        <div class="py-4 text-sm text-white/80 leading-relaxed overflow-y-auto max-h-48 custom-scrollbar">
          {{ selectedProject.description }}
        </div>

        <!-- Version & Instance Selection Controls -->
        <div class="py-3 border-t border-white/10 flex flex-col gap-4">
          <!-- Target Instance (for non-modpack) -->
          <div v-if="!isModpack(selectedProject) && instances.length > 0" class="flex flex-col gap-1.5">
            <div class="text-xs font-bold uppercase tracking-wider text-white/50">
              {{ t('setting.location') }}
            </div>
            <v-select
              v-model="targetInstancePath"
              :items="instances"
              item-title="name"
              item-value="path"
              density="compact"
              variant="outlined"
              rounded="xl"
              hide-details
              class="bg-white/5"
              data-gamepad-focusable
            >
              <template #selection="{ item }">
                <div class="flex items-center gap-2">
                  <v-icon size="16" color="primary">sports_esports</v-icon>
                  <span class="font-bold text-white">{{ (item as any)?.name || (item as any)?.raw?.name }}</span>
                  <span class="text-xs text-white/50">({{ (item as any)?.runtime?.minecraft || (item as any)?.raw?.runtime?.minecraft || 'MC' }})</span>
                </div>
              </template>
            </v-select>
          </div>

          <!-- Version Selection -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <div class="text-xs font-bold uppercase tracking-wider text-white/50">
                {{ t('version.name', 1) }}
              </div>
              <button
                v-if="!isModpack(selectedProject) && targetMinecraftVersion"
                type="button"
                class="flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all text-xs font-bold cursor-pointer select-none"
                :class="compatibleOnly
                  ? 'bg-primary/20 border-primary text-primary shadow-[0_0_12px_rgba(var(--v-theme-primary),0.3)]'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'"
                data-gamepad-focusable
                @click="compatibleOnly = !compatibleOnly"
              >
                <v-icon size="14" :color="compatibleOnly ? 'primary' : 'white/40'">
                  {{ compatibleOnly ? 'check_circle' : 'radio_button_unchecked' }}
                </v-icon>
                <span>{{ t('bigPicture.filterCompatibleOnly', { version: targetMinecraftVersion }) }}</span>
              </button>
            </div>

            <!-- Loading indicator -->
            <div v-if="loadingVersions" class="flex items-center gap-2 py-3 px-4 rounded-xl bg-white/5 text-white/60 text-xs">
              <v-progress-circular indeterminate size="16" width="2" color="primary" />
              <span>Loading versions…</span>
            </div>

            <!-- Empty indicator -->
            <div v-else-if="displayVersions.length === 0" class="py-3 px-4 rounded-xl bg-warning/10 text-warning text-xs flex items-center gap-2">
              <v-icon size="16">warning</v-icon>
              <span>{{ t('bigPicture.noVersionsFound') }}</span>
            </div>

            <!-- Version select dropdown -->
            <v-select
              v-else
              v-model="selectedVersionId"
              :items="versionItems"
              item-title="title"
              item-value="id"
              density="compact"
              variant="outlined"
              rounded="xl"
              hide-details
              class="bg-white/10"
              data-gamepad-focusable
            >
              <template #selection="{ item }">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="font-bold text-white truncate">
                    {{ getVersionItemDisplay(item).title }}
                  </span>
                  <v-chip
                    v-if="getVersionItemDisplay(item).versionType"
                    size="x-small"
                    label
                    :color="getVersionItemDisplay(item).versionType === 'release' ? 'primary' : 'warning'"
                  >
                    {{ getVersionItemDisplay(item).versionType }}
                  </v-chip>
                  <span
                    v-if="getVersionItemDisplay(item).gameVersions"
                    class="text-xs text-white/50 truncate"
                  >
                    ({{ formatVersionGvs(getVersionItemDisplay(item).gameVersions) }})
                  </span>
                </div>
              </template>
              <template #item="{ item, props: itemProps }">
                <v-list-item v-bind="itemProps" class="hover:bg-white/10 rounded-xl my-0.5">
                  <template #title>
                    <div class="font-bold text-white text-sm">
                      {{ getVersionItemDisplay(item).title }}
                    </div>
                  </template>
                  <template #subtitle>
                    <div class="flex items-center gap-2 text-xs text-white/60 mt-0.5 flex-wrap">
                      <span v-if="getVersionItemDisplay(item).gameVersions" class="text-primary font-semibold">
                        {{ formatVersionGvs(getVersionItemDisplay(item).gameVersions) }}
                      </span>
                      <span v-if="getVersionItemDisplay(item).loaders && getVersionItemDisplay(item).gameVersions">·</span>
                      <span v-if="getVersionItemDisplay(item).loaders" class="capitalize text-white/70">
                        {{ getVersionItemDisplay(item).loaders }}
                      </span>
                    </div>
                  </template>
                  <template #append>
                    <v-chip
                      size="x-small"
                      label
                      :color="getVersionItemDisplay(item).versionType === 'release' ? 'primary' : 'warning'"
                      class="font-bold uppercase"
                    >
                      {{ getVersionItemDisplay(item).versionType }}
                    </v-chip>
                  </template>
                </v-list-item>
              </template>
            </v-select>
          </div>
        </div>

        <!-- Install Action Box -->
        <div class="pt-4 border-t border-white/10 flex items-center justify-between">
          <div class="text-xs text-white/50 truncate max-w-[280px]">
            <template v-if="isModpack(selectedProject)">
              {{ t('bigPicture.addInstance') }}
            </template>
            <template v-else>
              {{ targetInstance?.name }} · {{ targetMinecraftVersion || 'Default' }}
            </template>
          </div>

          <v-btn
            color="primary"
            size="large"
            :loading="installing"
            :disabled="!selectedVersionId || loadingVersions"
            class="rounded-xl font-bold text-base px-8"
            prepend-icon="download"
            data-gamepad-focusable
            @click="installProject(selectedProject)"
          >
            {{ t('shared.install') }}
          </v-btn>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { clientModrinthV2 } from '@/util/clients'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { useModpackInstaller } from '@/composables/modpackInstaller'
import { useNotifier } from '@/composables/notifier'
import { useService } from '@/composables/service'
import { useBigPicture } from '@/composables/bigPicture'
import { useGamepad } from '@/composables/gamepad'
import { injection } from '@/util/inject'
import { getModrinthModLoaders } from '@/util/modrinth'
import {
  InstanceModsServiceKey,
  InstanceShaderPacksServiceKey,
  InstanceResourcePacksServiceKey,
  InstanceSavesServiceKey,
  MarketType,
  InstallMarketOptionWithInstance,
} from '@xmcl/runtime-api'
import type { SearchResultHit, ProjectVersion } from '@xmcl/modrinth'

const { t } = useI18n()
const { notify } = useNotifier()
const { instances } = injection(kInstances)
const { path: currentInstancePath, instance: currentInstance, runtime } = injection(kInstance)
const { installFromMarket: installMod } = useService(InstanceModsServiceKey)
const { installFromMarket: installShader } = useService(InstanceShaderPacksServiceKey)
const { installFromMarket: installResourcePack } = useService(InstanceResourcePacksServiceKey)
const { installFromMarket: installSave } = useService(InstanceSavesServiceKey)
const installModpack = useModpackInstaller()

const currentInstanceName = computed(() => currentInstance.value?.name || 'Selected Instance')

const { openVirtualKeyboard } = useBigPicture()
const gamepad = useGamepad()
const gamepadConnected = gamepad.connected

type ProjectType = 'modpack' | 'mod' | 'resourcepack' | 'shader' | 'datapack'
const props = withDefaults(defineProps<{
  initialCategory?: ProjectType
}>(), {
  initialCategory: 'modpack',
})

const query = ref('')
const loading = ref(false)
const projects = ref<SearchResultHit[]>([])
const filterCompatible = ref(true)

const projectTypes = [
  { id: 'modpack' as ProjectType, label: 'Modpacks', icon: 'auto_awesome' },
  { id: 'mod' as ProjectType, label: 'Mods', icon: 'extension' },
  { id: 'shader' as ProjectType, label: 'Shaders', icon: 'wb_sunny' },
  { id: 'resourcepack' as ProjectType, label: 'Resource Packs', icon: 'palette' },
  { id: 'datapack' as ProjectType, label: 'Maps & Datapacks', icon: 'map' },
]
const selectedType = ref<ProjectType>(props.initialCategory)

watch(() => props.initialCategory, (val) => {
  if (val) selectType(val)
})

const sortOptions = [
  { label: 'Most Downloads', value: 'downloads' },
  { label: 'Popularity', value: 'follows' },
  { label: 'Newest', value: 'newest' },
  { label: 'Updated', value: 'updated' },
]
const sortIndex = ref('downloads')

function selectType(type: ProjectType) {
  selectedType.value = type
  doSearch()
}

async function doSearch() {
  loading.value = true
  try {
    const facets: string[][] = [
      [`project_type:${selectedType.value}`],
    ]
    if (filterCompatible.value && selectedType.value !== 'modpack') {
      const mc = runtime.value?.minecraft
      if (mc) {
        facets.push([`versions:${mc}`])
      }
      if (selectedType.value === 'mod' && runtime.value) {
        const loaders = getModrinthModLoaders(runtime.value, false)
        if (loaders.length > 0) {
          facets.push(loaders.map((l) => `categories:${l}`))
        }
      }
    }
    const res = await clientModrinthV2.searchProjects({
      query: query.value.trim(),
      facets: JSON.stringify(facets),
      index: sortIndex.value as any,
      limit: 25,
    })
    projects.value = res.hits
  } catch (e: any) {
    notify({ level: 'error', title: e.message || 'Failed to search projects' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  doSearch()
})

// Details & Installation
const detailModal = ref(false)
const selectedProject = ref<SearchResultHit | null>(null)
const installing = ref(false)
const projectVersions = ref<ProjectVersion[]>([])
const loadingVersions = ref(false)
const selectedVersionId = ref('')
const compatibleOnly = ref(true)
const targetInstancePath = ref('')

const targetInstance = computed(() => {
  return instances.value.find((i) => i.path === targetInstancePath.value) || currentInstance.value
})

const targetMinecraftVersion = computed(() => {
  return targetInstance.value?.runtime?.minecraft || ''
})

const targetLoaders = computed(() => {
  if (!targetInstance.value?.runtime) return []
  return getModrinthModLoaders(targetInstance.value.runtime, false)
})

const displayVersions = computed(() => {
  if (!compatibleOnly.value || (selectedProject.value && isModpack(selectedProject.value))) {
    return projectVersions.value
  }
  const mc = targetMinecraftVersion.value
  const loaders = targetLoaders.value
  const filtered = projectVersions.value.filter((v) => {
    const mcMatch = !mc || v.game_versions?.includes(mc)
    if (!mcMatch) return false
    if (selectedProject.value?.project_type === 'mod' && loaders.length > 0) {
      return v.loaders?.some((l) => loaders.includes(l))
    }
    return true
  })
  return filtered.length > 0 ? filtered : projectVersions.value
})

const versionItems = computed(() => {
  return displayVersions.value.map((v) => {
    const title = v.name || v.version_number || v.id
    const gvs = Array.isArray(v.game_versions) ? v.game_versions.join(', ') : ''
    const lds = Array.isArray(v.loaders) ? v.loaders.join(', ') : ''
    return {
      id: v.id,
      title,
      name: v.name,
      versionNumber: v.version_number || '',
      versionType: v.version_type || 'release',
      gameVersions: gvs,
      loaders: lds,
      rawVersion: v,
    }
  })
})

watch(versionItems, (items) => {
  if (items.length > 0 && (!selectedVersionId.value || !items.some((it) => it.id === selectedVersionId.value))) {
    selectedVersionId.value = items[0].id
  }
}, { immediate: true })

function isModpack(proj: SearchResultHit) {
  return proj.project_type === 'modpack'
}

async function openProject(proj: SearchResultHit) {
  selectedProject.value = proj
  detailModal.value = true
  targetInstancePath.value = currentInstancePath.value || (instances.value[0]?.path ?? '')
  projectVersions.value = []
  selectedVersionId.value = ''
  loadingVersions.value = true
  compatibleOnly.value = true

  try {
    const list = await clientModrinthV2.getProjectVersions(proj.project_id || proj.slug)
    projectVersions.value = list || []
    if (projectVersions.value.length > 0) {
      selectedVersionId.value = projectVersions.value[0].id
    }
  } catch (e) {
    console.error('Failed to load project versions', e)
  } finally {
    loadingVersions.value = false
  }
}

async function installProject(proj: SearchResultHit) {
  if (!selectedVersionId.value) return
  installing.value = true
  try {
    const versionToInstall = projectVersions.value.find(v => v.id === selectedVersionId.value) || displayVersions.value[0]
    if (!versionToInstall) {
      notify({ level: 'error', title: t('bigPicture.noVersionsFound') })
      return
    }

    if (isModpack(proj)) {
      await installModpack({
        projectId: proj.project_id,
        versionId: versionToInstall.id,
        icon: proj.icon_url,
        market: MarketType.Modrinth,
      })
      notify({ level: 'success', title: t('bigPicture.installedSuccess', { title: proj.title }) })
      detailModal.value = false
      return
    }

    const destPath = targetInstancePath.value || currentInstancePath.value
    if (!destPath) {
      notify({ level: 'error', title: 'No instance selected to install into' })
      return
    }

    const option: InstallMarketOptionWithInstance = {
      market: MarketType.Modrinth,
      instancePath: destPath,
      version: {
        versionId: versionToInstall.id,
        icon: proj.icon_url,
      },
    }

    if (proj.project_type === 'mod') {
      await installMod(option)
    } else if (proj.project_type === 'shader') {
      await installShader(option)
    } else if (proj.project_type === 'resourcepack') {
      await installResourcePack(option)
    } else if (proj.project_type === 'datapack') {
      await installSave(option)
    } else {
      await installMod(option)
    }

    notify({
      level: 'success',
      title: t('bigPicture.installedSuccess', {
        title: `${proj.title} (${versionToInstall.version_number || versionToInstall.name})`,
      }),
    })
    detailModal.value = false
  } catch (e: any) {
    notify({ level: 'error', title: e.message || 'Installation failed' })
  } finally {
    installing.value = false
  }
}

function formatNumber(num: number) {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return String(num)
}

function getProjectTag(proj: SearchResultHit) {
  if (selectedType.value === 'datapack' || proj.project_type === 'datapack') {
    const isMap = proj.categories?.some((c) =>
      ['adventure', 'survival', 'puzzle', 'parkour', 'minigame', 'ctm'].includes(c.toLowerCase())
    )
    if (isMap) {
      return t('bigPicture.tagMap')
    }
    return t('bigPicture.tagDatapack')
  }

  if (proj.project_type === 'modpack') return t('bigPicture.tagModpack')
  if (proj.project_type === 'resourcepack') return t('bigPicture.tagResourcepack')
  if (proj.project_type === 'shader') return t('bigPicture.tagShader')
  if (proj.project_type === 'mod') return t('bigPicture.tagMod')
  return proj.project_type.toUpperCase()
}

function formatVersionGvs(gvs: string | string[] | undefined) {
  if (!gvs) return ''
  const parts = Array.isArray(gvs) ? gvs : gvs.split(', ')
  if (parts.length > 3) {
    return `${parts.slice(0, 3).join(', ')} +${parts.length - 3}`
  }
  return Array.isArray(gvs) ? gvs.join(', ') : gvs
}

function getVersionItemDisplay(item: any) {
  const it = item?.rawVersion || item?.raw || item || {}
  const title = it.title || it.name || it.version_number || it.versionNumber || selectedVersionId.value || 'Version'
  const versionType = it.version_type || it.versionType || 'release'
  const gameVersions = it.game_versions || it.gameVersions || ''
  const loaders = it.loaders || ''
  return {
    title,
    versionType,
    gameVersions,
    loaders,
  }
}
</script>
