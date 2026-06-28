<template>
  <div
    data-testid="settings-page"
    class="d-flex fill-height setting-page"
  >
    <!-- Navigation Sidebar (Only in Wide/Scroll Mode) -->
    <nav v-if="!isNarrowView" class="setting-sidebar" :aria-label="t('setting.name', 2)">
      <v-card class="sidebar-card d-flex flex-column overflow-hidden" :elevation="0">
        <!-- Sidebar Title Header -->
        <div class="px-5 pt-5 pb-3 d-flex align-center gap-3">
          <v-icon color="primary" size="22">settings</v-icon>
          <div class="d-flex flex-column">
            <span class="text-subtitle-2 font-weight-bold leading-tight" style="color: rgba(var(--v-theme-on-surface), 0.95); font-size: 0.95rem !important;">
              {{ t('setting.name', 2) }}
            </span>
            <span class="text-caption opacity-50 font-weight-medium" style="font-size: 0.72rem !important; letter-spacing: 0.02em;">
              Launcher Config
            </span>
          </div>
        </div>

        <!-- Search Input Container -->
        <div class="px-4 pb-3">
          <v-text-field
            v-model="searchQuery"
            prepend-inner-icon="search"
            :label="t('shared.search')"
            variant="solo-filled"
            density="compact"
            class="search-input"
            hide-details
            clearable
          ></v-text-field>
        </div>

        <v-divider class="opacity-10 mx-4 mb-1" />

        <!-- Navigation List Container -->
        <div class="flex-grow-1 overflow-y-auto px-3 pb-4">
          <v-list nav density="compact" color="transparent" class="py-1" :selected="[activeSectionIndex]" @update:selected="v => activeSectionIndex = (v[0] as number) ?? 0">
            <div class="sidebar-subheader text-uppercase font-weight-bold mb-2">
              {{ t('setting.name') }}
            </div>
            <v-list-item
              v-for="(item, idx) in visibleSections"
              :key="item.id"
              :value="idx"
              class="sidebar-item"
              :title="item.title"
              @click="scrollTo(item.id)"
            >
              <template #prepend>
                <v-icon size="16" class="mr-3">{{ item.icon }}</v-icon>
              </template>
            </v-list-item>
          </v-list>
        </div>
      </v-card>
    </nav>

    <!-- Content Area -->
    <div 
      class="flex-grow-1 overflow-y-auto fill-height scroll-container visible-scroll" 
      :class="{ 'has-sticky-tabs': isNarrowView }"
      ref="scrollContainer"
      @scroll="onScroll"
    >
      <!-- Sticky Tabs Header (Only in Narrow/Tabs Mode) -->
      <div v-if="isNarrowView" class="sticky-tabs-wrapper px-4 pt-4">
        <v-text-field
          v-model="searchQuery"
          append-inner-icon="search"
          :label="t('shared.search')"
          variant="solo-filled"
          density="compact"
          class="mb-2 search-input"
          hide-details
          clearable
        ></v-text-field>
        <v-tabs
          v-model="activeSectionIndex"
          align-tabs="center"
          bg-color="transparent"
          color="primary"
          show-arrows
          :aria-label="t('setting.name', 2)"
          class="rounded-lg"
          @update:model-value="onTabChange"
        >
          <v-tab v-for="item in visibleSections" :key="item.id">
            <v-icon start size="small">{{ item.icon }}</v-icon>
            {{ item.title }}
          </v-tab>
        </v-tabs>
      </div>

      <div class="content-wrapper mx-auto pa-4 pa-md-8" :class="{ 'tabs-mode': isNarrowView }">
        
        <!-- Empty State for Search -->
        <div v-if="visibleSections.length === 0" class="d-flex flex-column align-center justify-center fill-height py-12 opacity-50">
          <v-icon size="64" class="mb-4">search_off</v-icon>
          <div class="text-h6">{{ t('commandPalette.noResults') }}</div>
        </div>

        <div class="settings-content-sections" :class="{'is-searching': !!searchQuery}">
          <!-- System -->
          <section id="system" class="mb-12 scroll-target" role="region" aria-label="System" v-show="isSectionVisible('system')">
            <SettingHeader
              title="System"
              icon="dns"
            />
            <SettingGeneral class="mb-4" :search-query="searchQuery" />
            <SettingAdvanced :search-query="searchQuery" />
          </section>
          
          <!-- Appearance -->
          <section id="appearance" class="mb-12 scroll-target" role="region" aria-label="Appearance" v-show="isSectionVisible('appearance')">
            <SettingHeader
              icon="palette"
              title="Appearance"
            />
            <SettingGlobalUI :search-query="searchQuery" />
          </section>
          
          <!-- Minecraft -->
          <section id="minecraft" class="mb-12 scroll-target" role="region" aria-label="Minecraft" v-show="isSectionVisible('minecraft')">
            <SettingHeader
              title="Minecraft"
              icon="videogame_asset"
            />
            <SettingGlobal :search-query="searchQuery" />
          </section>
          
          <!-- Integrations & Network -->
          <section id="integrations" class="mb-12 scroll-target" role="region" aria-label="Integrations & Network" v-show="isSectionVisible('integrations')">
            <SettingHeader
              title="Integrations & Network"
              icon="hub"
            />
            <SettingNetwork :search-query="searchQuery" />
          </section>

          <!-- About -->
          <section id="about" class="mb-16 scroll-target" role="region" aria-label="About" v-show="isSectionVisible('about')">
            <SettingHeader
              title="About"
              icon="info"
            />
            <SettingUpdate class="mb-4" :search-query="searchQuery" />
            <SettingAbout />
          </section>
        </div>
      </div>

      <SettingUpdateInfoDialog />
      <SettingMigrationDialog />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, provide, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingUpdateInfoDialog from './SettingUpdateInfoDialog.vue'
