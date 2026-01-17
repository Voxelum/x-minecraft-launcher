<template>
  <div
    ref="wrapper"
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
      class="sidebar-notch"
      :class="sidebarClasses"
      :style="wrapperStyles"
    >
      <div
        ref="container"
        class="sidebar-notch__container"
        :style="containerStyles"
      >
        <!-- My Stuff -->
        <AppSideBarNotchItem
          id="my-stuff-button"
          icon="widgets"
          :icon-size="iconSize"
          :tooltip="() => ({ text: t('myStuff'), direction: tooltipDirection })"
          to="/me"
        />

        <!-- Store -->
        <AppSideBarNotchItem
          v-if="true"
          icon="store"
          :icon-size="iconSize"
          :tooltip="() => ({ text: t('store.name', 2), direction: tooltipDirection })"
          to="/store"
        />

        <div class="sidebar-notch__divider moveable" />

        <!-- Instance List (compact mode) -->
        <div class="sidebar-notch__instances">
          
        </div>
        <template v-for="i of instanceItems">
          <AppSideBarNotchItemInstance
            v-if="typeof i === 'string'"
            :key="i"
            clickable
            :path="i"
            :direction="tooltipDirection"
          />
          <AppSideBarNotchItemGroup
            v-else
            :key="i.id"
            :group="i"
            :direction="tooltipDirection"
          />
        </template>
        <AppSideBarNotchItem
          icon="add"
          :icon-size="iconSize"
          :tooltip="() => t('instances.add')"
          clickable
          @click="showAddInstance()"
        />

        <div class="sidebar-notch__spacer" />

        <!-- Multiplayer -->
        <AppSideBarNotchItem
          icon="hub"
          :icon-size="iconSize"
          :tooltip="() => ({ text: t('multiplayer.name'), direction: tooltipDirection })"
          clickable
          @click="goMultiplayer"
        />

        <div class="sidebar-notch__divider moveable" />

        <!-- Settings -->
        <AppSideBarNotchItem
          :icon-size="iconSize"
          :tooltip="() => ({ text: t('setting.name', 2), direction: tooltipDirection })"
          to="/setting"
        >
          <v-badge
            right
            overlap
            :value="state?.updateStatus !== 'none'"
          >
            <template #badge>
              <span>{{ 1 }}</span>
            </template>
            <v-icon class="sidebar-notch-item__icon" :size="iconSize">settings</v-icon>
          </v-badge>
        </AppSideBarNotchItem>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { useInstanceGroup } from '@/composables/instanceGroup'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kInstances } from '@/composables/instances'
import { kSettingsState } from '@/composables/setting'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'
import { kTheme } from '@/composables/theme'
import { injection } from '@/util/inject'
import { computed, ref } from 'vue'
import AppSideBarNotchItem from './AppSideBarNotchItem.vue'
import AppSideBarNotchItemGroup from './AppSideBarNotchItemGroup.vue'
import AppSideBarNotchItemInstance from './AppSideBarNotchItemInstance.vue'

const { blurSidebar, sideBarColor } = injection(kTheme)
const { instances } = injection(kInstances)
const { state } = injection(kSettingsState)
const { position, align, scale, autoHide } = useInjectSidebarSettings()
const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

const { t } = useI18n()

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
  'wrapper--hovered': isHovered.value,
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
    backdropFilter: blurSidebar.value ? `blur(${blurSidebar.value}px)` : 'none',
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

const tooltipDirection = computed(() => {
  if (isVertical.value) {
    return position.value === 'left' ? 'right' : 'left'
  } else {
    return position.value === 'top' ? 'bottom' : 'top'
  }
})

function onMouseEnter() {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  isHovered.value = true
}

function onMouseLeave(e: MouseEvent) {
  if (!autoHide.value) return
  
  hideTimeout = setTimeout(() => {
    isHovered.value = false
  }, 2500)
}


function goMultiplayer() {
  windowController.openMultiplayerWindow()
}

watch([autoHide, align, position, scale], ([newAutoHide]) => {
  if (newAutoHide) {
    isHovered.value = true
    if (hideTimeout) clearTimeout(hideTimeout)
    hideTimeout = setTimeout(() => {
      isHovered.value = false
    }, 2500)
  }
})

const { groups } = useInstanceGroup()
const { pinnedInstances, showOnlyPinned } = useInjectSidebarSettings()

