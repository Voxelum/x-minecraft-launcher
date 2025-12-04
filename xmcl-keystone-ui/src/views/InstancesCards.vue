<template>
  <div
    class="flex h-full w-full select-none flex-col items-start justify-start gap-4 overflow-auto"
  >
    <!-- Folder view mode -->
    <template v-if="viewMode === 'folder'">
      <!-- Folder groups -->
      <template v-for="groupItem of groupedInstances">
        <div
          v-if="groupItem.type === 'group'"
          :key="groupItem.id"
          class="w-full"
        >
          <div
            v-context-menu="() => getFolderContextMenuItems(groupItem)"
            class="flex items-center cursor-pointer select-none mb-2"
            @click="toggleGroup(groupItem.id)"
          >
            <v-icon class="mr-2 transition-transform" :class="{ 'rotate-90': isGroupExpanded(groupItem.id) }">
              chevron_right
            </v-icon>
            <span class="text-lg font-medium">{{ groupItem.name || t('instances.folder') }}</span>
            <span class="ml-2 text-gray-500">({{ groupItem.instances.length }})</span>
          </div>
          <transition name="fade-transition">
            <div
              v-if="isGroupExpanded(groupItem.id)"
              class="flex flex-wrap gap-2 pl-6"
            >
              <InstanceCardCompact
                v-for="instance in groupItem.instances"
                :key="instance.path"
                :instance="instance"
                @click.stop="emit('select', instance.path)"
              />
            </div>
          </transition>
        </div>
      </template>

      <!-- Ungrouped instances by time -->
      <template v-for="(inst, i) of ungroupedByTime">
        <div
          :key="i + 'title'"
          class="flex w-full flex-1 flex-grow-0 justify-center"
          style="color: grey;"
        >
          {{ title[i] }}
        </div>
        <div
          :key="i + 'instances'"
          class="grid w-full grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4"
        >
          <InstanceCard
            v-for="instance in inst"
            :key="instance.path"
            :instance="instance"
            @click.stop="emit('select', instance.path)"
            @delete="emit('delete', instance)"
            @dragstart="emit('dragstart', instance)"
            @dragend="emit('dragend')"
          />
        </div>
      </template>
    </template>

    <!-- Date view mode (legacy) -->
    <template v-else>
      <template v-for="(inst, i) of instancesByTime">
        <div
          :key="i + 'title'"
          class="flex w-full flex-1 flex-grow-0 justify-center"
          style="color: grey;"
        >
          {{ title[i] }}
        </div>
        <div
          :key="i + 'instances'"
          class="grid w-full grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4"
        >
          <InstanceCard
            v-for="instance in inst"
            :key="instance.path"
            :instance="instance"
            @click.stop="emit('select', instance.path)"
            @delete="emit('delete', instance)"
            @dragstart="emit('dragstart', instance)"
            @dragend="emit('dragend')"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<script lang=ts setup>
import { Instance } from '@xmcl/instance';
import InstanceCard from './InstancesCard.vue'
import InstanceCardCompact from './InstancesCardCompact.vue'
import { useInstanceGroup } from '@/composables/instanceGroup'
import { vContextMenu } from '@/directives/contextMenu'
import { ContextMenuItem } from '@/composables/contextMenu'
import { useDialog } from '@/composables/dialog'
import { Ref } from 'vue'

interface GroupedItem {
  type: 'group'
  id: string
  name: string
  color: string
  instances: Instance[]
}

const props = defineProps<{
  instances: Instance[]
  viewMode?: 'folder' | 'date'
}>()
const emit = defineEmits(['select', 'dragstart', 'dragend', 'delete'])
const { t } = useI18n()
const { groups } = useInstanceGroup()
const { show: showFolderSetting } = useDialog('folder-setting')

// Track expanded state for each group using shallowRef for Vue2 compatibility
const expandedGroups = shallowRef<Record<string, boolean>>({})

const isGroupExpanded = (id: string) => {
  return expandedGroups.value[id] ?? true
}

const toggleGroup = (id: string) => {
  const current = expandedGroups.value[id] ?? true
  expandedGroups.value = { ...expandedGroups.value, [id]: !current }
}

// Get folder context menu items
const getFolderContextMenuItems = (groupItem: GroupedItem): ContextMenuItem[] => {
  // Find the original group data from groups
  const originalGroup = groups.value.find(g => typeof g === 'object' && g.id === groupItem.id)
  if (!originalGroup || typeof originalGroup === 'string') return []
  
  return [{
    icon: 'settings',
    text: t('instances.folderSetting'),
    onClick: () => {
      showFolderSetting(originalGroup)
    },
  }]
}

// Create a map from instance path to instance
const instanceMap = computed(() => {
  const map = new Map<string, Instance>()
  for (const inst of props.instances) {
    map.set(inst.path, inst)
  }
  return map
})

// Get grouped instances
const groupedInstances = computed((): GroupedItem[] => {
  const result: GroupedItem[] = []
  for (const item of groups.value) {
    if (typeof item === 'object') {
      const groupInstances: Instance[] = []
      for (const path of item.instances) {
        const inst = instanceMap.value.get(path)
        if (inst) {
          groupInstances.push(inst)
        }
      }
      if (groupInstances.length > 0) {
        result.push({
          type: 'group',
          id: item.id,
          name: item.name,
          color: item.color,
          instances: groupInstances,
        })
      }
    }
  }
  return result
})

// Get ungrouped instance paths
const groupedPaths = computed(() => {
  const paths = new Set<string>()
  for (const item of groups.value) {
    if (typeof item === 'object') {
      for (const path of item.instances) {
        paths.add(path)
      }
    }
  }
  return paths
})

// Filter to only ungrouped instances
const ungroupedInstances = computed(() => {
  return props.instances.filter(inst => !groupedPaths.value.has(inst.path))
})

const now = Date.now()
const oneDay = 1000 * 60 * 60 * 24
const threeDays = oneDay * 3
const title = computed(() => [
  t('instanceAge.today'),
  t('instanceAge.threeDay'),
  t('instanceAge.older'),
])

// Helper function to group instances by time
const groupByTime = (instances: Instance[]): Instance[][] => {
  const todayR: Instance[] = []
  const threeR: Instance[] = []
  const other: Instance[] = []
  for (const p of instances) {
    const diff = now - p.lastAccessDate
    if (diff <= oneDay) {
      todayR.push(p)
    } else if (diff <= threeDays) {
      threeR.push(p)
    } else {
      other.push(p)
    }
  }
  const result: Instance[][] = []
  if (todayR.length > 0) result.push(todayR)
  if (threeR.length > 0) result.push(threeR)
  if (other.length > 0) result.push(other)
  return result
}

const ungroupedByTime: Ref<Instance[][]> = computed(() => groupByTime(ungroupedInstances.value))

// All instances by time (for date view mode)
const instancesByTime: Ref<Instance[][]> = computed(() => groupByTime(props.instances))
</script>
