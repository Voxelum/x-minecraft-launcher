<template>
  <v-dialog
    v-model="isVisible"
    :fullscreen="false"
    :width="620"
    :persistent="false"
    content-class="spotlight-overlay"
    @keydown.esc="close"
    @keydown.down.prevent="navigateDown"
    @keydown.up.prevent="navigateUp"
    @keydown.enter.prevent="selectHighlighted"
  >
    <div class="rounded-2xl overflow-hidden border border-white/8 shadow-2xl" style="background: rgba(18, 18, 22, 0.95); backdrop-filter: blur(24px);">
      <!-- Search Input -->
      <div class="flex items-center gap-3 px-5 py-4 border-b border-white/6">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          ref="searchInput"
          v-model="searchQuery"
          :placeholder="t('spotlight.placeholder')"
          class="flex-1 bg-transparent text-white text-base outline-none placeholder-white/30"
          @focus="onSearchFocus"
        >
        <transition name="fade">
          <v-progress-circular v-if="isSearching" indeterminate size="16" width="2" color="rgba(255,255,255,0.3)" />
        </transition>
        <div v-if="searchQuery" class="flex items-center gap-1.5">
          <kbd class="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/8 text-white/40 border border-white/6">↑↓</kbd>
          <kbd class="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/8 text-white/40 border border-white/6">↵</kbd>
        </div>
      </div>

      <!-- Results -->
      <div class="max-h-[420px] overflow-y-auto spotlight-scrollbar">
        <div v-if="searchQuery.trim()" class="py-1">
          <!-- Instances Section -->
          <template v-if="filteredInstances.length > 0">
            <div class="px-4 pt-3 pb-1.5 text-[10px] font-600 uppercase tracking-widest text-white/30 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(96,165,250,0.7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              {{ t('spotlight.sections.instances') }}
            </div>
            <div
              v-for="(instance, index) in filteredInstances"
              :key="'i-' + instance.path"
              class="mx-2 px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-150"
              :class="highlightedIndex === getInstanceIndex(index) ? 'bg-white/8' : 'hover:bg-white/4'"
              @click="selectInstance(instance)"
              @mouseenter="highlightedIndex = getInstanceIndex(index)"
            >
              <div style="width: 36px; height: 36px; min-width: 36px; flex: 0 0 36px; border-radius: 4px;" class="overflow-hidden flex-shrink-0 bg-white/5 flex items-center justify-center">
                <v-img v-if="instance.icon" :src="instance.icon" class="w-full h-full" />
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(96,165,250,0.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-500 text-white/90 truncate">{{ instance.name }}</div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="text-[11px] px-1.5 py-px rounded bg-white/6 text-white/40 font-mono">{{ instance.runtime?.minecraft }}</span>
                  <span class="text-[11px] text-white/30">{{ getModLoaderName(instance.runtime) }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Mods Section (Remote from Modrinth, version-filtered) -->
          <template v-if="modResults.length > 0">
            <div class="px-4 pt-3 pb-1.5 text-[10px] font-600 uppercase tracking-widest text-white/30 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(192,132,252,0.7)" stroke="none"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-2 .9-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20c0 1.1.9 2 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>
              {{ t('spotlight.sections.mods') }}
              <span v-if="currentGameVersion" class="text-white/20 font-mono normal-case">· {{ currentGameVersion }}</span>
            </div>
            <div
              v-for="(mod, index) in modResults"
              :key="'m-' + mod.id"
              class="mx-2 px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-150"
              :class="highlightedIndex === getModIndex(index) ? 'bg-white/8' : 'hover:bg-white/4'"
              @click="installMod(mod)"
              @mouseenter="highlightedIndex = getModIndex(index)"
            >
              <div style="width: 36px; height: 36px; min-width: 36px; flex: 0 0 36px; border-radius: 4px;" class="overflow-hidden flex-shrink-0 bg-white/5 flex items-center justify-center">
                <v-img v-if="mod.iconUrl" :src="mod.iconUrl" class="w-full h-full" />
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="rgba(192,132,252,0.6)" stroke="none"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-2 .9-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20c0 1.1.9 2 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-500 text-white/90 truncate">{{ mod.title }}</div>
                <div class="text-[11px] text-white/35 truncate mt-0.5">{{ mod.description }}</div>
              </div>
              <div class="flex-shrink-0 flex items-center">
                <!-- Installing spinner -->
                <div v-if="installingMods[mod.id]" class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <v-progress-circular indeterminate size="14" width="2" color="#60a5fa" />
                  <span class="text-[11px] text-blue-400">{{ t('spotlight.installing') }}</span>
                </div>
                <!-- Installed check -->
                <div v-else-if="installedMods[mod.id]" class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span class="text-[11px] text-emerald-400">{{ t('spotlight.installed') }}</span>
                </div>
                <!-- Install failed -->
                <div v-else-if="failedMods[mod.id]" class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <span class="text-[11px] text-red-400">{{ t('spotlight.installFailed') }}</span>
                </div>
                <!-- Install button -->
                <div v-else class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/12 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span class="text-[11px] font-500">{{ t('spotlight.install') }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Local Mods Section -->
          <template v-if="localModResults.length > 0">
            <div class="px-4 pt-3 pb-1.5 text-[10px] font-600 uppercase tracking-widest text-white/30 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(251,146,60,0.7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
              {{ t('spotlight.sections.localMods') }}
            </div>
            <div
              v-for="(mod, index) in localModResults"
              :key="'l-' + mod.id"
              class="mx-2 px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-150"
              :class="highlightedIndex === getLocalModIndex(index) ? 'bg-white/8' : 'hover:bg-white/4'"
              @click="selectLocalMod(mod)"
              @mouseenter="highlightedIndex = getLocalModIndex(index)"
            >
              <div style="width: 36px; height: 36px; min-width: 36px; flex: 0 0 36px; border-radius: 4px;" class="overflow-hidden flex-shrink-0 bg-white/5 flex items-center justify-center">
                <v-img v-if="mod.icon" :src="mod.icon" class="w-full h-full" />
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(251,146,60,0.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-500 text-white/90 truncate">{{ mod.title }}</div>
                <div class="text-[11px] text-white/35 truncate mt-0.5">{{ mod.description }}</div>
              </div>
              <div v-if="mod.installed && mod.installed.length > 0" class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(52,211,153,0.7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span class="text-[10px] text-emerald-400/70">{{ t('spotlight.installed') }}</span>
              </div>
            </div>
          </template>

          <!-- No Mod Loader Info -->
          <div v-if="!currentModLoader && searchQuery.trim().length > 1 && filteredInstances.length === 0" class="px-6 py-10 flex flex-col items-center gap-2 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <div class="text-sm text-white/30">{{ t('spotlight.noModLoader') }}</div>
          </div>

          <!-- No Results -->
          <div v-else-if="noResults" class="px-6 py-10 flex flex-col items-center gap-2 text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="8" x2="14" y2="14"/><line x1="14" y1="8" x2="8" y2="14"/></svg>
            <div class="text-sm text-white/30">{{ t('spotlight.noResults') }}</div>
          </div>
        </div>

        <!-- Empty State: Quick Actions + Recent -->
        <div v-else class="py-1">
          <!-- Quick Actions -->
          <div class="px-4 pt-3 pb-1.5 text-[10px] font-600 uppercase tracking-widest text-white/30 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(251,191,36,0.7)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            {{ t('spotlight.sections.quickActions') }}
          </div>
          <div
            v-for="(action, index) in quickActions"
            :key="'a-' + action.id"
            class="mx-2 px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-150"
            :class="highlightedIndex === index ? 'bg-white/8' : 'hover:bg-white/4'"
            @click="action.action"
            @mouseenter="highlightedIndex = index"
          >
            <div style="width: 36px; height: 36px; min-width: 36px; flex: 0 0 36px; border-radius: 4px;" class="flex items-center justify-center" :class="action.bgClass">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" :stroke="action.iconColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="action.svgPath" />
            </div>
            <div class="text-sm font-500 text-white/80">{{ t(`spotlight.${action.label}`) }}</div>
          </div>

          <!-- Recent Instances -->
          <template v-if="recentInstances.length > 0">
            <div class="px-4 pt-3 pb-1.5 text-[10px] font-600 uppercase tracking-widest text-white/30 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              {{ t('spotlight.sections.recent') }}
            </div>
            <div
              v-for="(instance, idx) in recentInstances"
              :key="'r-' + instance.path"
              class="mx-2 px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 transition-all duration-150"
              :class="highlightedIndex === quickActions.length + idx ? 'bg-white/8' : 'hover:bg-white/4'"
              @click="selectInstance(instance)"
              @mouseenter="highlightedIndex = quickActions.length + idx"
            >
              <div style="width: 36px; height: 36px; min-width: 36px; flex: 0 0 36px; border-radius: 4px;" class="overflow-hidden flex-shrink-0 bg-white/5 flex items-center justify-center">
                <v-img v-if="instance.icon" :src="instance.icon" class="w-full h-full" />
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-500 text-white/80 truncate">{{ instance.name }}</div>
                <div class="text-[11px] text-white/30 mt-0.5">{{ instance.runtime?.minecraft }} · {{ getModLoaderName(instance.runtime) }}</div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-4 py-2 border-t border-white/5 flex items-center justify-between">
        <div class="flex items-center gap-2 text-[10px] text-white/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="6" y1="8" x2="6.01" y2="8"/><line x1="10" y1="8" x2="10.01" y2="8"/><line x1="14" y1="8" x2="14.01" y2="8"/><line x1="18" y1="8" x2="18.01" y2="8"/><line x1="8" y1="12" x2="8.01" y2="12"/><line x1="12" y1="12" x2="12.01" y2="12"/><line x1="16" y1="12" x2="16.01" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/></svg>
          <span>Ctrl+K</span>
        </div>
        <div v-if="currentGameVersion && currentModLoader" class="flex items-center gap-1.5 text-[10px] text-white/20">
          <div class="w-1.5 h-1.5 rounded-full bg-emerald-400/50" />
          <span>{{ currentGameVersion }} · {{ currentModLoader }}</span>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { injection } from '@/util/inject'
import { kInstances } from '@/composables/instances'
import { kInstance } from '@/composables/instance'
import { Instance } from '@xmcl/instance'
import { useSpotlightSearch } from '@/composables/spotlightSearch'
import { useService } from '@/composables/service'
import { InstanceModsServiceKey, InstanceServiceKey, MarketType } from '@xmcl/runtime-api'
import { clientModrinthV2 } from '@/util/clients'

const { t } = useI18n()
const router = useRouter()
const { instances } = injection(kInstances)
const { instance: currentInstance } = injection(kInstance)
const { installFromMarket } = useService(InstanceModsServiceKey)
const { editInstance } = useService(InstanceServiceKey)

// Dialog state
const isVisible = ref(false)
const searchQuery = ref('')
const highlightedIndex = ref(0)
const searchInput = ref<HTMLInputElement | null>(null)

// Install state tracking
const installingMods = reactive<Record<string, boolean>>({})
const installedMods = reactive<Record<string, boolean>>({})
const failedMods = reactive<Record<string, boolean>>({})

// Current instance info
const currentGameVersion = computed(() => currentInstance.value?.runtime?.minecraft)
const currentModLoader = computed(() => {
  const rt = currentInstance.value?.runtime
  if (rt?.fabricLoader) return 'fabric'
  if (rt?.forge) return 'forge'
  if (rt?.quiltLoader) return 'quilt'
  if (rt?.neoForged) return 'neoforge'
  return undefined
})

// Quick actions
const quickActions = computed(() => [
  { id: 'settings', label: 'globalSettings', svgPath: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>', iconColor: 'rgba(255,255,255,0.5)', bgClass: 'bg-white/6', action: () => navigateToSettings() },
  { id: 'mods', label: 'mods', svgPath: '<path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4c-1.1 0-2 .9-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20c0 1.1.9 2 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17c1.1 0 2-.9 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z" fill="rgba(96,165,250,0.7)" stroke="none"/>', iconColor: 'rgba(96,165,250,0.7)', bgClass: 'bg-blue-500/10', action: () => navigateToMods() },
  { id: 'store', label: 'store', svgPath: '<path d="M3 9l1-4h16l1 4M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9M3 9h18M9 21V9M15 21V9M12 5V3"/>', iconColor: 'rgba(52,211,153,0.7)', bgClass: 'bg-emerald-500/10', action: () => navigateToStore() },
])

// Recent instances (last 5)
const recentInstances = computed(() => instances.value.slice(0, 5))

// Spotlight search with game version + loader filtering
const {
  modResults,
  localModResults,
  isSearching,
} = useSpotlightSearch(searchQuery, currentGameVersion, currentModLoader)

// Filter instances by search query
const filteredInstances = computed(() => {
  if (!searchQuery.value.trim()) return []
  const query = searchQuery.value.toLowerCase()
  return instances.value.filter(instance =>
    instance.name.toLowerCase().includes(query) ||
    instance.runtime?.minecraft?.includes(query),
  ).slice(0, 5)
})

// No results
const noResults = computed(() => {
  if (!searchQuery.value.trim()) return false
  return filteredInstances.value.length === 0 &&
    modResults.value.length === 0 &&
    localModResults.value.length === 0
})

// Navigation index calculations
const getInstanceIndex = (index: number) => index
const getModIndex = (index: number) => filteredInstances.value.length + index
const getLocalModIndex = (index: number) => filteredInstances.value.length + modResults.value.length + index

// Get mod loader name
function getModLoaderName(runtime: Instance['runtime']) {
  if (runtime?.fabricLoader) return 'Fabric'
  if (runtime?.forge) return 'Forge'
  if (runtime?.quiltLoader) return 'Quilt'
  if (runtime?.neoForged) return 'NeoForge'
  return 'Vanilla'
}

// Navigation
function navigateDown() {
  const maxIndex = getMaxIndex()
  highlightedIndex.value = Math.min(highlightedIndex.value + 1, maxIndex)
}

function navigateUp() {
  highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
}

function getMaxIndex() {
  if (!searchQuery.value.trim()) {
    return quickActions.value.length + recentInstances.value.length - 1
  }
  return Math.max(
    filteredInstances.value.length + modResults.value.length + localModResults.value.length - 1,
    0,
  )
}

function selectHighlighted() {
  if (!searchQuery.value.trim()) {
    if (highlightedIndex.value < quickActions.value.length) {
      quickActions.value[highlightedIndex.value].action()
    } else {
      const recentIdx = highlightedIndex.value - quickActions.value.length
      if (recentIdx >= 0 && recentIdx < recentInstances.value.length) {
        selectInstance(recentInstances.value[recentIdx])
      }
    }
    return
  }

  if (highlightedIndex.value < filteredInstances.value.length) {
    selectInstance(filteredInstances.value[highlightedIndex.value])
  } else if (highlightedIndex.value < filteredInstances.value.length + modResults.value.length) {
    const idx = highlightedIndex.value - filteredInstances.value.length
    installMod(modResults.value[idx])
  } else {
    const idx = highlightedIndex.value - filteredInstances.value.length - modResults.value.length
    if (idx >= 0 && idx < localModResults.value.length) {
      selectLocalMod(localModResults.value[idx])
    }
  }
}

// Selection handlers
function selectInstance(instance: Instance) {
  close()
  editInstance({ instancePath: instance.path })
}

function selectLocalMod(_mod: any) {
  close()
  router.push({ path: '/mods' })
}

// DIRECT MOD INSTALLATION
async function installMod(mod: any) {
  if (installingMods[mod.id] || installedMods[mod.id]) return

  const instancePath = currentInstance.value?.path
  const gameVersion = currentGameVersion.value
  const loader = currentModLoader.value

  if (!instancePath || !gameVersion || !loader) return

  installingMods[mod.id] = true
  delete failedMods[mod.id]

  try {
    // 1. Fetch the latest version for this game version + loader
    const versions = await clientModrinthV2.getProjectVersions(mod.id, {
      loaders: [loader],
      gameVersions: [gameVersion],
    })

    if (!versions || versions.length === 0) {
      failedMods[mod.id] = true
      delete installingMods[mod.id]
      return
    }

    const latestVersion = versions[0]

    // 2. Collect required dependencies
    const depVersionIds: { versionId: string; icon?: string }[] = []

    const requiredDeps = latestVersion.dependencies?.filter(
      (d: any) => d.dependency_type === 'required',
    ) || []

    for (const dep of requiredDeps) {
      if (dep.version_id) {
        depVersionIds.push({ versionId: dep.version_id })
      } else if (dep.project_id) {
        // Fetch the best version for this dependency
        try {
          const depVersions = await clientModrinthV2.getProjectVersions(dep.project_id, {
            loaders: [loader],
            gameVersions: [gameVersion],
          })
          if (depVersions && depVersions.length > 0) {
            depVersionIds.push({ versionId: depVersions[0].id })
          }
        } catch {
          // Skip if dependency version can't be found
        }
      }
    }

    // 3. Install mod + dependencies
    const allVersions = [
      { versionId: latestVersion.id, icon: mod.iconUrl },
      ...depVersionIds,
    ]

    await installFromMarket({
      market: MarketType.Modrinth,
      version: allVersions,
      instancePath,
    })

    installedMods[mod.id] = true
  } catch (e) {
    console.error('Failed to install mod:', e)
    failedMods[mod.id] = true
  } finally {
    delete installingMods[mod.id]
  }
}

// Navigation actions
function navigateToSettings() {
  close()
  router.push({ path: '/setting' })
}

function navigateToMods() {
  close()
  router.push({ path: '/mods' })
}

function navigateToStore() {
  close()
  router.push({ path: '/store' })
}

// Search focus handler
function onSearchFocus() {
  highlightedIndex.value = 0
}

// Open/close
function open() {
  isVisible.value = true
  searchQuery.value = ''
  highlightedIndex.value = 0
  // Reset install states
  Object.keys(installingMods).forEach(k => delete installingMods[k])
  Object.keys(installedMods).forEach(k => delete installedMods[k])
  Object.keys(failedMods).forEach(k => delete failedMods[k])
  nextTick(() => {
    searchInput.value?.focus()
  })
}

function close() {
  isVisible.value = false
  searchQuery.value = ''
}

defineExpose({ open, close })
</script>

<style scoped>
.spotlight-overlay {
  align-self: flex-start !important;
  margin-top: 80px !important;
}

.spotlight-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
}

.spotlight-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.spotlight-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.spotlight-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.spotlight-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.14);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
