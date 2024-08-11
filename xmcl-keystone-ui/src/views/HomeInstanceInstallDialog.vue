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
        class="visible-scroll mx-0 max-h-screen items-center justify-center overflow-y-auto overflow-x-hidden px-6 py-2"
      >
        <template v-if="upgrade && upgrade.instance">
          <v-subheader>
            {{ t('instanceUpdate.basic') }}
          </v-subheader>

          <div
            class="grid grid-cols-2 gap-4"
          >
            <v-text-field
              :value="getVersionString(oldRuntime.minecraft, runtime.minecraft)"
              persistent-hint
              label="Minecraft"
              readonly
              flat
              dense
              required
            >
              <template #prepend-inner>
                <img
                  :src="BuiltinImages.minecraft"
                  width="32"
                >
              </template>
            </v-text-field>
            <v-text-field
              v-if="runtime.forge"
              :value="getVersionString(oldRuntime.forge, runtime.forge)"
              persistent-hint
              label="Forge"
              readonly
              flat
              dense
              required
            >
              <template #prepend-inner>
                <img
                  :src="BuiltinImages.forge"
                  width="32"
                >
              </template>
            </v-text-field>
            <v-text-field
              v-if="runtime.fabricLoader"
              :value="getVersionString(oldRuntime.fabricLoader, runtime.fabricLoader)"
              persistent-hint
              readonly
              label="Fabric"
              flat
              dense
              required
            >
              <template #prepend-inner>
                <img
                  :src="BuiltinImages.fabric"
                  width="32"
                >
              </template>
            </v-text-field>
          </div>

          <v-alert
            v-if="loaderDifferences.old.length > 0 || loaderDifferences.new.length > 0"
            colored-border
            outlined
            type="error"
            color="error"
          >
            <i18n-t
              tag="p"
              keypath="instanceUpdate.loaderChanged"
            >
              <template #modloader>
                <v-chip
                  label
                  small
                  outlined
                >
                  {{ loaderDifferences.old.join(', ') }}
                </v-chip>
              </template>
              <template #newModloader>
                <v-chip
                  label
                  small
                  outlined
                >
                  {{ loaderDifferences.new.join(', ') }}
                </v-chip>
              </template>
            </i18n-t>
          </v-alert>
        </template>

        <v-subheader>
          {{ t('instanceUpdate.files') }}
        </v-subheader>
        <InstanceManifestFileTree
          v-model="selected"
          open-all
          selectable
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
import ErrorView from '@/components/ErrorView.vue'
import InstanceManifestFileTree from '@/components/InstanceManifestFileTree.vue'
import { useRefreshable, useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { InstanceFileNode, provideFileNodes } from '@/composables/instanceFileNodeData'
import { InstanceInstallDialog, InstanceInstallOptions } from '@/composables/instanceUpdate'
import { kInstances } from '@/composables/instances'
import { kJavaContext } from '@/composables/java'
import { useVuetifyColor } from '@/composables/vuetify'
import { basename } from '@/util/basename'
import { getFTBTemplateAndFile } from '@/util/ftb'
import { injection } from '@/util/inject'
import { resolveModpackInstanceConfig } from '@/util/modpackFilesResolver'
import { getUpstreamFromResource } from '@/util/upstream'
import { EditInstanceOptions, InstanceData, InstanceFileOperation, InstanceFileUpdate, InstanceInstallServiceKey, InstanceUpdateServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { BuiltinImages } from '../constant'

const selected = ref([] as string[])

const { isShown } = useDialog(InstanceInstallDialog, (parm) => {
  refresh(parm)
}, () => {
  upgrade.value = undefined
})

const { getInstanceUpdateProfile, getInstanceUpdateProfileRaw } = useService(InstanceUpdateServiceKey)
const { installInstanceFiles } = useService(InstanceInstallServiceKey)

const { edit } = injection(kInstances)
const { t } = useI18n()

const upgrade = ref(undefined as undefined | {
  instance?: EditInstanceOptions
  files: InstanceFileUpdate[]
  id?: string
})

const tOperations = computed(() => ({
  add: t('instanceFileOperation.add'),
  remove: t('instanceFileOperation.remove'),
  keep: t('instanceFileOperation.keep'),
  'backup-add': t('instanceFileOperation.backup-add'),
  'backup-remove': t('instanceFileOperation.backup-remove'),
} as Record<string, string>))

const { getColorCode } = useVuetifyColor()
const runtime = computed(() => upgrade.value?.instance?.runtime || {} as Record<string, string>)

const getVersionString = (oldVersion?: string, newVersion?: string) => oldVersion !== newVersion ? `${oldVersion} -> ${newVersion}` : newVersion

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
    size: f.file.size ?? 0,
    style: {
      textDecorationLine: f.operation === 'remove' || f.operation === 'backup-remove' ? 'line-through' : '',
      color: f.operation !== 'keep' ? getColorCode(cOperations[f.operation]) : '',
    },
    data: {
      operation: f.operation,
    },
    modrinth: !!f.file.modrinth,
    curseforge: !!f.file.curseforge,
    children: undefined,
  }
}

