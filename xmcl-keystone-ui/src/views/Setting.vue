<template>
  <div data-testid="settings-page" class="d-flex fill-height setting-page">
    <!-- Navigation Sidebar (Only in Wide/Scroll Mode) -->
    <nav
      v-if="!isNarrowView"
      id="settings-nav"
      class="setting-sidebar pt-6 pl-4 pr-2"
      :aria-label="t('setting.name', 2)"
    >
      <v-card class="surface-card-subsection" :elevation="tokens.cardSubsectionElevation.value">
        <v-list ref="sidebarContainer" nav density="compact" color="transparent">
          <v-list-subheader
            class="text-uppercase font-weight-bold grey--text text--darken-1 text-caption pl-4 mb-1"
          >
            {{ t('setting.name') }}
          </v-list-subheader>

          <v-list-item
            v-for="(item, idx) in sections"
            :key="item.id"
            :id="`sidebar-${item.id}`"
            :active="activeSectionIndex === idx"
            class="mb-1 rounded-lg"
            color="primary"
            :title="t(item.title)"
            @click="scrollTo(item.id)"
          >
            <template #prepend>
              <v-icon size="small">{{ item.icon }}</v-icon>
            </template>
          </v-list-item>
        </v-list>
      </v-card>
    </nav>

    <!-- Content Area -->
    <div
      class="flex-grow-1 overflow-y-auto fill-height scroll-container visible-scroll"
      :class="{ 'has-sticky-tabs': isNarrowView }"
      ref="scrollContainer"
      @scroll="onScroll"
      @scrollend="onScrollEnd"
    >
      <!-- Sticky Tabs Header (Only in Narrow/Tabs Mode) -->
      <div v-if="isNarrowView" class="sticky-tabs-wrapper">
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
          <v-tab v-for="item in sections" :key="item.id">
            <v-icon start size="small">{{ item.icon }}</v-icon>
            {{ t(item.title) }}
          </v-tab>
        </v-tabs>
      </div>

      <div class="content-wrapper mx-auto pa-4 pa-md-6" :class="{ 'tabs-mode': isNarrowView }">
        <!-- All sections rendered vertically in both modes -->
        <section
          id="general"
          class="mb-8 scroll-target"
          role="region"
          :aria-label="t('setting.general')"
        >
          <SettingHeader :title="t('setting.general')" icon="tune" />
          <SettingGeneral class="mb-4" />
          <SettingAdvanced />
        </section>
        <section
          id="appearance"
          class="mb-8 scroll-target"
          role="region"
          :aria-label="t('setting.appearance')"
        >
          <SettingHeader
            icon="palette"
            :title="t('setting.appearance')"
            :subtitle="t('setting.appearanceDescription')"
          />
          <SettingGlobalUI />
        </section>
        <section
          id="global"
          class="mb-8 scroll-target"
          role="region"
          :aria-label="t('setting.globalSetting')"
        >
          <SettingHeader
            :title="t('setting.globalSetting')"
            :subtitle="t('setting.globalSettingHint')"
            icon="videogame_asset"
          />
          <SettingGlobal />
        </section>
        <section id="java" class="mb-8 scroll-target" role="region" :aria-label="t('setting.java')">
          <SettingHeader :title="t('setting.java')" icon="coffee" />
          <SettingJava />
        </section>
        <section
          id="network"
          class="mb-8 scroll-target"
          role="region"
          :aria-label="t('setting.network')"
        >
          <SettingHeader :title="t('setting.network')" icon="wifi" />
          <SettingNetwork />
        </section>
        <section
          id="backup"
          class="mb-8 scroll-target"
          role="region"
          :aria-label="t('backup.title')"
        >
          <SettingHeader
            :title="t('backup.title')"
            :subtitle="t('backup.description')"
            icon="archive"
          />
          <SettingBackup />
        </section>
        <section
          id="about"
          class="mb-12 scroll-target"
          role="region"
          :aria-label="t('setting.about')"
        >
          <SettingHeader :title="t('setting.about')" icon="info" />
          <SettingUpdate class="mb-4" />
          <SettingAbout />
        </section>
      </div>

      <SettingJavaInstaller />

      <SettingUpdateInfoDialog />
      <SettingMigrationDialog />
      <BackupCreateDialog />
      <BackupRestoreDialog />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, onMounted, onUnmounted, provide, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingUpdateInfoDialog from './SettingUpdateInfoDialog.vue'
import SettingUpdate from './SettingUpdate.vue'
import SettingGeneral from './SettingGeneral.vue'
import SettingMigrationDialog from './SettingMigrationDialog.vue'
import SettingGlobal from './SettingGlobal.vue'
import SettingAbout from './SettingAbout.vue'
import SettingNetwork from './SettingNetwork.vue'
import SettingBackup from './SettingBackup.vue'
import BackupCreateDialog from './BackupCreateDialog.vue'
import BackupRestoreDialog from './BackupRestoreDialog.vue'
import { usePresence } from '@/composables/presence'
import { useTutorial } from '@/composables/tutorial'
import { kUpdateSettings, useUpdateSettings } from '@/composables/setting'
import { kSurfaceTokens } from '@/composables/surfaceTokens'
import { injection } from '@/util/inject'
import { kTheme } from '@/composables/theme'
import SettingGlobalUI from './SettingGlobalUI.vue'
import { useMediaQuery } from '@vueuse/core'
import SettingAdvanced from './SettingAdvanced.vue'
import SettingHeader from '@/components/SettingHeader.vue'
import SettingJava from './SettingJava.vue'
import SettingJavaInstaller from './SettingJavaInstaller.vue'

