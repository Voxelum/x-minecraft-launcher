<template>
  <div :class="{ 'h-full overflow-y-auto': !horizontal, 'w-full overflow-x-auto': horizontal }">
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
        'h-full': !horizontal,
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
      <template v-for="(i, index) of displayedGroups">
        <AppSideBarInstanceItem
          v-if="typeof i === 'string'"
          :key="i + index"
          :path="i"
          :compact="compact"
          @arrange="move($event.targetPath, i, $event.previous)"
          @group="group($event, i)"
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
        push
        class="non-moveable"
        style="flex-basis: auto;"
        :class="{ 'justify-center': compact, 'px-0': compact }"
        v-shared-tooltip.right="_ => t('instances.add')"
        @click="showAddInstance()"
      >
        <v-list-item-avatar
          id="create-instance-button"
          :size="compact ? 32 : 48"
          class="bg-[rgba(80,80,80,0.4)] transition-all duration-300 hover:rounded-xl hover:bg-green-500"
          :class="{ 'mx-0': compact }"
          large
        >
          <v-icon :class="{ 'text-3xl': !compact, 'text-xl': compact }">
            add
          </v-icon>
        </v-list-item-avatar>

        <v-list-item-title v-if="!compact">{{ t('instances.add') }}</v-list-item-title>
      </v-list-item>
      <v-spacer />
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
import { useInstanceGroup, useInstanceGroupDefaultColor } from '@/composables/instanceGroup'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { kInstances } from '@/composables/instances'
import { useNotifier } from '@/composables/notifier'
import { useInjectInstanceLauncher } from '@/composables/instanceLauncher'
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

// Limit instances if maxInstances is set
const displayedGroups = computed(() => {
  if (!props.maxInstances) return groups.value
  
  let instanceCount = 0
  const limited = []
  
  for (const item of groups.value) {
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