import SettingUpdate from './SettingUpdate.vue'
import SettingGeneral from './SettingGeneral.vue'
import SettingMigrationDialog from './SettingMigrationDialog.vue'
import SettingGlobal from './SettingGlobal.vue'
import SettingAbout from './SettingAbout.vue'
import SettingNetwork from './SettingNetwork.vue'
import { usePresence } from '@/composables/presence'
import { kUpdateSettings, useUpdateSettings } from '@/composables/setting'
import { kSurfaceTokens } from '@/composables/surfaceTokens'
import { injection } from '@/util/inject'
import { kTheme } from '@/composables/theme'
import SettingGlobalUI from './SettingGlobalUI.vue'
import { useMediaQuery } from '@vueuse/core'
import SettingAdvanced from './SettingAdvanced.vue'
import SettingHeader from '@/components/SettingHeader.vue'

const { t } = useI18n()
usePresence(computed(() => t('presence.setting')))

provide(kUpdateSettings, useUpdateSettings())

const { suppressed } = injection(kTheme)
const tokens = injection(kSurfaceTokens)

onMounted(() => {
  suppressed.value = true
})
onUnmounted(() => {
  suppressed.value = false
})

const NARROW_BREAKPOINT = 960 // Switch to tabs view when window is narrower than this
const isNarrowView = useMediaQuery(`(max-width: ${NARROW_BREAKPOINT - 1}px)`)

// Search Logic
const searchQuery = ref('')
provide('settingsSearchQuery', searchQuery)
const searchLower = computed(() => searchQuery.value.toLowerCase().trim())

// Searchable keywords for each section (English fallbacks)
const sectionKeywords: Record<string, string[]> = {
  system: ['system', 'general', 'language', 'locale', 'data', 'directory', 'migrate', 'update', 'hardware', 'gpu'],
  appearance: ['appearance', 'theme', 'color', 'sidebar', 'ui', 'titlebar', 'linux'],
  minecraft: ['minecraft', 'java', 'memory', 'resolution', 'authlib', 'environment variables', 'quick launch', 'launch'],
  integrations: ['integrations', 'network', 'proxy', 'bmclapi', 'discord', 'streamer', 'developer', 'ai'],
  about: ['about', 'version', 'sponsors', 'contributors', 'debug', 'xmcl', 'info']
}

