<template>
  <component
    :is="to ? 'router-link' : 'div'"
    v-shared-tooltip="tooltip"
    v-context-menu="contextMenu"
    :to="to"
    :id="id"
    class="sidebar-notch-item non-moveable"
    :class="{ 'sidebar-notch-item--link': !!to || clickable, 'sidebar-notch-item--active': active }"
    @click="onClick"
  >
    <slot>
      <img
        v-if="image"
        class="sidebar-notch-item__image"
        :src="image"
        :width="28"
        :height="28"
      >
      <v-icon v-else class="sidebar-notch-item__icon" :size="iconSize">{{ icon }}</v-icon>
    </slot>
  </component>
</template>

<script lang="ts" setup>
import { VSharedTooltipParam, vSharedTooltip } from '@/directives/sharedTooltip'
import { vContextMenu } from '@/directives/contextMenu'
import { ContextMenuItem } from '@/composables/contextMenu'

const props = defineProps<{
  icon?: string
  iconSize?: number
  image?: string
  tooltip?: () => VSharedTooltipParam
  to?: string
  id?: string
  clickable?: boolean
  active?: boolean
  contextMenu?: () => ContextMenuItem[]
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

function onClick(event: MouseEvent) {
  emit('click', event)
}
</script>

<style scoped>
.sidebar-notch-item {
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
  text-decoration: none;
  color: inherit;
}

.sidebar-notch-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: currentColor;
  opacity: 0;
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-notch-item:hover::before {
  opacity: 0.08;
}

.sidebar-notch-item:active::before {
  opacity: 0.12;
}

.sidebar-notch-item__icon {
  position: relative;
  z-index: 1;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-notch-item__image {
  position: relative;
  z-index: 1;
  border-radius: 8px;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.dark .sidebar-notch-item .theme--dark.v-icon {
  color: var(--icon-color);
}

.dark .sidebar-notch-item:hover .theme--dark.v-icon {
  color: var(--icon-color-hovered);
}

.sidebar-notch-item.router-link-active,
.sidebar-notch-item.router-link-active .v-icon,
.sidebar-notch-item--active,
.sidebar-notch-item--active .v-icon {
  color: var(--color-primary);
}

.sidebar-notch-item.router-link-active::before,
.sidebar-notch-item--active::before {
  opacity: 0.20;
  background: var(--color-primary);
}
</style>

