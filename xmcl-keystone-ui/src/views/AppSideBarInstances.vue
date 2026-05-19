<template>
  <div class="sidebar-instances">
    <template v-if="isValidating">
      <v-skeleton-loader
        v-for="i in 5"
        :key="i"
        class="non-moveable my-2 mx-auto sidebar-instances__skeleton"
        type="avatar"
      />
    </template>
    <template
      v-for="(i, index) of filteredGroups"
      :key="typeof i === 'string' ? i + index : i.id + index"
    >
      <AppSideBarInstanceItem
        v-if="typeof i === 'string'"
        :path="i"
        :pinned="isPinned(i)"
        @arrange="move($event.targetPath, i, $event.previous)"
        @group="group($event, i)"
        @toggle-pin="togglePin(i)"
      />
      <AppSideBarGroupItem
        v-else-if="typeof i === 'object'"
        :group="i"
        :color="i.color || defaultColor"
        @arrange="move($event.targetPath, $event.toPath || i, $event.previous)"
        @group="group($event, i)"
        @setting="edit($event.id, { name: $event.name, color: $event.color })"
      />
    </template>

    <AppSideBarItem
      id="create-instance-button"
      data-testid="create-instance"
      v-shared-tooltip.right="() => t('instances.add')"
      :aria-label="t('instances.add')"
      icon="add"
      clickable
      class="add-instance-button"
      @click="showAddInstance()"
    />
  </div>
</template>
<script setup lang="ts">
import { useDialog } from '@/composables/dialog'
import { useInstanceGroup, useInstanceGroupDefaultColor } from '@/composables/instanceGroup'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kInstances } from '@/composables/instances'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import AppSideBarGroupItem from './AppSideBarGroupItem.vue'
import AppSideBarInstanceItem from './AppSideBarInstanceItem.vue'
import AppSideBarItem from './AppSideBarItem.vue'

const { t } = useI18n()

const { isValidating, selectedInstance } = injection(kInstances)

const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

const { groups, move, group, edit } = useInstanceGroup()
const { showOnlyPinned, pinnedInstances } = useInjectSidebarSettings()

// Check if instance is pinned
const isPinned = (path: string) => pinnedInstances.value.includes(path)

// Toggle pin state for an instance
const togglePin = (path: string) => {
  const idx = pinnedInstances.value.indexOf(path)
  if (idx >= 0) {
    pinnedInstances.value.splice(idx, 1)
  } else {
    pinnedInstances.value.push(path)
  }
}

// Filter groups based on showOnlyPinned setting
const filteredGroups = computed(() => {
  let items = groups.value

  // Apply pinned filter
  if (showOnlyPinned.value) {
    items = items.filter(item => {
      if (typeof item === 'string') {
        return isPinned(item) || selectedInstance.value === item
      } else {
        // For groups, check if any instance in the group is pinned
        return item.instances.some(inst => isPinned(inst) || selectedInstance.value === inst)
      }
    })
  }

  return items
})

const defaultColor = useInstanceGroupDefaultColor()
</script>

<style scoped>
.sidebar-instances {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}

.sidebar-instances__skeleton {
  width: 48px;
  height: 48px;
}

.add-instance-button {
  --sidebar-item-color: #4caf50;
}
</style>
