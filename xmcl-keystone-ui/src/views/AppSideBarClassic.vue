<template>
  <div
    v-if="!isHorizontal"
    data-testid="app-sidebar"
    role="navigation"
    aria-orientation="vertical"
    :aria-label="navigationAriaLabel"
    class="sidebar moveable z-10"
    :style="{ 'backdrop-filter': `blur(${blurSidebar}px)`, backgroundColor: sideBarColor }"
  >
    <div v-roving-tabindex role="group" class="sidebar__section">
      <button
        v-shared-tooltip.right="() => t('shared.back')"
        type="button"
        class="sidebar-back-btn non-moveable"
        :aria-label="backAriaLabel"
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
        to="/me"
        :aria-label="myStuffAriaLabel"
      >
        <PlayerAvatar
          class="overflow-hidden rounded-full"
          :src="gameProfile?.textures?.SKIN?.url"
          :dimension="32"
        />
      </AppSideBarItem>

      <AppSideBarItem
        data-testid="nav-store"
        v-shared-tooltip.right="() => t('store.name', 2)"
        to="/store"
        :aria-label="storeAriaLabel"
      >
        <v-icon class="sidebar-item__icon" :size="28">
          store
        </v-icon>
      </AppSideBarItem>
    </div>

    <div class="sidebar__divider" />

    <div
      ref="instancesScrollEl"
      v-roving-tabindex
      role="group"
      class="sidebar__instances"
    >
      <AppSideBarInstances />
    </div>

    <div class="sidebar__divider" />

    <div v-roving-tabindex role="group" class="sidebar__section">
      <AppSideBarItem
        data-testid="nav-multiplayer"
        v-shared-tooltip.right="() => t('multiplayer.name')"
        clickable
        :aria-label="multiplayerAriaLabel"
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
        :aria-label="settingsAriaLabel"
      >
        <v-badge
          right
          overlap
          :model-value="state?.updateStatus !== 'none'"
        >
          <template #badge>
            <span aria-hidden="true">{{ 1 }}</span>
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
    role="navigation"
    aria-orientation="horizontal"
    :aria-label="navigationAriaLabel"
    class="sidebar-horizontal moveable z-10 rounded-[0.75rem] flex flex-row items-center px-2 h-12 mx-2 my-2 elevation-4"
    :style="{ 'backdrop-filter': `blur(${blurSidebar}px)`, backgroundColor: sideBarColor }"
  >
    <div v-roving-tabindex role="group" class="flex flex-row items-center flex-grow-0">
      <v-btn
        v-shared-tooltip.bottom="t('shared.back')"
        icon
        :aria-label="backAriaLabel"
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
        :aria-label="myStuffAriaLabel"
        class="non-moveable mr-1"
      >
        <PlayerAvatar
          class="overflow-hidden rounded-full"
          :src="gameProfile?.textures?.SKIN?.url"
          :dimension="28"
        />
      </v-btn>

      <v-btn
        data-testid="nav-store"
        v-shared-tooltip.bottom="t('store.name', 2)"
        icon
        to="/store"
        :aria-label="storeAriaLabel"
        class="non-moveable mr-1"
      >
        <v-icon :size="28">store</v-icon>
      </v-btn>

      <v-divider vertical class="mx-2 h-6" />
    </div>

    <div class="flex-grow-1 overflow-hidden h-full flex items-center relative" style="min-width: 0;" v-roving-tabindex role="group">
      <AppSideBarInstances />
    </div>

    <div v-roving-tabindex role="group" class="flex flex-row items-center flex-grow-0">
      <v-divider vertical class="mx-2 h-6" />

      <v-btn
        data-testid="nav-multiplayer"
        v-shared-tooltip.bottom="t('multiplayer.name')"
        icon
        :aria-label="multiplayerAriaLabel"
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
        :aria-label="settingsAriaLabel"
        class="non-moveable"
      >
        <v-badge
          right
          overlap
          :model-value="state?.updateStatus !== 'none'"
        >
          <template #badge>
            <span aria-hidden="true">{{ 1 }}</span>
          </template>
          <v-icon>settings</v-icon>
        </v-badge>
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts" setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { useDragAutoScroll } from '@/composables/dragAutoScroll'
import { kSettingsState } from '@/composables/setting'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'
import { kTheme } from '@/composables/theme'
import { kUserContext } from '@/composables/user'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { useEventListener } from '@vueuse/core'
import AppSideBarInstances from './AppSideBarInstances.vue'
import AppSideBarItem from './AppSideBarItem.vue'

const { blurSidebar, sideBarColor } = injection(kTheme)
const { state } = injection(kSettingsState)
const { gameProfile } = injection(kUserContext)
const { position } = useInjectSidebarSettings()

const isHorizontal = computed(() => position.value === 'top' || position.value === 'bottom')

const { t } = useI18n()
const { back } = useRouter()

const navigationAriaLabel = 'Sidebar navigation'
const backAriaLabel = computed(() => t('shared.back'))
const myStuffAriaLabel = computed(() => t('myStuff'))
const storeAriaLabel = computed(() => t('store.name', 2))
const multiplayerAriaLabel = computed(() => t('multiplayer.name'))
const settingsAriaLabel = computed(() => t('setting.name', 2))

function goBack() {
  back()
}

function goMultiplayer() {
  windowController.openMultiplayerWindow()
}

// Global hotkey: Alt+Left arrow goes back, mirroring the back button.
// Ignored when focus is inside a text input / textarea / contenteditable
// so users editing text aren't surprised by an unwanted navigation.
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (!e.altKey || e.key !== 'ArrowLeft') return
  if (e.ctrlKey || e.metaKey || e.shiftKey) return
  const target = e.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
  }
  e.preventDefault()
  goBack()
})

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
  border-radius: var(--surface-menu-item-radius);
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