const instanceItems = computed(() => {
  // Create a map for quick instance lookup
  const instanceMap = new Map(instances.value.map(inst => [inst.path, inst]))
  const pinnedSet = new Set(pinnedInstances.value)
  
  // Check if an item (instance or group) is pinned
  const isPinned = (item: typeof groups.value[0]): boolean => {
    if (typeof item === 'string') {
      return pinnedSet.has(item)
    } else {
      // For groups, check if any instance in the group is pinned
      return item.instances.some(path => pinnedSet.has(path))
    }
  }
  
  // Get the most recent access time for an item (instance or group)
  const getAccessTime = (item: typeof groups.value[0]): number => {
    if (typeof item === 'string') {
      return instanceMap.get(item)?.lastAccessDate ?? 0
    } else {
      // For groups, use the most recent access time among all instances in the group
      return Math.max(...item.instances.map(path => instanceMap.get(path)?.lastAccessDate ?? 0))
    }
  }
  
  // Filter by pinned if showOnlyPinned is enabled
  let items = [...groups.value]
  if (showOnlyPinned.value) {
    items = items.filter(isPinned)
  }
  
  // Sort: pinned first, then by most recent access time (descending)
  return items
    .sort((a, b) => {
      const aPinned = isPinned(a)
      const bPinned = isPinned(b)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return getAccessTime(b) - getAccessTime(a)
    })
    .slice(0, 4)
})
</script>

<style scoped>
/* Wrapper positioning */
.sidebar-notch-wrapper {
  position: relative;
  display: flex;
  z-index: 10;
  pointer-events: none;
   /* Let clicks pass through wrapper */
}

/* When auto-hide is on, use fixed positioning */
.sidebar-notch-wrapper.wrapper--auto-hide {
  position: fixed;
  z-index: 100;
}

.sidebar-notch-wrapper.wrapper--auto-hide.wrapper--left {
  left: 0;
  top: 0; /* Start below window title bar */
  bottom: 0;
}

.sidebar-notch-wrapper.wrapper--auto-hide.wrapper--right {
  right: 0;
  top: 0; /* Start below window title bar */
  bottom: 0;
}

.sidebar-notch-wrapper.wrapper--auto-hide.wrapper--top {
  top: 24px;
  left: 0;
  right: 0;
  z-index: 102; /* Ensure top sidebar is above window controls if it MUST be there, but might need offset too */
}

.sidebar-notch-wrapper.wrapper--auto-hide.wrapper--bottom {
  bottom: 0;
  left: 0;
  right: 0;
}

/* Trigger zone - water drop style with hover indicator */
.sidebar-trigger {
  position: absolute;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Water drop shape - always visible */
.sidebar-trigger::after {
  content: '';
  position: absolute;
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover state - grow and glow when wrapper is hovered */
.wrapper--hovered .sidebar-trigger::after {
  background: rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.3);
}

.wrapper--hovered .trigger--left::after {
  width: 10px;
  height: 60px;
  border-radius: 0 10px 10px 0;
}

.wrapper--hovered .trigger--right::after {
  width: 10px;
  height: 60px;
  border-radius: 10px 0 0 10px;
}

.wrapper--hovered .trigger--top::after {
  width: 60px;
  height: 10px;
  border-radius: 0 0 10px 10px;
}

.wrapper--hovered .trigger--bottom::after {
  width: 60px;
  height: 10px;
  border-radius: 10px 10px 0 0;
}

.trigger--left {
  left: 0;
  top: 58px;
  bottom: 0;
  width: 22px;
}

.trigger--left::after {
  left: 0;
  top: 50%;
  width: 6px;
  height: 40px;
  border-radius: 0 6px 6px 0;
  transform: translateY(-50%);
}

.trigger--right {
  right: 0;
  top: 58px;
  bottom: 0;
  width: 22px;
}

.trigger--right::after {
  right: 0;
  top: 50%;
  width: 6px;
  height: 40px;
  border-radius: 6px 0 0 6px;
  transform: translateY(-50%);
}

.trigger--top {
  top: 0;
  left: 80px; 
  right: 120px; 
  height: 52px;
}

.trigger--top::after {
  top: 0;
  left: 50%;
  width: 40px;
  height: 6px;
  border-radius: 0 0 6px 6px;
  transform: translateX(-50%);
}

.trigger--bottom {
  bottom: 0;
  left: 0;
  right: 0;
  height: 22px;
}

.trigger--bottom::after {
  bottom: 0;
  left: 50%;
  width: 40px;
  height: 6px;
  border-radius: 6px 6px 0 0;
  transform: translateX(-50%);
}

/* Sidebar base styles */
.sidebar-notch {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
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
  padding: 22px 8px;
  /* padding-top removed in favor of top offset on wrapper */
}

.sidebar-notch--horizontal {
  flex-direction: row;
  width: 100%;
  padding: 8px 22px;
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
  max-width: 100%;
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
</style>
