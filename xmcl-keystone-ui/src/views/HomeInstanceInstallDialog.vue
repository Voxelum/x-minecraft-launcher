<template>
  <v-dialog
    v-model="isShown"
    hide-overlay
    scrollable
    width="800"
  >
    <v-card class="select-none max-h-[90vh]!">
      <v-toolbar
        flat
        tabs
      >
        <v-toolbar-title>
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
        ref="scrollRef"
        class="visible-scroll mx-0 max-h-screen items-center justify-center overflow-y-auto overflow-x-hidden px-6 py-2"
      >
        <template v-if="upgrade && upgrade.edit">
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

        <div>
          <v-subheader>
            {{ t('instanceUpdate.files') }}
            <v-spacer />
            <v-btn class="z-3" icon @click="filterKeep = !filterKeep">
              <v-icon v-if="filterKeep">visibility_off</v-icon>
              <v-icon v-else>visibility</v-icon>
            </v-btn>
          </v-subheader>
        </div>

        <InstanceManifestFileTree
          :value="selected"
          :selectable="selectable"
          :multiple="false"
          :scroll-element="scrollRef"
        >
          <template #default="{ item }">
            <v-chip
              v-if="item.data"
              class="pointer-events-none"
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
        <Hint
          v-if="fileNodes.length === 0 && counts.hidden > 0"
          class="min-h-80 static"
          icon="visibility_off"
          :text="t('instanceUpdate.summary', { add: counts.add, remove: counts.remove, keep: counts.keep })"
        />
        <div v-else class="flex items-center gap-4 h-4 my-8">
          <v-divider />
          {{ t('instanceUpdate.summary', { add: counts.add, remove: counts.remove, keep: counts.keep }) }}
          <v-divider />
        </div>
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
import Hint from '@/components/Hint.vue'
import InstanceManifestFileTree from '@/components/InstanceManifestFileTree.vue'
import { useRefreshable, useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { InstanceFileNode, provideFileNodes } from '@/composables/instanceFileNodeData'
import { kInstanceFiles } from '@/composables/instanceFiles'
import { InstanceInstallDialog, InstanceInstallOptions } from '@/composables/instanceUpdate'
import { kInstances } from '@/composables/instances'
import { kJavaContext } from '@/composables/java'
import { useVuetifyColor } from '@/composables/vuetify'
import { basename } from '@/util/basename'
import { getFTBTemplateAndFile } from '@/util/ftb'
import { injection } from '@/util/inject'
import { EditInstanceOptions, InstallInstanceOptions, InstanceFileUpdate, InstanceInstallServiceKey, ModpackServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { BuiltinImages } from '../constant'

const selected = ref([] as string[])
const search = ref('')
const upgrade = ref(undefined as undefined | UpgradeValueType)

// ref for virtual scrolling
const scrollRef = ref<HTMLElement | null>(null)

const { refresh, refreshing, error } = useRefreshable<InstanceInstallOptions>(async (param) => {
  if (!param) {
    return
  }

  const upgradeValue = await getUpgradeValueFromParam(param)
  const updateDelta = await previewInstanceFiles(upgradeValue.installation)
  upgrade.value = {
    ...upgradeValue,
    delta: updateDelta,
  }
  if (selectable.value) {
    const selectedResult = upgradeValue.installation.files.map(f => f.path)
    if ('oldFiles' in upgradeValue.installation) {
      selectedResult.push(...upgradeValue.installation.oldFiles.map(f => f.path))
    }
    selected.value = selectedResult
  }
})

const { isShown } = useDialog(InstanceInstallDialog, (parm) => {
  refresh(parm)
}, () => {
  upgrade.value = undefined
})

const { openModpack } = useService(ModpackServiceKey)
const { installInstanceFiles, previewInstanceFiles } = useService(InstanceInstallServiceKey)

const { edit } = injection(kInstances)
const { t } = useI18n()

type UpgradeValueType = {
  edit?: EditInstanceOptions
  installation: InstallInstanceOptions
  delta: InstanceFileUpdate[]
}

const tOperations = computed(() => ({
  add: t('instanceFileOperation.add'),
  remove: t('instanceFileOperation.remove'),
  keep: t('instanceFileOperation.keep'),
  'backup-add': t('instanceFileOperation.backup-add'),
  'backup-remove': t('instanceFileOperation.backup-remove'),
} as Record<string, string>))

const { getColorCode } = useVuetifyColor()
const runtime = computed(() => upgrade.value?.edit?.runtime || {} as Record<string, string>)

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
    name: basename(f.file.path, '/'),
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

const filterKeep = ref(false)

const fileNodes = shallowRef([] as FileOperationNode[])
const counts = shallowRef({ add: 0, remove: 0, keep: 0, hidden: 0 })
watch([upgrade, filterKeep], ([newVal, keep]) => {
  if (!newVal?.delta) {
    fileNodes.value = []
    return
  }
  const delta = newVal.delta
  const nodes = delta.map(getFileNode)
  const filtered = nodes.filter(n => n.data?.operation === 'keep' ? !keep : true)

  counts.value = nodes.reduce((acc, n) => {
    const op = n.data?.operation === 'backup-add' ? 'add' : n.data?.operation === 'backup-remove' ? 'remove' : n.data?.operation
    if (op) {
      acc[op]++
    }
    return acc
  }, { add: 0, remove: 0, keep: 0, hidden: nodes.length - filtered.length })

  fileNodes.value = filtered
}, { immediate: true })
provideFileNodes(fileNodes)

const { runtime: oldRuntime, path: instancePath } = injection(kInstance)

const { all: javas } = injection(kJavaContext)

async function getUpgradeValueFromParam(param: InstanceInstallOptions): Promise<Omit<UpgradeValueType, 'delta'>> {
  if (param.type === 'ftb') {
    const oldManifest = param.oldManifest
    const newManifest = param.newManifest
    // FTB
    const [config, newVersionFiles] = getFTBTemplateAndFile(newManifest, javas.value)
    const [_, oldVersionFiles] = getFTBTemplateAndFile(oldManifest, javas.value)
    return markRaw({
      edit: config,
      installation: {
        path: instancePath.value,
        oldFiles: oldVersionFiles,
        files: newVersionFiles,
        upstream: param.upstream,
      }
    })
  }

  if (param.type === 'upstream') {
    const instancePath = param.instancePath
    const modpack = param.modpack

    const state = await openModpack(modpack)
    const files = state.files
    const config = state.config

    return markRaw({
      edit: config,
      installation: {
        path: instancePath,
        files: files,
        upstream: param.upstream,
      }
    })
  } 
  
  return markRaw({
    installation: {
      path: instancePath.value,
      oldFiles: param.oldFiles,
      files: param.files,
      id: param.id,
    }
  })
}


const selectable = computed(() => {
  const upgradeValue = upgrade.value
  const install = upgradeValue?.installation
  // if (install && 'upstream' in upgradeValue.installation) {
  //   return false
  // }
  return true
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
  const up = upgrade.value
  if (!up) {
    return
  }
  const { edit: instance, installation } = up
  isShown.value = false
  const selectedPath = selected.value
  const path = instancePath.value
  try {
    if (selectable.value) {
      if ('oldFiles' in installation) {
        installation.oldFiles = installation.oldFiles.filter(f => selectedPath.includes(f.path))
      }
      installation.files = installation.files.filter(f => selectedPath.includes(f.path))
    }
    await installInstanceFiles(installation)
  } catch (e) {
    Object.assign(e as any, {
      instanceInstallErrorId: installation.id,
    })
    throw e
  }
  if (instance) {
    await edit({
      instancePath: path,
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

function cancel() {
  isShown.value = false
}
</script>
