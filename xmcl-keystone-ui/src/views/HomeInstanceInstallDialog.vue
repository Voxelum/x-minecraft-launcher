<template>
  <v-dialog
    v-model="isShown"
    width="860"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div class="select-none flex max-h-[90vh] flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center px-6 pt-6 pb-4">
        <div class="flex items-center gap-3 flex-grow">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style="background-color: rgba(var(--v-theme-primary), 0.12)"
          >
            <v-icon size="22" color="primary">system_update_alt</v-icon>
          </div>
          <div class="text-base font-bold tracking-tight" style="color: rgba(var(--v-theme-on-surface), 0.9);">
            {{ t('instanceUpdate.title') }}
          </div>
        </div>
        <v-chip
          v-if="!refreshing && upgrade"
          size="small"
          variant="tonal"
          color="primary"
          class="mr-2 font-medium"
        >
          <v-icon start size="small">summarize</v-icon>
          {{ t('instanceUpdate.summary', {
            add: counts.add,
            remove: counts.remove,
            keep: counts.keep,
          }) }}
        </v-chip>
        <v-btn
          icon="close"
          variant="text"
          size="small"
          @click="cancel"
        />
      </div>

      <v-skeleton-loader
        v-if="refreshing"
        class="px-4 py-2"
        type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
      />
      <ErrorView :error="error" />

      <!-- Empty state: no upgrade data -->
      <div
        v-if="!upgrade && !refreshing && !error"
        class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 opacity-60"
      >
        <v-icon size="48" color="primary">inventory_2</v-icon>
        <div class="text-sm">{{ t('instanceUpdate.noFiles') }}</div>
      </div>

      <div
        v-if="upgrade && !refreshing"
        ref="scrollRef"
        class="visible-scroll flex flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden px-6 py-4"
      >
        <template v-if="upgrade && upgrade.edit">
          <div class="flex items-center gap-2">
            <v-icon size="small" color="primary">tune</v-icon>
            <h3 class="text-base font-medium">{{ t('instanceUpdate.basic') }}</h3>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <v-text-field
              :model-value="getVersionString(oldRuntime.minecraft, runtime.minecraft)"
              persistent-hint
              label="Minecraft"
              readonly
              variant="outlined"
              density="compact"
              hide-details
            >
              <template #prepend-inner>
                <img :src="BuiltinImages.minecraft" width="28" />
              </template>
            </v-text-field>
            <v-text-field
              v-if="runtime.forge"
              :model-value="getVersionString(oldRuntime.forge, runtime.forge)"
              persistent-hint
              label="Forge"
              variant="outlined"
              readonly
              density="compact"
              hide-details
            >
              <template #prepend-inner>
                <img :src="BuiltinImages.forge" width="28" />
              </template>
            </v-text-field>
            <v-text-field
              v-if="runtime.neoForged"
              :model-value="getVersionString(oldRuntime.neoForged, runtime.neoForged)"
              persistent-hint
              label="NeoForge"
              variant="outlined"
              readonly
              density="compact"
              hide-details
            >
              <template #prepend-inner>
                <img :src="BuiltinImages.neoForged" width="28" />
              </template>
            </v-text-field>
            <v-text-field
              v-if="runtime.fabricLoader"
              :model-value="getVersionString(oldRuntime.fabricLoader, runtime.fabricLoader)"
              persistent-hint
              variant="outlined"
              readonly
              label="Fabric"
              density="compact"
              hide-details
            >
              <template #prepend-inner>
                <img :src="BuiltinImages.fabric" width="28" />
              </template>
            </v-text-field>
            <v-text-field
              v-if="runtime.quiltLoader"
              :model-value="getVersionString(oldRuntime.quiltLoader, runtime.quiltLoader)"
              persistent-hint
              variant="outlined"
              readonly
              label="Quilt"
              density="compact"
              hide-details
            >
              <template #prepend-inner>
                <img :src="BuiltinImages.quilt" width="28" />
              </template>
            </v-text-field>
          </div>

          <InstanceVersionShiftAlert :old-runtime="oldRuntime" :runtime="runtime" />

          <v-divider class="my-1" />
        </template>

        <div class="flex items-center gap-2">
          <v-icon size="small" color="primary">folder_open</v-icon>
          <h3 class="text-base font-medium">{{ t('instanceUpdate.files') }}</h3>

          <div class="ml-2 flex items-center gap-1">
            <v-chip
              v-if="counts.add > 0"
              size="x-small"
              variant="tonal"
              color="success"
              label
            >
              <v-icon start size="x-small">add</v-icon>
              {{ counts.add }}
            </v-chip>
            <v-chip
              v-if="counts.remove > 0"
              size="x-small"
              variant="tonal"
              color="error"
              label
            >
              <v-icon start size="x-small">delete</v-icon>
              {{ counts.remove }}
            </v-chip>
            <v-chip
              v-if="counts.keep > 0"
              size="x-small"
              variant="tonal"
              color="info"
              label
            >
              <v-icon start size="x-small">save</v-icon>
              {{ counts.keep }}
            </v-chip>
          </div>

          <v-spacer />

          <v-btn
            :icon="filterKeep ? 'visibility_off' : 'visibility'"
            class="z-1"
            size="small"
            variant="text"
            @click="filterKeep = !filterKeep"
          />
        </div>

        <InstanceManifestFileTree
          v-model="selected"
          :selectable="selectable"
          :multiple="false"
          :scroll-element="scrollRef"
        >
          <template #default="{ item }">
            <v-chip
              v-if="item.data"
              class="pointer-events-none"
              size="small"
              label
              variant="tonal"
              :color="cOperations[item.data.operation]"
            >
              <v-icon start size="small">
                {{ iOperations[item.data.operation] }}
              </v-icon>
              {{ tOperations[item.data.operation] }}
            </v-chip>
          </template>
        </InstanceManifestFileTree>

        <Hint
          v-if="fileNodes.length === 0 && counts.hidden > 0"
          class="min-h-60 static"
          icon="visibility_off"
          :text="t('instanceUpdate.summary', {
            add: counts.add,
            remove: counts.remove,
            keep: counts.keep,
          })"
        />

        <!-- Empty state: no file changes at all -->
        <div
          v-else-if="fileNodes.length === 0"
          class="flex flex-col items-center justify-center gap-3 py-12 opacity-60"
        >
          <v-icon size="40">check_circle</v-icon>
          <div class="text-sm">{{ t('instanceUpdate.noFiles') }}</div>
        </div>
      </div>

      <v-divider class="mx-6 opacity-20" />

      <div class="flex items-center px-6 py-4">
        <v-btn
          :disabled="refreshing"
          variant="text"
          @click="cancel"
        >
          {{ t('shared.cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          data-testid="install-instance-confirm"
          color="primary"
          variant="flat"
          size="large"
          rounded="pill"
          :loading="refreshing"
          :disabled="!upgrade"
          prepend-icon="download"
          @click="confirm"
        >
          {{ t('instanceUpdate.update') }}
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import ErrorView from '@/components/ErrorView.vue'
import Hint from '@/components/Hint.vue'
import InstanceManifestFileTree from '@/components/InstanceManifestFileTree.vue'
import InstanceVersionShiftAlert from '@/components/InstanceVersionShiftAlert.vue'
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
import type { EditInstanceOptions } from '@xmcl/instance'
import {
  InstallInstanceOptions,
  InstanceFileUpdate,
  InstanceInstallServiceKey,
  InstanceServiceKey,
  ModpackServiceKey,
} from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { BuiltinImages } from '../constant'

const selected = ref([] as string[])
const search = ref('')
// Use shallowRef so the underlying installation payload (which is sent over
// Electron IPC and must be structured-cloneable) is not wrapped in a deep
// reactive Proxy. A reactive Proxy throws "An object could not be cloned"
// when passed through IPC.
const upgrade = shallowRef(undefined as undefined | UpgradeValueType)

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
    const selectedResult = upgradeValue.installation.files.map((f) => f.path)
    if ('oldFiles' in upgradeValue.installation) {
      selectedResult.push(...upgradeValue.installation.oldFiles.map((f) => f.path))
    }
    selected.value = selectedResult
  }
})

