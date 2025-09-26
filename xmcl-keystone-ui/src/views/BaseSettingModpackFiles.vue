<template>
  <v-list
    class="base-settings"
    color="transparent"
  >
    <SettingItem :title="t('modpack.exportDirectory')" :description="modpackMetadata.exportDirectory || t('modpack.exportDirectoryDescription')">
      <template #preaction>
        <v-icon>save_alt</v-icon>
      </template>
      <template #action>
        <v-btn
          outlined
          text
          @click="onSelectExportDirectory"
        >
          <v-icon left>
            edit
          </v-icon>
          {{ t("browse") }}
        </v-btn>
      </template>
    </SettingItem>
    <SettingSubheader :title="t('modpack.includes', 1)">
      <div class="flex flex-shrink flex-grow-0 items-center justify-center text-center text-sm dark:text-gray-500">
        ~{{ getExpectedSize(totalSize) }}
      </div>
      <v-btn icon class="z-1" @click="refresh" :loading="refreshing">
        <v-icon>
          refresh
        </v-icon>
      </v-btn>
    </SettingSubheader>
    <div
      class="visible-scroll modpack-files"
      ref="scrollElement"
    >
      <v-skeleton-loader
        v-if="refreshing"
        type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
      />
      <InstanceManifestFileTree
        v-model="cache.selected"
        selectable
        :scroll-element="scrollElement"
        :multiple="false"
      >
        <template #default="{ item, selected }">
          <template
            v-if="item.data && canExport(item.data) && selected && modpackMetadata.emitModrinth"
          >
            <v-tooltip
              left
              color="green"
            >
              <template #activator="{ on }">
                <v-chip
                  color="green"
                  label
                  outlined
                  :close="!!item.data.client"
                  v-on="on"
                  @click:close="item.data.client = ''"
                  @click="item.data.client = nextEnv(item.data.client)"
                >
                  <v-avatar left>
                    C
                  </v-avatar>
                  {{ getEnvText(item.data.client) }}
                </v-chip>
              </template>
              {{ t('modrinth.environments.client') }}
            </v-tooltip>
            <v-tooltip
              top
              color="blue"
            >
              <template #activator="{ on }">
                <v-chip
                  color="blue"
                  label
                  outlined
                  :close="!!item.data.server"
                  v-on="on"
                  @click:close="item.data.server = ''"
                  @click="item.data.server = nextEnv(item.data.server)"
                >
                  <v-avatar left>
                    S
                  </v-avatar>
                  {{ getEnvText(item.data.server) }}
                </v-chip>
              </template>
              {{ t('modrinth.environments.server') }}
            </v-tooltip>
          </template>
        </template>
      </InstanceManifestFileTree>
    </div>
  </v-list>
</template>

<script lang="ts" setup>
import InstanceManifestFileTree from '@/components/InstanceManifestFileTree.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingSubheader from '@/components/SettingSubheader.vue'
import { useRefreshable, useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { InstanceFileExportData, provideFileNodes, useInstanceFileNodesFromLocal } from '@/composables/instanceFileNodeData'
import { useInstanceModpackMetadata } from '@/composables/instanceModpackMetadata'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kModpackExport } from '@/composables/modpack'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { syncRef } from '@vueuse/core'
import type { InstanceFile } from '@xmcl/instance'
import { ExportFileDirective, InstanceManifestServiceKey, InstanceModsServiceKey, ModpackServiceKey, isAllowInModrinthModpack } from '@xmcl/runtime-api'

const { t } = useI18n()
const { getInstanceManifest } = useService(InstanceManifestServiceKey)
const { exportModpack } = useService(ModpackServiceKey)

const { modpackMetadata } = inject('modpackMetadata', useInstanceModpackMetadata())
const cache = shallowReactive({
  selected: [] as string[],
  files: [] as InstanceFile[],
})
const selectedPaths = computed(() => new Set(cache.selected))
const filterText = ref('')
const { leaves } = provideFileNodes(useInstanceFileNodesFromLocal(computed(() => cache.files.filter(f => f.path.toLowerCase().includes(filterText.value.toLowerCase())))))

const { instance } = injection(kInstance)
const { versionId } = injection(kInstanceVersion)
const scrollElement = ref<HTMLElement | null>(null)

const exportFiles = computed(() => {
  const selected = selectedPaths.value
  const result: ExportFileDirective[] = leaves.value
    .filter(n => selected.has(n.path))
    .map(l => ({
      path: l.path,
      env: l.data
        ? {
          client: l.data.client,
          server: l.data.server,
        }
        : undefined,
    }) as ExportFileDirective)
  return result
})