const result = shallowRef(upgrade.value?.files.map(getFileNode) || [])
watch(upgrade, (newVal) => {
  if (newVal?.files.length && newVal.files.length > 0) {
    result.value = newVal.files.map(getFileNode)
  } else {
    result.value = []
  }
})

provideFileNodes(result, false)

const { runtime: oldRuntime, path: instancePath } = injection(kInstance)

const { all: javas } = injection(kJavaContext)
const { refresh, refreshing, error } = useRefreshable<InstanceInstallOptions>(async (param) => {
  if (!param) {
    return
  }

  if (param.type === 'ftb') {
    const oldManifest = param.oldManifest
    const newManifest = param.newManifest
    // FTB
    const [config, newVersionFiles] = getFTBTemplateAndFile(newManifest, javas.value)
    const [_, oldVersionFiles] = getFTBTemplateAndFile(oldManifest, javas.value)
    config.upstream = {
      type: 'ftb-modpack',
      id: newManifest.parent,
      versionId: newManifest.id,
    }
    upgrade.value = {
      instance: config,
      files: markRaw(await getInstanceUpdateProfileRaw({
        instancePath: instancePath.value,
        oldVersionFiles,
        newVersionFiles,
      })),
    }
  } else if (param.type === 'modrinth' || param.type === 'curseforge') {
    const oldResource = param.currentResource
    const res = param.resource

    const config = resolveModpackInstanceConfig(res) as EditInstanceOptions

    const files = await getInstanceUpdateProfile({
      instancePath: instancePath.value,
      oldModpack: oldResource && 'path' in oldResource ? oldResource.path : undefined,
      newModpack: res.path,
    })
    config.upstream = getUpstreamFromResource(res)

    upgrade.value = {
      instance: config,
      files,
    }
  } else if (param.type === 'updates') {
    upgrade.value = {
      files: param.updates,
      id: param.id,
    }
  }

  if (upgrade.value) {
    if (param.type === 'updates' && param.selectOnlyAdd) {
      selected.value = upgrade.value.files
        .filter(f => f.operation === 'add')
        .map(f => f.file.path)
    } else {
      selected.value = upgrade.value.files.map(f => f.file.path)
    }
  }
})

const loaderDifferences = computed(() => {
  const old = oldRuntime.value
  const newR = runtime.value
  const loaders = ['forge', 'fabricLoader', 'quiltLoader', 'neoForged']
  const oldL = [] as string[]
  const newL = [] as string[]
  for (const l of loaders) {
    if (!!old[l] !== !!newR[l]) {
      if (old[l]) {
        oldL.push(l)
      } else {
        newL.push(l)
      }
    }
  }
  return {
    old: oldL,
    new: newL,
  }
})

const confirm = async () => {
  if (upgrade.value) {
    const { instance, files, id } = upgrade.value
    isShown.value = false
    const select = selected.value
    const filtered = files.filter(f => f.operation !== 'keep' && select.includes(f.file.path))
    try {
      await installInstanceFiles({
        path: instancePath.value,
        files: filtered.map(f => ({ ...f.file, operation: f.operation as InstanceFileOperation })),
        id,
      })
    } catch (e) {
      Object.assign(e as any, {
        instanceInstallErrorId: id,
      })
      throw e
    }
    if (instance) {
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
        upstream: instance.upstream,
      })
    }
  }
}

const cancel = () => {
  isShown.value = false
}
</script>
