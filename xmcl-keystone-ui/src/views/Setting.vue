<template>
  <div class="d-flex fill-height setting-page">
    <!-- View Mode Toggle (Absolute Positioned or in Sidebar) -->
    <div class="view-mode-toggle" :class="{ 'in-sidebar': viewMode === 'scroll', 'top-right': viewMode === 'tabs' }">
      <v-tooltip bottom>
        <template #activator="{ on, attrs }">
          <v-btn
            icon
            small
            @click="toggleViewMode"
            v-bind="attrs"
            v-on="on"
          >
            <v-icon>{{ viewMode === 'scroll' ? 'view_stream' : 'tab' }}</v-icon>
          </v-btn>
        </template>
        <span>{{ viewMode === 'scroll' ? t('setting.viewModeScroll') : t('setting.viewModeTabs') }}</span>
      </v-tooltip>
    </div>

    <!-- Navigation Sidebar (Only in Scroll Mode) -->
    <div v-if="viewMode === 'scroll'" class="setting-sidebar pt-6 pl-4 pr-2 hidden-sm-and-down">
      <v-card class="rounded-lg" elevation="0" color="transparent">
        <v-list nav dense color="transparent" class="rounded-lg">
          <v-subheader class="text-uppercase font-weight-bold grey--text text--darken-1 text-caption pl-4 mb-1 d-flex align-center justify-space-between">
            {{ t('setting.title') }}
            <!-- Toggle inside sidebar header -->
             <v-btn icon x-small @click="toggleViewMode">
                <v-icon x-small>swap_horiz</v-icon>
             </v-btn>
          </v-subheader>
          <v-list-item-group v-model="activeSectionIndex" color="primary">
            <v-list-item
              v-for="item in sections"
              :key="item.id"
              @click="scrollTo(item.id)"
              class="mb-1 rounded-lg"
            >
              <v-list-item-icon class="mr-3">
                <v-icon small>{{ item.icon }}</v-icon>
              </v-list-item-icon>
              <v-list-item-content>
                <v-list-item-title class="font-weight-medium">{{ t(item.title) }}</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
          </v-list-item-group>
        </v-list>
      </v-card>
    </div>

    <!-- Content Area -->
    <div 
      class="flex-grow-1 overflow-y-auto fill-height pa-4 pa-md-6 scroll-container visible-scroll" 
      ref="scrollContainer"
      @scroll="onScroll"
    >
      <!-- Tabs Header (Only in Tabs Mode) -->
      <div v-if="viewMode === 'tabs'" class="d-flex justify-center mb-6">
        <v-tabs
          v-model="activeSectionIndex"
          centered
          background-color="transparent"
          color="primary"
          show-arrows
          class="rounded-lg"
          style="max-width: 900px;"
        >
          <v-tab v-for="item in sections" :key="item.id">
            <v-icon left small>{{ item.icon }}</v-icon>
            {{ t(item.title) }}
          </v-tab>
        </v-tabs>
      </div>

      <div class="content-wrapper mx-auto" :class="{ 'tabs-mode': viewMode === 'tabs' }">
        <!-- Scroll View: Render all sections -->
        <template v-if="viewMode === 'scroll'">
          <section id="general" class="mb-8 scroll-target"><SettingGeneral /></section>
          <section id="appearance" class="mb-8 scroll-target"><SettingAppearance /></section>
          <section id="global" class="mb-8 scroll-target"><SettingGlobal /></section>
          <section id="update" class="mb-8 scroll-target"><SettingUpdate /></section>
          <section id="network" class="mb-8 scroll-target">
            <SettingNetwork />
            <SettingYggdrasilServices class="mt-4" />
          </section>
          <section id="about" class="mb-12 scroll-target"><SettingAbout /></section>
        </template>

        <!-- Tabs View: Render only active section -->
        <template v-else>
          <v-fade-transition mode="out-in">
            <div :key="activeSectionIndex" class="tab-content">
              <SettingGeneral v-if="activeSectionIndex === 0" />
              <SettingAppearance v-if="activeSectionIndex === 1" />
              <SettingGlobal v-if="activeSectionIndex === 2" />
              <SettingUpdate v-if="activeSectionIndex === 3" />
              <div v-if="activeSectionIndex === 4">
                <SettingNetwork />
                <SettingYggdrasilServices class="mt-4" />
              </div>
              <SettingAbout v-if="activeSectionIndex === 5" />
            </div>
          </v-fade-transition>
        </template>
      </div>

      <SettingUpdateInfoDialog />
      <SettingMigrationDialog />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, provide, watch, Ref } from 'vue'