// loading
const { refreshMetadata } = useService(InstanceModsServiceKey)
const { refresh, refreshing } = useRefreshable(async () => {
  const path = instance.value.path
  await refreshMetadata(path)
  const manifest = await getInstanceManifest({ path })
  const files = manifest.files
  let selected = [] as string[]
  if (modpackMetadata.emittedFiles && modpackMetadata.emittedFiles.length > 0) {
    selected = files
      .filter(file => modpackMetadata.emittedFiles!.includes(file.path))
      .map(file => file.path)
  } else {
    selected = files
      .filter(file => file.path.startsWith('resourcepacks')
          || file.path.startsWith('mods')
          || file.path.startsWith('config')
          || file.path.startsWith('scripts')
          || file.path.startsWith('shaderpacks')
          || file.path.startsWith('options.txt')
          || file.path.startsWith('optionsof.txt')
          || file.path.startsWith('servers.dat'))
      .filter(file => !file.path.endsWith('.disabled'))
      .map(file => file.path)
  }
  nextTick().then(() => { cache.selected = selected })
  cache.files = files
})

onMounted(() => {
  refresh()
})

const totalSize = computed(() => {
  const existed = selectedPaths.value
  return leaves.value.filter(n => existed.has(n.path))
    .filter(n => (!n.data?.curseforge && !n.data?.downloads) || n.data.forceOverride /* || !canExport(n.data) */)
    .map(l => l.size)
    .reduce((a, b) => a + b, 0)
})

function getEnvText(env: string) {
  if (env === 'required') return t('modrinth.environments.required')
  if (env === 'optional') return t('modrinth.environments.optional')
  if (env === 'unsupported') return t('modrinth.environments.unsupported')
  return t('modrinth.environments.default')
}

function nextEnv(env: string) {
  if (env === 'required') return 'optional'
  if (env === 'optional') return 'unsupported'
  return 'required'
}

function canExport(fileData: InstanceFileExportData) {
  if (!fileData.curseforge && !fileData.downloads) return false
  if (modpackMetadata.emitCurseforge) {
    return !!fileData.curseforge
  }
  if (modpackMetadata.emitModrinth && fileData.downloads) {
    if (fileData.downloads.length === 0) return false
    return fileData.downloads.some(v => isAllowInModrinthModpack(v, modpackMetadata.emitModrinthStrict))
  }
  return false
}

function onSelectExportDirectory() {
  windowController.showOpenDialog({
    title: t('modpack.exportDirectory'),
    properties: ['openDirectory', 'createDirectory'],
  }).then(({ filePaths, canceled }) => {
    if (!canceled && filePaths.length > 0) {
      modpackMetadata.exportDirectory = filePaths[0]
    }
  })
}

const disabledBuild = computed(() => !modpackMetadata.emitCurseforge && !modpackMetadata.emitModrinth && !modpackMetadata.emitOffline)
const { refresh: confirm, refreshing: exporting } = useRefreshable(async () => {
  try {
    const path = instance.value.path
    await exportModpack({
      instancePath: path,
      gameVersion: versionId.value || '',
      name: instance.value.name,
      files: exportFiles.value,
      author: instance.value.author,
      version: modpackMetadata.modpackVersion,
      destinationDirectory: modpackMetadata.exportDirectory,
      emitOffline: modpackMetadata.emitOffline,
      emitCurseforge: modpackMetadata.emitCurseforge,
      emitModrinth: modpackMetadata.emitModrinth,
      strictModeInModrinth: modpackMetadata.emitModrinthStrict,
    })
    modpackMetadata.emittedFiles = cache.selected
  } catch (e) {
    console.error(e)
  }
})

const { setExportHandler, loading } = injection(kModpackExport)
syncRef(loading, refreshing)
onMounted(() => {
  setExportHandler(() => {
    return confirm()
  })
})
onUnmounted(() => {
  setExportHandler(undefined)
})

</script>

<style scoped="true">
.flex {
  padding: 6px 8px !important
}

.v-btn {
  margin: 0
}

.modpack-files {
  height: 30rem;
  max-height: 30rem;
  padding: 0.4rem;
  margin-bottom: 1rem;
  isolation: isolate;
  contain: strict;
  overflow: auto;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.1);
}

.dark .modpack-files {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>
