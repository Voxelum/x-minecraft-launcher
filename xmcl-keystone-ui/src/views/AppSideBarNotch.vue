<template>
  <div
    class="sidebar-notch-wrapper"
    :class="wrapperClasses"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <!-- Trigger zone for detecting hover when sidebar is hidden -->
    <div
      v-if="autoHide"
      class="sidebar-trigger"
      :class="triggerClasses"
    />
    
    <div
      class="sidebar-notch moveable"
      :class="sidebarClasses"
      :style="wrapperStyles"
    >
      <div class="sidebar-notch__container" :style="containerStyles">
        <!-- Back Button -->
        <div
          class="sidebar-notch__item non-moveable"
          @click="goBack"
        >
          <v-icon class="sidebar-notch__icon" :size="iconSize">arrow_back</v-icon>
        </div>

        <!-- My Stuff -->
        <router-link
          id="my-stuff-button"
          v-shared-tooltip="() => t('myStuff')"
          to="/me"
          class="sidebar-notch__item sidebar-notch__item--link non-moveable"
        >
          <v-icon class="sidebar-notch__icon" :size="iconSize">widgets</v-icon>
        </router-link>

        <!-- Store -->
        <router-link
          v-if="true"
          v-shared-tooltip="() => t('store.name', 2)"
          to="/store"
          class="sidebar-notch__item sidebar-notch__item--link non-moveable"
        >
          <v-icon class="sidebar-notch__icon" :size="iconSize">store</v-icon>
        </router-link>

        <div class="sidebar-notch__divider" />

        <!-- Instance List (compact mode) -->
        <div class="sidebar-notch__instances">
          <AppSideBarContentNext :compact="true" :horizontal="isHorizontal" :maxInstances="3" />
        </div>

        <div class="sidebar-notch__spacer" />

        <!-- Multiplayer -->
        <div
          v-shared-tooltip="() => t('multiplayer.name')"
          class="sidebar-notch__item sidebar-notch__item--link non-moveable"
          @click="goMultiplayer"
        >
          <v-icon class="sidebar-notch__icon" :size="iconSize">hub</v-icon>
        </div>

        <div class="sidebar-notch__divider" />

        <!-- Settings -->
        <router-link
          v-shared-tooltip="() => t('setting.name', 2)"
          to="/setting"
          class="sidebar-notch__item sidebar-notch__item--link non-moveable"
        >
          <v-badge
            right
            overlap
            :value="state?.updateStatus !== 'none'"
          >
            <template #badge>
              <span>{{ 1 }}</span>
            </template>
            <v-icon class="sidebar-notch__icon" :size="iconSize">settings</v-icon>
          </v-badge>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { kSettingsState } from '@/composables/setting'
import { injection } from '@/util/inject'
import AppSideBarContentNext from './AppSideBarContentNext.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { kTheme } from '@/composables/theme'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'

const { blurSidebar, sideBarColor } = injection(kTheme)
const { state } = injection(kSettingsState)
const { position, align, scale, autoHide } = useInjectSidebarSettings()

const { t } = useI18n()
const { back } = useRouter()

// Hover state for auto-hide
const isHovered = ref(false)
let hideTimeout: ReturnType<typeof setTimeout> | null = null

const isHorizontal = computed(() => position.value === 'top' || position.value === 'bottom')
const isVertical = computed(() => position.value === 'left' || position.value === 'right')
const iconSize = computed(() => isHorizontal.value ? 20 : 22)

const shouldHide = computed(() => autoHide.value && !isHovered.value)

// Wrapper classes for positioning
const wrapperClasses = computed(() => ({
  'wrapper--left': position.value === 'left',
  'wrapper--right': position.value === 'right',
  'wrapper--top': position.value === 'top',
  'wrapper--bottom': position.value === 'bottom',
  'wrapper--auto-hide': autoHide.value,
}))

// Trigger zone classes
const triggerClasses = computed(() => ({
  'trigger--left': position.value === 'left',
  'trigger--right': position.value === 'right',
  'trigger--top': position.value === 'top',
  'trigger--bottom': position.value === 'bottom',
}))

