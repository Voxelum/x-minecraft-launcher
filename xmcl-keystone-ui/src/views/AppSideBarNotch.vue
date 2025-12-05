<template>
  <div
    class="sidebar-notch moveable z-10"
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
        v-shared-tooltip="tooltipPosition => t('myStuff')"
        to="/me"
        class="sidebar-notch__item sidebar-notch__item--link non-moveable"
      >
        <v-icon class="sidebar-notch__icon" :size="iconSize">widgets</v-icon>
      </router-link>

      <!-- Store -->
      <router-link
        v-if="true"
        v-shared-tooltip="tooltipPosition => t('store.name', 2)"
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
        v-shared-tooltip="tooltipPosition => t('multiplayer.name')"
        class="sidebar-notch__item sidebar-notch__item--link non-moveable"
        @click="goMultiplayer"
      >
        <v-icon class="sidebar-notch__icon" :size="iconSize">hub</v-icon>
      </div>

      <div class="sidebar-notch__divider" />

      <!-- Settings -->
      <router-link
        v-shared-tooltip="tooltipPosition => t('setting.name', 2)"
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
</template>

<script lang="ts" setup>
import { kSettingsState } from '@/composables/setting'
import { injection } from '@/util/inject'
import AppSideBarContentNext from './AppSideBarContentNext.vue'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { kTheme } from '@/composables/theme'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'

const { blurSidebar, sideBarColor } = injection(kTheme)
const { state } = injection(kSettingsState)
const { position, align, scale } = useInjectSidebarSettings()

const { t } = useI18n()
const { back } = useRouter()

const isHorizontal = computed(() => position.value === 'top' || position.value === 'bottom')
const isVertical = computed(() => position.value === 'left' || position.value === 'right')
const iconSize = computed(() => isHorizontal.value ? 20 : 22)

const sidebarClasses = computed(() => ({
  'sidebar-notch--horizontal': isHorizontal.value,
  'sidebar-notch--vertical': isVertical.value,
  'sidebar-notch--top': position.value === 'top',
  'sidebar-notch--bottom': position.value === 'bottom',
  'sidebar-notch--left': position.value === 'left',
  'sidebar-notch--right': position.value === 'right',
}))

const containerStyles = computed(() => {
  const styles: any = {
    backgroundColor: sideBarColor.value,
    transform: `scale(${scale.value / 100})`,
  }
  
  // Adjust transform origin based on position and alignment
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

  // Alignment
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

const tooltipPosition = computed(() => {
  if (position.value === 'left') return 'right'
  if (position.value === 'right') return 'left'
  if (position.value === 'top') return 'bottom'
  return 'top'
})

function goBack() {
  back()
}

function goMultiplayer() {
  windowController.openMultiplayerWindow()
}
</script>

<style scoped>
.sidebar-notch {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px;
}

.sidebar-notch--vertical {
  flex-direction: column;
  min-height: 100%;
  padding: 12px 8px;
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

/* Hide scrollbar but keep functionality */
.sidebar-notch__instances::-webkit-scrollbar {
  width: 0;
  height: 0;
}

/* Remove backgrounds from nested elements */
.sidebar-notch__instances :deep(.v-list) {
  background: transparent !important;
  padding: 0 !important;
}

.sidebar-notch__instances :deep(.v-list-item) {
  background: transparent !important;
  padding: 0 !important;
  margin: 0 !important;
}

.sidebar-notch__instances :deep(.v-list-item::before),
.sidebar-notch__instances :deep(.v-list-item::after) {
  display: none !important;
}

.sidebar-notch__instances :deep(.sidebar-item) {
  background: transparent !important;
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
