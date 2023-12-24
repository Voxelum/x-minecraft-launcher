<template>
  <v-dialog
    v-model="isShown"
    hide-overlay
    scrollable
    width="800"
  >
    <v-card>
      <v-toolbar
        flat
        tabs
      >
        <v-toolbar-title class="text-white">
          {{ t('instanceUpdate.title') }}
        </v-toolbar-title>
      </v-toolbar>
      <v-skeleton-loader
        v-if="refreshing"
        type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
      />
      <ErrorView :error="error" />
      <div
        v-if="upgrade && !refreshing"
        class="visible-scroll mx-0 max-h-[100vh] items-center justify-center overflow-y-auto overflow-x-hidden px-6 py-2"
      >
        <v-subheader>
          {{ t('instanceUpdate.basic') }}
        </v-subheader>

        <div class="grid grid-cols-2 gap-4">
          <v-text-field
            :value="`${oldRuntime.minecraft} -> ${runtime.minecraft}`"
            persistent-hint
            label="Minecraft"
            readonly
            flat
            dense
            required
          >
            <template #prepend-inner>
              <img
                :src="'http://launcher/icons/minecraft'"
                width="32"
              >
            </template>
          </v-text-field>
          <v-text-field
            v-if="runtime.forge"
            :value="`${oldRuntime.forge} -> ${runtime.forge}`"
            persistent-hint
            label="Forge"
            readonly
            flat
            dense
            required
          >
            <template #prepend-inner>
              <img
                :src="'http://launcher/icons/forge'"
                width="32"
              >
            </template>
          </v-text-field>
          <v-text-field
            v-if="runtime.fabricLoader"
            :value="`${oldRuntime.fabricLoader} -> ${runtime.fabricLoader}`"
            persistent-hint
            readonly
            label="Fabric"
            flat
            dense
            required
          >
            <template #prepend-inner>
              <img
                :src="'http://launcher/icons/fabric'"
                width="32"
              >
            </template>
          </v-text-field>
        </div>

        <v-subheader>
          {{ t('instanceUpdate.files') }}
        </v-subheader>
        <InstanceManifestFileTree
          v-model="selected"
          :multiple="false"
        >
          <template #default="{ item }">
            <v-chip
              v-if="item.data"
              label
              outlined
              :color="cOperations[item.data.operation]"
            >
              <v-icon left>
                {{ iOperations[item.data.operation] }}
              </v-icon>
              {{ tOperations[item.data.operation] }}
            </v-chip>
          </template>
        </InstanceManifestFileTree>
      </div>
      <v-card-actions class="items-baseline gap-5">
        <v-btn
          text
          large
          :disabled="refreshing"
          @click="cancel"
        >
          {{ t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          text
          color="primary"
          large
          :loading="refreshing"
          @click="confirm"
        >
          {{ t('instanceUpdate.update') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import InstanceManifestFileTree from '@/components/InstanceManifestFileTree.vue'
import { useRefreshable, useService, useServiceBusy } from '@/composables'
import { kInstances } from '@/composables/instances'
import { InstanceFileNode, provideFileNodes } from '@/composables/instanceFileNodeData'
import { InstanceInstallDialog } from '@/composables/instanceUpdate'
import { useVuetifyColor } from '@/composables/vuetify'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { getUpstreamFromResource } from '@/util/upstream'
import { EditInstanceOptions, InstanceFileOperation, InstanceFileUpdate, InstanceInstallServiceKey, InstanceServiceKey, InstanceUpdateServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { kInstance } from '@/composables/instance'
import ErrorView from '@/components/ErrorView.vue'

const selected = ref([] as string[])

const { isShown, dialog } = useDialog(InstanceInstallDialog, () => {
  refresh()
}, () => {
  upgrade.value = undefined
})
const oldResource = computed(() => dialog.value.parameter?.currentResource)
const newResource = computed(() => dialog.value.parameter?.resource)
const { getInstanceUpdateProfile } = useService(InstanceUpdateServiceKey)
const { installInstanceFiles } = useService(InstanceInstallServiceKey)

const { edit } = injection(kInstances)
const { t } = useI18n()

const upgrade = ref(undefined as undefined | {
  instance: EditInstanceOptions
  files: InstanceFileUpdate[]
})

const tOperations = computed(() => ({
  add: t('instanceFileOperation.add'),
  remove: t('instanceFileOperation.remove'),
  keep: t('instanceFileOperation.keep'),
  'backup-add': t('instanceFileOperation.backup-add'),
  'backup-remove': t('instanceFileOperation.backup-remove'),
} as Record<string, string>))

const { getColorCode } = useVuetifyColor()
const runtime = computed(() => upgrade.value?.instance.runtime || {} as Record<string, string>)

const cOperations = {
  add: 'green',
  remove: 'red',
  keep: 'info',
  'backup-add': 'darken green',
  'backup-remove': 'lighten red',
} as Record<string, string>

const iOperations = {
  add: 'add',
  remove: 'delete',
  keep: 'save',
  'backup-add': 'restore_page',
  'backup-remove': 'restore_page',
} as Record<string, string>

type FileOperationNode = InstanceFileNode<{ operation: InstanceFileUpdate['operation'] }>

function getFileNode(f: InstanceFileUpdate): FileOperationNode {
  return {
    name: basename(f.file.path),
    path: f.file.path,
    size: f.file.size,
    style: {
      textDecorationLine: f.operation === 'remove' || f.operation === 'backup-remove' ? 'line-through' : '',
      color: f.operation !== 'keep' ? getColorCode(cOperations[f.operation]) : '',
    },
    data: {
      operation: f.operation,
    },
    children: undefined,
  }
}

const result = ref(upgrade.value?.files.map(getFileNode) || [])
watch(upgrade, (newVal) => {
  if (newVal?.files.length && newVal.files.length > 0) {
    result.value = newVal.files.map(getFileNode)
  } else {
    result.value = []
  }
})

const { leaves } = provideFileNodes(result)

const { runtime: oldRuntime, path: instancePath } = injection(kInstance)

const { refresh, refreshing, error } = useRefreshable(async () => {
  const path = newResource.value?.path
  if (path) {
    upgrade.value = await getInstanceUpdateProfile({
      instancePath: instancePath.value,
      oldModpack: oldResource.value && 'path' in oldResource.value ? oldResource.value.path : undefined,
      newModpack: newResource.value.path,
    })
  }
})

const confirm = async () => {
  if (upgrade.value) {
    const { instance, files } = upgrade.value
    const upstream = newResource.value
    isShown.value = false
    await installInstanceFiles({
      path: instancePath.value,
      files: files.filter(f => f.operation !== 'keep').map(f => ({ ...f.file, operation: f.operation as InstanceFileOperation })),
    })
    await edit({
      instancePath: instancePath.value,
      runtime: {
        minecraft: instance.runtime?.minecraft || oldRuntime.value.minecraft,
        forge: instance.runtime?.forge,
        fabricLoader: instance.runtime?.fabricLoader,
        quiltLoader: instance.runtime?.quiltLoader,
        neoForged: instance.runtime?.neoForged,
      },
      modpackVersion: instance.modpackVersion,
      upstream: getUpstreamFromResource(upstream!),
    })
  }
}

const cancel = () => {
  isShown.value = false
}
</script>