const { t } = useI18n()
const route = useRoute()
usePresence(computed(() => t('presence.setting')))

provide(kUpdateSettings, useUpdateSettings())

const { suppressed } = injection(kTheme)
const tokens = injection(kSurfaceTokens)

const NARROW_BREAKPOINT = 960 // Switch to tabs view when window is narrower than this
const isNarrowView = useMediaQuery(`(max-width: ${NARROW_BREAKPOINT - 1}px)`)

// Navigation Logic
const activeSectionIndex = ref(0)
const scrollContainer = ref<HTMLElement | null>(null)
const sidebarContainer = ref<any>(null)

const sections = [
  { id: 'general', title: 'setting.general', icon: 'tune' },
  { id: 'appearance', title: 'setting.appearance', icon: 'palette' },
  { id: 'global', title: 'setting.globalSetting', icon: 'videogame_asset' },
  { id: 'java', title: 'setting.java', icon: 'coffee' },
  { id: 'network', title: 'setting.network', icon: 'wifi' },
  { id: 'backup', title: 'backup.title', icon: 'archive' },
  { id: 'about', title: 'setting.about', icon: 'info' },
]

async function revealRouteTarget() {
  if (route.query.target !== 'agent') return
  await nextTick()
  const target = document.getElementById('agent-settings')
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  target?.querySelector<HTMLElement>('input')?.focus()
}

watch(() => route.query.target, revealRouteTarget)

function getSidebarElement(): HTMLElement | null {
  return (sidebarContainer.value?.$el as HTMLElement) ?? null
}

function scrollTo(id: string) {
  const container = scrollContainer.value
  const element = document.getElementById(id)

  if (!container || !element) return

  const stickyOffset = isNarrowView.value ? 60 : 20

  const offset =
    element.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop

  container.scrollTo({
    top: offset - stickyOffset,
    behavior: 'smooth',
  })
}

function scrollSidebarToActiveItem() {
  const sidebar = getSidebarElement()
  const item = sections[activeSectionIndex.value]

  if (!sidebar || !item) return

  const activeElement = document.getElementById(`sidebar-${item.id}`)
  if (!activeElement) return

  const sidebarRect = sidebar.getBoundingClientRect()
  const itemRect = activeElement.getBoundingClientRect()

  if (itemRect.top >= sidebarRect.top && itemRect.bottom <= sidebarRect.bottom) return

  const offset = itemRect.top - sidebarRect.top + sidebar.scrollTop

  sidebar.scrollTo({
    top: offset - sidebar.clientHeight / 2 + activeElement.clientHeight / 2,
    behavior: 'smooth',
  })
}

function updateActiveSection() {
  const container = scrollContainer.value
  if (!container) return

  const threshold = container.getBoundingClientRect().top + (isNarrowView.value ? 80 : 100)

  let sectionIndex = 0

  for (let i = sections.length - 1; i >= 0; i--) {
    const element = document.getElementById(sections[i].id)

    if (element && element.getBoundingClientRect().top <= threshold) {
      sectionIndex = i
      break
    }
  }

  activeSectionIndex.value = sectionIndex
  scrollSidebarToActiveItem()
}

function onScroll() {
  updateActiveSection()
}

function onScrollEnd() {
  updateActiveSection()
}

function onTabChange(index: number) {
  const section = sections[index]
  if (section) scrollTo(section.id)
}

useTutorial(
  computed(() => [
    {
      element: '#settings-nav',
      popover: {
        title: t('setting.name', 2),
        description: t('tutorial.settings.navDescription'),
      },
    },
    {
      element: '#general',
      popover: {
        title: t('setting.general'),
        description: t('tutorial.settings.generalDescription'),
      },
    },
    {
      element: '#appearance',
      popover: {
        title: t('setting.appearance'),
        description: t('tutorial.settings.appearanceDescription'),
      },
    },
    {
      element: '#global',
      popover: {
        title: t('setting.globalSetting'),
        description: t('tutorial.settings.globalDescription'),
      },
    },
    {
      element: '#java',
      popover: {
        title: t('setting.java'),
        description: t('tutorial.settings.javaDescription'),
      },
    },
    {
      element: '#network',
      popover: {
        title: t('setting.network'),
        description: t('tutorial.settings.networkDescription'),
      },
    },
  ]),
)

onMounted(async () => {
  suppressed.value = true

  await nextTick()
  requestAnimationFrame(updateActiveSection)

  revealRouteTarget()
})

onUnmounted(() => {
  suppressed.value = false
})
</script>

<style scoped>
.setting-page {
  background: transparent;
  user-select: none;
}

.setting-sidebar {
  width: fit-content;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: fit-content;
  max-height: 100vh;
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
  background: rgba(var(--v-theme-surface), 0.95);
  backdrop-filter: blur(8px);
  padding: 8px 0;
  margin-bottom: 16px;
}

.content-wrapper {
  max-width: 80rem;
}

.scroll-target {
  scroll-margin-top: 80px;
}
</style>
