<template>
  <v-list
    nav
    density="compact"
    v-bind="$attrs"
  >
    <template v-if="isValidating">
      <v-skeleton-loader
        v-for="i in 5"
        :key="i"
        class="non-moveable my-2 ml-[6px]"
        type="avatar"
      />
    </template>
    <template 
      v-for="(i, index) of groups" 
      :key="typeof i === 'string' ? i + index : i.id + index"
    >
      <AppSideBarInstanceItem
        v-if="typeof i === 'string'"
        :path="i"
        @arrange="move($event.targetPath, i, $event.previous)"
        @group="group($event, i)"
      />
      <AppSideBarGroupItem
        v-else-if="typeof i === 'object'"
        :group="i"
        :color="i.color || defaultColor"
        @arrange="move($event.targetPath, $event.toPath || i, $event.previous)"
        @group="group($event, i)"
      />
    </template>

    <v-list-item
      v-shared-tooltip.right="_ => t('instances.add')"
      push
      class="non-moveable"
      @click="showAddInstance()"
    >
      <v-avatar
        id="create-instance-button"
        size="48"
        class="bg-[rgba(80,80,80,0.4)] transition-all! duration-300 hover:rounded-xl hover:bg-green-500"
      >
        <v-icon class="text-3xl">
          add
        </v-icon>
      </v-avatar>
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
