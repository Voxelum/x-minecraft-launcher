<template>
  <component
    :is="to ? 'router-link' : clickable ? 'button' : 'div'"
    :id="id"
    :to="to"
    :type="clickable && !to ? 'button' : undefined"
    class="sidebar-item non-moveable"
    :class="{
      'sidebar-item--active': active,
      'sidebar-item--clickable': clickable || !!to,
      'sidebar-item--colored': !!color,
    }"
    :style="color ? { '--sidebar-item-color': color } : undefined"
    @click="onClick"
  >
    <span class="sidebar-item__indicator" />
    <span class="sidebar-item__content">
      <slot>
        <v-icon
          v-if="icon"
          class="sidebar-item__icon"
          :size="iconSize ?? 24"
        >
          {{ icon }}
        </v-icon>
      </slot>
    </span>
  </component>
</template>

<script lang="ts" setup>
const props = defineProps<{
  id?: string
  to?: string
  icon?: string
  iconSize?: number
  active?: boolean
  clickable?: boolean
  color?: string
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

function onClick(event: MouseEvent) {
  emit('click', event)
}
</script>

<style scoped>
.sidebar-item {
  position: relative;
  display: block;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 0;
  background: transparent;
  margin: 4px auto;
  flex-shrink: 0;
  text-decoration: none;
  color: inherit;
  --sidebar-item-color: var(--color-primary);
}

.sidebar-item__content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: transparent;
  transition:
    border-radius 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  cursor: default;
}

.sidebar-item--clickable .sidebar-item__content {
  cursor: pointer;
}

.sidebar-item--clickable:hover .sidebar-item__content {
  border-radius: 16px;
  background-color: rgba(255, 255, 255, 0.18);
}

.sidebar-item--clickable.sidebar-item--colored:hover .sidebar-item__content {
  background-color: var(--sidebar-item-color);
  color: white;
}

.sidebar-item--active .sidebar-item__content,
.sidebar-item.router-link-active .sidebar-item__content {
  border-radius: 16px;
  background-color: var(--sidebar-item-color);
  color: white;
}

.sidebar-item__icon {
  position: relative;
  z-index: 1;
  transition: color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Discord-style left pill indicator */
.sidebar-item__indicator {
  position: absolute;
  left: -12px;
  top: 50%;
  width: 4px;
  height: 0;
  border-radius: 0 4px 4px 0;
  background-color: white;
  transform: translateY(-50%);
  transition:
    height 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.85;
  pointer-events: none;
}

.sidebar-item--clickable:hover .sidebar-item__indicator {
  height: 20px;
}

.sidebar-item--active .sidebar-item__indicator,
.sidebar-item.router-link-active .sidebar-item__indicator {
  height: 36px;
}
</style>