// Translation key mapping for localizing the search index
const sectionTranslationKeys: Record<string, string[]> = {
  system: [
    'setting.general', 'setting.language', 'setting.location', 
    'setting.enableDedicatedGPUOptimization', 'setting.advancedSettings',
    'setting.resetAllSettings', 'setting.exportSettings', 'setting.importSettings'
  ],
  appearance: [
    'setting.sidebarStyle', 'setting.sidebarPosition', 'setting.sidebarAlign', 
    'setting.sidebarScale', 'setting.sidebarAutoHide', 'setting.sidebarShowOnlyPinned',
    'setting.themeSettings', 'setting.themeStore.name', 'setting.themeBorderRadius',
    'setting.themeFont', 'setting.themeResetFont', 'setting.themeSelectFont',
    'setting.backgroundType', 'setting.backgroundImage', 'setting.backgroundVideo',
    'setting.backgroundMusic', 'setting.backgroundColorAbove', 'setting.colorTheme.name',
    'setting.darkTheme', 'setting.backgroundVideoVolume'
  ],
  minecraft: [
    'setting.quickLaunchSettings', 'instanceSetting.fastLaunch', 'instanceSetting.hideLauncher', 
    'instanceSetting.showLog', 'setting.authenticationSettings', 'instanceSetting.disableAuthlibInjector', 
    'instanceSetting.disableElyByAuthlib', 'java.memory', 'setting.memoryAssignment', 
    'setting.advancedJavaOptions', 'instance.prependCommand', 'instance.vmOptions', 
    'instance.vmVar', 'setting.minecraftOptions', 'instance.preExecCommand', 
    'instance.mcOptions', 'instance.resolution'
  ],
  integrations: [
    'setting.network', 'setting.useBmclAPI', 'setting.useProxy', 
    'setting.maxSocketsTitle', 'setting.enableDiscord', 'setting.disableTelemetry', 
    'setting.streamerMode', 'setting.developerMode', 'setting.replaceNative'
  ],
  about: [
    'setting.about', 'setting.aboutContributors', 'setting.aboutSponsors', 
    'setting.aboutLicense', 'setting.update', 'setting.latestVersion'
  ]
}

const sections = [
  { id: 'system', title: 'System', icon: 'dns' },
  { id: 'appearance', title: 'Appearance', icon: 'palette' },
  { id: 'minecraft', title: 'Minecraft', icon: 'videogame_asset' },
  { id: 'integrations', title: 'Integrations & Network', icon: 'hub' },
  { id: 'about', title: 'About', icon: 'info' },
]

function isSectionVisible(id: string) {
  if (!searchLower.value) return true
  
  const section = sections.find(s => s.id === id)
  if (section && section.title.toLowerCase().includes(searchLower.value)) return true
  
  if (sectionKeywords[id]?.some(k => k.includes(searchLower.value) || searchLower.value.includes(k))) return true
  
  const keys = sectionTranslationKeys[id] || []
  for (const key of keys) {
    const val = t(key).toLowerCase()
    if (val !== key && val.includes(searchLower.value)) return true
    
    const descKey = key.includes('.') ? `${key.split('.')[0]}.description` : `${key}Description`
    const descVal = t(descKey).toLowerCase()
    if (descVal !== descKey && descVal.includes(searchLower.value)) return true
    
    const hintKey = `${key}Hint`
    const hintVal = t(hintKey).toLowerCase()
    if (hintVal !== hintKey && hintVal.includes(searchLower.value)) return true
  }
  
  return false
}

const visibleSections = computed(() => {
  return sections.filter(s => isSectionVisible(s.id))
})

watch(searchQuery, () => {
  if (visibleSections.value.length > 0) {
    // Reset active tab to first visible when search changes
    activeSectionIndex.value = 0
  }
})

// Navigation Logic
const activeSectionIndex = ref(0)
const scrollContainer = ref<HTMLElement | null>(null)
const isUserScrolling = ref(false)
let scrollTimeout: ReturnType<typeof setTimeout> | null = null

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el && scrollContainer.value) {
    isUserScrolling.value = true
    
    // Account for sticky tabs height + search input in narrow view
    const stickyOffset = isNarrowView.value ? 140 : 40
    const offsetTop = el.offsetTop - stickyOffset
    scrollContainer.value.scrollTo({ top: offsetTop, behavior: 'smooth' })
    
    // Reset user scrolling flag after animation completes
    if (scrollTimeout) clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
      isUserScrolling.value = false
    }, 500)
  }
}