const sidebarClasses = computed(() => ({
  'sidebar-notch--horizontal': isHorizontal.value,
  'sidebar-notch--vertical': isVertical.value,
  'sidebar-notch--top': position.value === 'top',
  'sidebar-notch--bottom': position.value === 'bottom',
  'sidebar-notch--left': position.value === 'left',
  'sidebar-notch--right': position.value === 'right',
  'sidebar-notch--hidden': shouldHide.value,
}))

const containerStyles = computed(() => {
  const styles: any = {
    backgroundColor: sideBarColor.value,
    transform: `scale(${scale.value / 100})`,
  }
  
  let originX = 'center'
  let originY = 'center'

  if (isVertical.value) {
    originX = position.value === 'left' ? 'left' : 'right'
    if (align.value === 'start') originY = 'top'
    if (align.value === 'end') originY = 'bottom'
  } else {
    originY = position.value === 'top' ? 'top' : 'bottom'
    if (align.value === 'start') originX = 'left'
    if (align.value === 'end') originX = 'right'
  }
  
  styles.transformOrigin = `${originX} ${originY}`
  return styles
})

const wrapperStyles = computed(() => {
  const styles: any = {
    'backdrop-filter': `blur(${blurSidebar.value}px)`
  }

  if (isVertical.value) {
    if (align.value === 'start') styles.justifyContent = 'flex-start'
    if (align.value === 'center') styles.justifyContent = 'center'
    if (align.value === 'end') styles.justifyContent = 'flex-end'
  } else {
    if (align.value === 'start') styles.justifyContent = 'flex-start'
    if (align.value === 'center') styles.justifyContent = 'center'
    if (align.value === 'end') styles.justifyContent = 'flex-end'
  }

  return styles
})

function onMouseEnter() {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  isHovered.value = true
}

function onMouseLeave() {
  if (autoHide.value) {
    hideTimeout = setTimeout(() => {
      isHovered.value = false
    }, 500)
  }
}

function goBack() {
  back()
}

function goMultiplayer() {
  windowController.openMultiplayerWindow()
}
</script>

<style scoped>
/* Wrapper positioning */
.sidebar-notch-wrapper {
  position: relative;
  display: flex;
  z-index: 10;
  pointer-events: none; /* Let clicks pass through wrapper */
}

/* When auto-hide is on, use fixed positioning */
.sidebar-notch-wrapper.wrapper--auto-hide {
  position: fixed;
  z-index: 100;
}

.sidebar-notch-wrapper.wrapper--auto-hide.wrapper--left {
  left: 0;
  top: 58px; /* Start below window title bar */
  bottom: 0;
}

.sidebar-notch-wrapper.wrapper--auto-hide.wrapper--right {
  right: 0;
  top: 58px; /* Start below window title bar */
  bottom: 0;
}

.sidebar-notch-wrapper.wrapper--auto-hide.wrapper--top {
  top: 0;
  left: 0;
  right: 0;
  z-index: 102; /* Ensure top sidebar is above window controls if it MUST be there, but might need offset too */
}

.sidebar-notch-wrapper.wrapper--auto-hide.wrapper--bottom {
  bottom: 0;
  left: 0;
  right: 0;
}

/* Trigger zone - always visible for hover detection */
.sidebar-trigger {
  position: absolute;
  z-index: 101;
  pointer-events: auto; /* Re-enable pointer events for trigger */
}

.trigger--left {
  left: 0;
  top: 58px; /* Match safe area */
  bottom: 0;
  width: 12px;
}

.trigger--right {
  right: 0;
  top: 58px; /* Match safe area */
  bottom: 0;
  width: 12px;
}

.trigger--top {
  top: 0;
  left: 80px; 
  right: 120px; 
  height: 12px;
}

.trigger--bottom {
  bottom: 0;
  left: 0;
  right: 0;
  height: 12px;
}

/* Sidebar base styles */
.sidebar-notch {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  pointer-events: none; /* Crucial: Do not block clicks on empty/padding areas */
}

/* Hidden state animations */
.sidebar-notch--hidden.sidebar-notch--left {
  transform: translateX(-100%);
  opacity: 0;
}

