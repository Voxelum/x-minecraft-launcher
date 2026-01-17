<template>
  <v-list
    nav
    dense
    class="gap-1 flex flex-grow-0 justify-start flex-col px-2 overflow-y-auto ml-1"
  >
    <template v-if="isValidating">
      <v-skeleton-loader
        v-for="i in 5"
        :key="i"
        class="non-moveable my-2 ml-[6px]"
        type="avatar"
      />
    </template>
    <template v-for="(i, index) of filteredGroups">
      <AppSideBarInstanceItem
        v-if="typeof i === 'string'"
        :key="i + index"
        :path="i"
        :pinned="isPinned(i)"
        @arrange="move($event.targetPath, i, $event.previous)"
        @group="group($event, i)"
        @toggle-pin="togglePin(i)"
      />
      <AppSideBarGroupItem
        v-else-if="typeof i === 'object'"
        :key="i.id + index"
        :group="i"
        :color="i.color || defaultColor"
        @arrange="move($event.targetPath, $event.toPath || i, $event.previous)"
        @group="group($event, i)"
      />
    </template>

    <v-list-item
      class="non-moveable add-instance-item"
      style="flex-basis: auto;"
    >
      <v-list-item-avatar
        id="create-instance-button"
        :size="48"
        class="bg-[rgba(80,80,80,0.4)] transition-all duration-300 hover:rounded-xl hover:bg-green-500 cursor-pointer"
        large
        style="pointer-events: auto"
        v-shared-tooltip.right="() => t('instances.add')"
        @click="showAddInstance()"
      >
        <v-icon class="text-xl">
          add
        </v-icon>
      </v-list-item-avatar>

      <v-list-item-title>{{ t('instances.add') }}</v-list-item-title>
    </v-list-item>
  </v-list>
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

const props = defineProps<{}>()

const { t } = useI18n()

const { isValidating, selectedInstance } = injection(kInstances)

const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

const { groups, move, group } = useInstanceGroup()
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
.add-instance-item {
  background-color: transparent !important;
  pointer-events: none;
}

.add-instance-item::before,
.add-instance-item::after {
  display: none !important;
}
</style>
