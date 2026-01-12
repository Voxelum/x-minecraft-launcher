<template>
  <div :class="{ 'flex-1 h-full overflow-y-auto': !horizontal, 'w-full overflow-x-auto': horizontal }">
    <v-list
      nav
      dense
      class="gap-1 flex flex-grow-0 justify-start"
      :class="{ 
        'px-2': !compact, 
        'px-0': compact,
        'flex-col': !horizontal,
        'flex-row': horizontal,
        'overflow-y-auto': !horizontal,
        'overflow-x-auto': horizontal,
        'ml-1': !horizontal,
        'mt-1': horizontal,
        'w-full': horizontal
      }"
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
          :compact="compact"
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
          :compact="compact"
          @arrange="move($event.targetPath, $event.toPath || i, $event.previous)"
          @group="group($event, i)"
        />
      </template>

      <v-list-item
        class="non-moveable add-instance-item"
        style="flex-basis: auto;"
        :class="{ 'justify-center': compact, 'px-0': compact }"
      >
        <v-list-item-avatar
          id="create-instance-button"
          :size="compact ? 32 : 48"
          class="bg-[rgba(80,80,80,0.4)] transition-all duration-300 hover:rounded-xl hover:bg-green-500 cursor-pointer"
          :class="{ 'mx-0': compact }"
          large
          style="pointer-events: auto"
          v-shared-tooltip.right="() => t('instances.add')"
          @click="showAddInstance()"
        >
          <v-icon :class="{ 'text-3xl': !compact, 'text-xl': compact }">
            add
          </v-icon>
        </v-list-item-avatar>

        <v-list-item-title v-if="!compact">{{ t('instances.add') }}</v-list-item-title>
      </v-list-item>
    </v-list>
    <SimpleDialog
      :width="500"
      color="primary"
      dialog="saveCopyDialog"
      :title="t('save.copy.title')"
      :confirm="t('save.copy.confirm')"
      @confirm="doCopy"
    >
      {{ copySavePayload?.destInstancePath }}
      {{ copySavePayload?.saveName }}
    </SimpleDialog>
    <AppSideBarGroupSettingDialog :default-color="defaultColor" />
  </div>
</template>
<script setup lang="ts">
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { useInstanceGroup, useInstanceGroupDefaultColor, InstanceGroupData } from '@/composables/instanceGroup'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kInstances } from '@/composables/instances'
import { useNotifier } from '@/composables/notifier'
import { useInjectInstanceLauncher } from '@/composables/instanceLauncher'
import { useInjectSidebarSettings } from '@/composables/sidebarSettings'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'
import AppSideBarGroupItem from './AppSideBarGroupItem.vue'
import AppSideBarGroupSettingDialog from './AppSideBarGroupSettingDialog.vue'
import AppSideBarInstanceItem from './AppSideBarInstanceItem.vue'

const props = defineProps<{
  compact?: boolean
  horizontal?: boolean
  maxInstances?: number
}>()

const { t } = useI18n()


const { isValidating } = injection(kInstances)

const { show: showAddInstance } = useDialog(AddInstanceDialogKey)
const { open: openLauncher } = useInjectInstanceLauncher()

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
        return isPinned(item)
      } else {
        // For groups, check if any instance in the group is pinned
        return item.instances.some(inst => isPinned(inst))
      }
    })
  }
  
  // Apply maxInstances limit
  if (props.maxInstances) {
    let instanceCount = 0
    const limited = []
    
    for (const item of items) {
      if (typeof item === 'string') {
        if (instanceCount < props.maxInstances) {
          limited.push(item)
          instanceCount++
        }
      } else {
        limited.push(item)
      }
    }
    
    return limited
  }
  
  return items
})

const hasMoreInstances = computed(() => {
  if (!props.maxInstances) return false
  const totalInstances = groups.value.filter(i => typeof i === 'string').length
  return totalInstances > props.maxInstances
})

const { isShown } = useDialog('saveCopyDialog')
const copySavePayload = ref(undefined as {
  saveName: string
  srcInstancePath: string
  destInstancePath: string
} | undefined)
const { cloneSave } = useService(InstanceSavesServiceKey)
const defaultColor = useInstanceGroupDefaultColor()
const { notify } = useNotifier()
function doCopy() {
  if (copySavePayload.value) {
    cloneSave({ ...copySavePayload.value }).then(() => {
      notify({
        level: 'success',
        title: t('save.copy.name'),
      })
    }, () => {
      notify({
        level: 'error',
        title: t('save.copy.name'),
      })
    })
  }
  isShown.value = false
}

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