function onTabChange(index: number) {
  const section = visibleSections.value[index]
  if (section) {
    scrollTo(section.id)
  }
}

function onScroll() {
  if (!scrollContainer.value || isUserScrolling.value) return
  
  const container = scrollContainer.value
  const stickyOffset = isNarrowView.value ? 160 : 100
  const scrollTop = container.scrollTop + stickyOffset
  
  const visible = visibleSections.value
  for (let i = visible.length - 1; i >= 0; i--) {
    const el = document.getElementById(visible[i].id)
    if (el && el.offsetTop <= scrollTop) {
      activeSectionIndex.value = i
      break
    }
  }
}
</script>

<style scoped>
.setting-page {
  background: transparent;
}

.setting-sidebar {
  width: 260px;
  flex-shrink: 0;
  position: sticky;
  top: 32px;
  height: fit-content;
  max-height: calc(100vh - 64px);
  margin-left: 16px;
  margin-right: 8px;
}

:deep(.v-list) {
  background: transparent !important;
}

.sidebar-card {
  background: rgba(var(--v-theme-surface), 0.45) !important;
  backdrop-filter: blur(24px);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 18px !important;
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.3) !important;
}

.sidebar-subheader {
  font-size: 0.7rem !important;
  letter-spacing: 0.08em;
  font-weight: 700 !important;
  color: rgba(var(--v-theme-on-surface), 0.38) !important;
  padding-left: 16px !important;
  margin-top: 8px;
}

.sidebar-item {
  position: relative;
  padding-left: 16px !important;
  margin-bottom: 4px !important;
  border-radius: 8px !important;
  color: rgba(var(--v-theme-on-surface), 0.7) !important;
  font-weight: 500 !important;
  border: 1px solid transparent !important;
  transition: all 0.2s ease;
}
.sidebar-item:hover {
  color: rgba(var(--v-theme-on-surface), 0.95) !important;
  background: rgba(var(--v-theme-on-surface), 0.04) !important;
  border-color: rgba(var(--v-theme-on-surface), 0.05) !important;
}
.sidebar-item.v-list-item--selected {
  color: rgba(var(--v-theme-primary), 1) !important;
  background: rgba(var(--v-theme-primary), 0.08) !important;
  border-color: rgba(var(--v-theme-primary), 0.15) !important;
  font-weight: 600 !important;
}
/* Left indicator bar */
.sidebar-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 25%;
  height: 50%;
  width: 3px;
  background: rgba(var(--v-theme-primary), 1);
  border-radius: 0 4px 4px 0;
  opacity: 0;
  transition: opacity 0.2s, height 0.2s, top 0.2s;
}
.sidebar-item.v-list-item--selected::before {
  opacity: 1;
  height: 60%;
  top: 20%;
}

.search-input :deep(.v-field) {
  background: rgba(0, 0, 0, 0.15) !important;
  border-radius: 20px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  transition: all 0.2s ease;
  font-size: 0.85rem;
}
.search-input :deep(.v-field:hover),
.search-input :deep(.v-field--focused) {
  background: rgba(0, 0, 0, 0.3) !important;
  border-color: rgba(var(--v-theme-primary), 0.35);
}

.scroll-container {
  scroll-behavior: smooth;
  position: relative;
}

.scroll-container.has-sticky-tabs {
  padding-top: 0;
}

.sticky-tabs-wrapper {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(var(--v-theme-background), 0.85);
  backdrop-filter: blur(16px);
  margin-bottom: 16px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.content-wrapper {
  max-width: 80rem;
}

.scroll-target {
  scroll-margin-top: 100px;
}
.is-searching .scroll-target {
  scroll-margin-top: 40px; /* Reduces the gap when filtering */
}

/* Base high-contrast styling */
.v-list-subheader {
  color: rgba(var(--v-theme-on-surface), 0.7) !important;
}

/* Hide dividers adjacent to hidden settings items during search filtering */
:deep(.setting-item.is-hidden + .v-divider) {
  display: none !important;
}
:deep(.v-divider:has(+ .setting-item.is-hidden)) {
  display: none !important;
}
</style>