import { useI18n } from 'vue-i18n-bridge'
import SettingUpdateInfoDialog from './SettingUpdateInfoDialog.vue'
import SettingAppearance from './SettingAppearance.vue'
import SettingUpdate from './SettingUpdate.vue'
import SettingGeneral from './SettingGeneral.vue'
import SettingMigrationDialog from './SettingMigrationDialog.vue'
import SettingGlobal from './SettingGlobal.vue'
import SettingYggdrasilServices from './SettingYggdrasilServices.vue'
import SettingAbout from './SettingAbout.vue'
import SettingNetwork from './SettingNetwork.vue'
import { usePresence } from '@/composables/presence'
import { kUpdateSettings, useUpdateSettings } from '@/composables/setting'
import { injection } from '@/util/inject'
import { kTheme } from '@/composables/theme'
import { useLocalStorageCacheStringValue } from '@/composables/cache'

const { t } = useI18n()
usePresence(computed(() => t('presence.setting')))

provide(kUpdateSettings, useUpdateSettings())

const { suppressed } = injection(kTheme)

onMounted(() => {
  suppressed.value = true
})
onUnmounted(() => {
  suppressed.value = false
})

// View Mode State
const viewMode = useLocalStorageCacheStringValue('settingsViewMode', 'scroll') as Ref<'scroll' | 'tabs'>

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'scroll' ? 'tabs' : 'scroll'
}

// Navigation Logic
const activeSectionIndex = ref(0)
const scrollContainer = ref<HTMLElement | null>(null)

const sections = [
  { id: 'general', title: 'setting.general', icon: 'tune' },
  { id: 'appearance', title: 'setting.appearance', icon: 'palette' },
  { id: 'global', title: 'setting.globalSetting', icon: 'videogame_asset' },
  { id: 'update', title: 'setting.update', icon: 'system_update' },
  { id: 'network', title: 'setting.network', icon: 'wifi' },
  { id: 'about', title: 'setting.about', icon: 'info' },
]

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el && scrollContainer.value) {
    const offsetTop = el.offsetTop - 20
    scrollContainer.value.scrollTo({ top: offsetTop, behavior: 'smooth' })
  }
}

function onScroll() {
  if (viewMode.value !== 'scroll' || !scrollContainer.value) return
  
  const container = scrollContainer.value
  const scrollTop = container.scrollTop + 100
  
  for (let i = sections.length - 1; i >= 0; i--) {
    const el = document.getElementById(sections[i].id)
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
  width: 220px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: fit-content;
  max-height: 100vh;
}

.scroll-container {
  scroll-behavior: smooth;
}

.content-wrapper {
  max-width: 900px;
}

.content-wrapper.tabs-mode {
  max-width: 800px;
}

.tab-content {
  min-height: 400px;
}

/* View Mode Toggle Positioning */
.view-mode-toggle {
  position: absolute;
  z-index: 10;
  transition: all 0.3s ease;
}

.view-mode-toggle.in-sidebar {
  display: none;
}

.view-mode-toggle.top-right {
  top: 16px;
  right: 24px;
}

/* Section spacing */
.scroll-target {
  scroll-margin-top: 20px;
}
</style>