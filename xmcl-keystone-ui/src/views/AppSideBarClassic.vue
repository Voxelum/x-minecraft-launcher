<template>
  <div
    v-if="!isHorizontal"
    data-testid="app-sidebar"
    class="sidebar moveable z-10"
    :style="{ 'backdrop-filter': `blur(${blurSidebar}px)`, backgroundColor: sideBarColor }"
  >
    <div class="sidebar__section">
      <button
        v-shared-tooltip.right="() => t('shared.back')"
        type="button"
        class="sidebar-back-btn non-moveable"
        @click="goBack"
      >
        <v-icon :size="18">
          arrow_back
        </v-icon>
      </button>

      <AppSideBarItem
        id="my-stuff-button"
        data-testid="nav-accounts"
        v-shared-tooltip.right="() => t('myStuff')"
        icon="widgets"
        to="/me"
      />

      <AppSideBarItem
        data-testid="nav-store"
        v-shared-tooltip.right="() => t('store.name', 2)"
        to="/store"
      >
        <v-icon class="sidebar-item__icon" :size="28">
          store
        </v-icon>
      </AppSideBarItem>
    </div>

    <div class="sidebar__divider" />

    <div
      ref="instancesScrollEl"
      class="sidebar__instances"
    >
      <AppSideBarInstances />
    </div>

    <div class="sidebar__divider" />

    <div class="sidebar__section">
      <AppSideBarItem
        data-testid="nav-multiplayer"
        v-shared-tooltip.right="() => t('multiplayer.name')"
        clickable
        @click="goMultiplayer"
      >
        <v-icon class="sidebar-item__icon" :size="23">
          hub
        </v-icon>
      </AppSideBarItem>

      <AppSideBarItem
        data-testid="nav-settings"
        v-shared-tooltip.right="() => t('setting.name', 2)"
        to="/setting"
      >
        <v-badge
          right
          overlap
          :model-value="state?.updateStatus !== 'none'"
        >
          <template #badge>
            <span>{{ 1 }}</span>
          </template>
          <v-icon class="sidebar-item__icon">
            settings
          </v-icon>
        </v-badge>
      </AppSideBarItem>
    </div>
  </div>

  <div
    v-else
    class="sidebar-horizontal moveable z-10 rounded-[0.75rem] flex flex-row items-center px-2 h-12 mx-2 my-2 elevation-4"
    :style="{ 'backdrop-filter': `blur(${blurSidebar}px)`, backgroundColor: sideBarColor }"
  >
    <div class="flex flex-row items-center flex-grow-0">
      <v-btn
        v-shared-tooltip.bottom="t('back')"
        icon
        class="non-moveable mr-1"
        @click="goBack"
      >
        <v-icon>arrow_back</v-icon>
      </v-btn>

      <v-btn
        id="my-stuff-button"
        data-testid="nav-accounts"
        v-shared-tooltip.bottom="t('myStuff')"
        icon
        to="/me"
        class="non-moveable mr-1"
      >
        <v-icon>widgets</v-icon>
      </v-btn>

      <v-btn
        data-testid="nav-store"
        v-shared-tooltip.bottom="t('store.name', 2)"
        icon
        to="/store"
        class="non-moveable mr-1"
      >
        <v-icon :size="28">store</v-icon>
      </v-btn>

      <v-divider vertical class="mx-2 h-6" />
    </div>

    <div class="flex-grow-1 overflow-hidden h-full flex items-center relative" style="min-width: 0;">
      <AppSideBarInstances />
    </div>

    <div class="flex flex-row items-center flex-grow-0">
      <v-divider vertical class="mx-2 h-6" />

      <v-btn
        data-testid="nav-multiplayer"
        v-shared-tooltip.bottom="t('multiplayer.name')"
        icon
        class="non-moveable mr-1"
        @click="goMultiplayer"
      >
        <v-icon :size="23">hub</v-icon>
      </v-btn>

      <v-btn
        data-testid="nav-settings"
        v-shared-tooltip.bottom="t('setting.name', 2)"
        icon
        to="/setting"
        class="non-moveable"
      >
        <v-badge
          right
          overlap
          :model-value="state?.updateStatus !== 'none'"
        >
          <template #badge>
            <span>{{ 1 }}</span>
          </template>
          <v-icon>settings</v-icon>
        </v-badge>
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useDragAutoScroll } from '@/composables/dragAutoScroll'
import { kSettingsState } from '@/composables/setting'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'
import { kTheme } from '@/composables/theme'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import AppSideBarInstances from './AppSideBarInstances.vue'
import AppSideBarItem from './AppSideBarItem.vue'

const { blurSidebar, sideBarColor } = injection(kTheme)
const { state } = injection(kSettingsState)
const { position } = useInjectSidebarSettings()

const isHorizontal = computed(() => position.value === 'top' || position.value === 'bottom')

const { t } = useI18n()
const { back } = useRouter()

function goBack() {
  back()
}

function goMultiplayer() {
  windowController.openMultiplayerWindow()
}

// gh #1396 — Auto-scroll the instances container while an instance is being
// dragged near its top/bottom edge. (Mouse-wheel scrolling during a native
// HTML5 drag isn't possible — Chromium suppresses wheel events for the
// duration of the drag.)
const instancesScrollEl = ref<HTMLDivElement | null>(null)
useDragAutoScroll(instancesScrollEl)
</script>

<style scoped>
.sidebar {
  min-width: 80px;
  width: 80px;
  max-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  border-radius: 0.75rem;
  padding: 8px 0;
  overflow: hidden;
}

.sidebar__section {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  padding: 0 4px;
}

.sidebar__instances {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 4px;
  scrollbar-width: none;
}

.sidebar__instances::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.sidebar__divider {
  margin: 6px 16px;
  height: 2px;
  border-radius: 1px;
  background-color: rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
}

/* Rounded rectangle back button (mimics v2 list-item) */
.sidebar-back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 32px;
  margin: 4px auto 8px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background-color: transparent;
  color: inherit;
  cursor: pointer;
  transition:
    background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-back-btn:hover {
  background-color: rgba(255, 255, 255, 0.12);
}

.sidebar-back-btn:active {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>