const { isShown } = useDialog(
  InstanceInstallDialog,
  (parm) => {
    refresh(parm)
  },
  () => {
    upgrade.value = undefined
  },
)

const { openModpack } = useService(ModpackServiceKey)
const { installInstanceFiles, previewInstanceFiles } = useService(InstanceInstallServiceKey)
const { getInstanceModpackMetadata, setInstanceModpackMetadata } = useService(InstanceServiceKey)

const { edit } = injection(kInstances)
const { t } = useI18n()

type UpgradeValueType = {
  edit?: EditInstanceOptions
  installation: InstallInstanceOptions
  delta: InstanceFileUpdate[]
}

const tOperations = computed(
  () =>
    ({
      add: t('instanceFileOperation.add'),
      remove: t('instanceFileOperation.remove'),
      keep: t('instanceFileOperation.keep'),
      'backup-add': t('instanceFileOperation.backup-add'),
      'backup-remove': t('instanceFileOperation.backup-remove'),
    }) as Record<string, string>,
)

const { getColorCode } = useVuetifyColor()
const runtime = computed(() => upgrade.value?.edit?.runtime || ({} as Record<string, string>))

const getVersionString = (oldVersion?: string, newVersion?: string) =>
  oldVersion !== newVersion ? `${oldVersion} -> ${newVersion}` : newVersion

