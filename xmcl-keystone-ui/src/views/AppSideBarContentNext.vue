<template>
  <div class="h-full overflow-auto">
    <v-list
      nav
      dense
      class="ml-1 gap-1 flex flex-col flex-grow-0 justify-start overflow-auto px-2"
    >
      <template v-if="isValidating">
        <v-skeleton-loader
          v-for="i in 5"
          :key="i"
          class="non-moveable my-2 ml-[6px]"
          type="avatar"
        />
      </template>
      <template v-for="(i, index) of groups">
        <AppSideBarInstanceItem
          v-if="typeof i === 'string'"
          :key="i + index"
          :path="i"
          @arrange="move($event.targetPath, i, $event.previous)"
          @group="group($event, i)"
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
        push
        class="non-moveable"
        @click="showAddInstance()"
      >
        <v-list-item-avatar
          id="create-instance-button"
          v-shared-tooltip.right="_ => t('instances.add')"
          size="48"
          class="bg-[rgba(80,80,80,0.4)] transition-all duration-300 hover:rounded-xl hover:bg-green-500"
          large
        >
          <v-icon class="text-3xl">
            add
          </v-icon>
        </v-list-item-avatar>

        <v-list-item-title>Instance</v-list-item-title>
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
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceSavesServiceKey } from '@xmcl/runtime-api'
import AppSideBarGroupItem from './AppSideBarGroupItem.vue'
import AppSideBarGroupSettingDialog from './AppSideBarGroupSettingDialog.vue'
import AppSideBarInstanceItem from './AppSideBarInstanceItem.vue'

const { t } = useI18n()

const { isValidating } = injection(kInstances)

const { show: showAddInstance } = useDialog(AddInstanceDialogKey)

const { groups, move, group } = useInstanceGroup()

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