.sidebar-notch--hidden.sidebar-notch--right {
  transform: translateX(100%);
  opacity: 0;
}

.sidebar-notch--hidden.sidebar-notch--top {
  transform: translateY(-100%);
  opacity: 0;
}

.sidebar-notch--hidden.sidebar-notch--bottom {
  transform: translateY(100%);
  opacity: 0;
}

.sidebar-notch--vertical {
  flex-direction: column;
  min-height: 100%;
  padding: 12px 8px;
  /* padding-top removed in favor of top offset on wrapper */
}

.sidebar-notch--horizontal {
  flex-direction: row;
  width: 100%;
  padding: 8px 12px;
}

.sidebar-notch--right {
  justify-content: flex-end;
}

.sidebar-notch--bottom {
  align-items: flex-end;
}

.sidebar-notch__container {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 8px 6px;
  border-radius: 20px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto; /* Re-enable pointer events ONLY for the container */
}

.sidebar-notch--vertical .sidebar-notch__container {
  flex-direction: column;
  min-width: 56px;
  max-width: 56px;
}

.sidebar-notch--horizontal .sidebar-notch__container {
  flex-direction: row;
  min-height: 56px;
  max-height: 56px;
}

.sidebar-notch__item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.sidebar-notch__item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-notch__item:hover::before {
  opacity: 0.08;
}

.sidebar-notch__item:active::before {
  opacity: 0.12;
}

.sidebar-notch__item--link {
  text-decoration: none;
  color: inherit;
}

.sidebar-notch__icon {
  position: relative;
  z-index: 1;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-notch__item:hover .sidebar-notch__icon {
  transform: scale(1.08);
}

.sidebar-notch__item:active .sidebar-notch__icon {
  transform: scale(0.96);
}

.sidebar-notch__divider {
  background: currentColor;
  opacity: 0.12;
  border-radius: 1px;
  flex-shrink: 0;
}

.sidebar-notch--vertical .sidebar-notch__divider {
  width: 28px;
  height: 2px;
  margin: 2px 0;
}

.sidebar-notch--horizontal .sidebar-notch__divider {
  width: 2px;
  height: 28px;
  margin: 0 2px;
}

.sidebar-notch__spacer {
  flex: 1;
  min-width: 4px;
  min-height: 4px;
}

.sidebar-notch__instances {
  display: flex;
  gap: 3px;
  flex-shrink: 1;
  overflow: hidden;
  background: transparent !important;
}

.sidebar-notch--vertical .sidebar-notch__instances {
  flex-direction: column;
  max-height: 300px;
  overflow-y: auto;
}

.sidebar-notch--horizontal .sidebar-notch__instances {
  flex-direction: row;
  max-width: 400px;
  overflow-x: auto;
}

.sidebar-notch__instances::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.sidebar-notch__instances :deep(.v-list) {
  background: transparent !important;
  padding: 0 !important;
}

.sidebar-notch__instances :deep(.v-list-item) {
  background: transparent !important;
  padding: 0 !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  margin: 0 !important;
}

.sidebar-notch__instances :deep(.v-list-item::before),
.sidebar-notch__instances :deep(.v-list-item::after) {
  display: none !important;
}

.sidebar-notch__instances :deep(.sidebar-item) {
  background: transparent !important;
}

/* Remove default Vuetify padding from v-list-item */
.sidebar-notch__instances :deep(.v-list-item) {
  min-height: unset;
  height: 40px;
}

/* Ensure icons are centered */
.sidebar-notch__instances :deep(.v-list-item__icon) {
  margin: 0 !important;
}

/* Fix for v-list inside sidebar */
.sidebar-notch__instances :deep(.v-list-item__content) {
  padding: 0;
}
</style>

<style>
.dark .sidebar-notch__item .theme--dark.v-icon {
  color: var(--icon-color);
}

.dark .sidebar-notch__item:hover .theme--dark.v-icon {
  color: var(--icon-color-hovered);
}

.sidebar-notch__item.router-link-active,
.sidebar-notch__item.router-link-active .v-icon {
  color: var(--color-primary);
}

.sidebar-notch__item.router-link-active::before {
  opacity: 0.12;
  background: var(--color-primary);
}
</style>