const cOperations = {
  add: 'success',
  remove: 'error',
  keep: 'info',
  'backup-add': 'success-darken-1',
  'backup-remove': 'error-lighten-1',
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
      textDecorationLine:
        f.operation === 'remove' || f.operation === 'backup-remove' ? 'line-through' : '',
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
watch(
  [upgrade, filterKeep],
  ([newVal, keep]) => {
    if (!newVal?.delta) {
      fileNodes.value = []
      return
    }
    const delta = newVal.delta
    const nodes = delta.map(getFileNode)
    const filtered = nodes.filter((n) => (n.data?.operation === 'keep' ? !keep : true))

    counts.value = nodes.reduce(
      (acc, n) => {
        const op =
          n.data?.operation === 'backup-add'
            ? 'add'
            : n.data?.operation === 'backup-remove'
              ? 'remove'
              : n.data?.operation
        if (op) {
          acc[op]++
        }
        return acc
      },
      { add: 0, remove: 0, keep: 0, hidden: nodes.length - filtered.length },
    )

    fileNodes.value = filtered
  },
  { immediate: true },
)
provideFileNodes(fileNodes)

const { runtime: oldRuntime, path: instancePath } = injection(kInstance)

const { all: javas } = injection(kJavaContext)

async function getUpgradeValueFromParam(
  param: InstanceInstallOptions,
): Promise<Omit<UpgradeValueType, 'delta'>> {
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
      },
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
      },
    })
  }

  return markRaw({
    installation: {
      path: instancePath.value,
      oldFiles: param.oldFiles,
      files: param.files,
      id: param.id,
    },
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
        installation.oldFiles = installation.oldFiles.filter((f) => selectedPath.includes(f.path))
      }
      installation.files = installation.files.filter((f) => selectedPath.includes(f.path))
    }
    await installInstanceFiles(installation)
  } catch (e) {
    Object.assign(e as any, {
      instanceInstallErrorId: installation.id,
    })
    throw e
  }
  // Update emittedFiles in modpack-metadata.json to reflect file changes
  try {
    const metadata = await getInstanceModpackMetadata(path)
    if (metadata && metadata.emittedFiles && metadata.emittedFiles.length > 0) {
      const delta = up.delta
      const removedPaths = new Set(delta
        .filter((f) => f.operation === 'remove' || f.operation === 'backup-remove')
        .map((f) => f.file.path))
      const addedPaths = delta
        .filter((f) => f.operation === 'add' || f.operation === 'backup-add')
        .map((f) => f.file.path)
      const updated = metadata.emittedFiles.filter((p) => !removedPaths.has(p))
      for (const p of addedPaths) {
        if (!updated.includes(p)) {
          updated.push(p)
        }
      }
      metadata.emittedFiles = updated
      await setInstanceModpackMetadata(path, metadata)
    }
  } catch {
    // Non-critical — don't block the upgrade
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
        optifine: instance.runtime?.optifine,
        labyMod: instance.runtime?.labyMod,
      },
      upstream: instance.upstream,
    })
  }
}

function cancel() {
  isShown.value = false
}
</script>
