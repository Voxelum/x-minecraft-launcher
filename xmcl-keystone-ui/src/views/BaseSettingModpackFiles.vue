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
    <SettingSubheader :title="t('modpack.includes', 1)" class="mb-2">
      <div class="mx-2">
        <v-text-field
          v-model="filterText"
          :label="t('filter')"
          dense
          outlined
          hide-details
          clearable
          prepend-inner-icon="search"
          single-line
        />
      </div>
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
      <InstanceManifestFileTree
        v-model="cache.selected"
        :loading="refreshing"
        selectable
        :scroll-element="scrollElement"
        :multiple="false"
      >
        <template #default="{ item, selected }">
          <div
            v-if="(item.curseforge || item.modrinth)"
            class="inline-flex gap-2"
            @click.stop
          >
            <div
              class="v-item-group theme--dark v-btn-toggle v-btn-toggle--dense"
            >
              <v-btn v-shared-tooltip="_ => getEnvText(item, 'client')" text small @click="toggle(item, 'client')">
                <v-icon small left>desktop_mac</v-icon>
                <v-icon small color="green" v-if="getEnvValue(item, 'client') === 'required'"> check </v-icon>
                <v-icon small color="red" v-else-if="getEnvValue(item, 'client') === 'unsupported'"> close </v-icon>
                <v-icon small color="orange" v-else> question_mark </v-icon>
              </v-btn>
              <v-btn v-shared-tooltip="_ => getEnvText(item, 'server')" text small @click="toggle(item, 'server')">
                <v-icon class="material-symbols-outlined" left small>hard_drive</v-icon>
                <v-icon small color="green" v-if="getEnvValue(item, 'server') === 'required'"> check </v-icon>
                <v-icon small color="red" v-else-if="getEnvValue(item, 'server') === 'unsupported'"> close </v-icon>
                <v-icon small color="orange" v-else> question_mark </v-icon>
              </v-btn>
            </div>
          </div>
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
import { InstanceFileExportData, InstanceFileNode, provideFileNodes, useInstanceFileNodesFromLocal } from '@/composables/instanceFileNodeData'
import { useInstanceModpackMetadata } from '@/composables/instanceModpackMetadata'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kModpackExport } from '@/composables/modpack'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { getModSides } from '@/util/modSides'
import { getExpectedSize } from '@/util/size'
import { syncRef } from '@vueuse/core'
import type { InstanceFile } from '@xmcl/instance'
import { ExportFileDirective, InstanceManifestServiceKey, InstanceModsServiceKey, InstanceResourcePacksServiceKey, InstanceShaderPacksServiceKey, ModMetadataServiceKey, ModpackServiceKey } from '@xmcl/runtime-api'

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

const environments = shallowRef<Record<string, { client: string; server: string }>>({})
watch(environments, (val) => {
  modpackMetadata.filesEnvironments = val
})

// loading
const { refreshMetadata: refreshMods } = useService(InstanceModsServiceKey)
const { refreshMetadata: refreshResourcePacks } = useService(InstanceResourcePacksServiceKey)
const { refreshMetadata: refreshShaderPacks } = useService(InstanceShaderPacksServiceKey)
const { refresh, refreshing } = useRefreshable(async () => {
  const path = instance.value.path
  await refreshMods(path)
  await refreshResourcePacks(path)
  await refreshShaderPacks(path)
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
          || file.path.startsWith('servers.dat')
          || file.path.startsWith('theme.json')
          || file.path.startsWith('theme')
        )
      .filter(file => !file.path.endsWith('.disabled'))
      .map(file => file.path)
  }
  nextTick().then(() => { cache.selected = selected })
  cache.files = files

  const selectedFiles = files.filter(f => (f.path.startsWith('mods') || f.path.startsWith('resourcepacks') || f.path.startsWith('shaderpacks')) && f.hashes.sha1)

  if (modpackMetadata.filesEnvironments && Object.keys(modpackMetadata.filesEnvironments).length > 0) {
    const existed = Object.keys(modpackMetadata.filesEnvironments)

    const newToAdd = selectedFiles.filter(f => !existed.includes(f.path))
    const toDelete = existed.filter(f => !selectedFiles.find(file => file.path === f))
    const newEnvs = { ...modpackMetadata.filesEnvironments }
    for (const del of toDelete) {
      delete newEnvs[del]
    }
    if (newToAdd.length > 0) {
      await updateEnvironments(newToAdd, newEnvs)
    }
    environments.value = newEnvs
  } else {
    const newEnv = { ...environments.value }
    await updateEnvironments(selectedFiles, newEnv)
    environments.value = newEnv
  }
})

async function updateEnvironments(files: InstanceFile[], envs: Record<string, { client: string; server: string }>) {
  const withHash = files.filter(f => (f.path.startsWith('mods') || f.path.startsWith('resourcepacks') || f.path.startsWith('shaderpacks')) && f.hashes.sha1)
  const hashToSide = await getModSides(withHash.map(f_1 => ({ hash: f_1.hashes.sha1, modrinth: f_1.modrinth })), true).catch(() => ({} as Record<string, { client: string; server: string }>))
  for (const file of files) {
    if (file.hashes.sha1) {
      const found = hashToSide[file.hashes.sha1]
      if (found) {
        envs[file.path] = found
      }
    }
  }
}

onMounted(() => {
  refresh()
})

const totalSize = computed(() => {
  const existed = selectedPaths.value
  return leaves.value.filter(n => existed.has(n.path))
    .filter(n => (!n?.curseforge && !n.data?.downloads) /* || !canExport(n.data) */)
    .map(l => l.size)
    .reduce((a, b) => a + b, 0)
})

function toggle(item: InstanceFileNode<any>, side: 'client' | 'server' = 'client') {
  const copy = { ...environments.value }

  const env = copy[item.path] || { client: '', server: '' }
  if (env[side] === 'required') {
    env[side] = 'unsupported'
  } else if (env[side] === 'unsupported') {
    env[side] = 'optional'
  } else if (env[side] === 'optional') {
    env[side] = 'required'
  } else {
    env[side] = 'unsupported'
  }
  copy[item.path] = env

  environments.value = copy
}

function getEnvValue(item: InstanceFileNode<any>, side: 'client' | 'server' = 'client') {
  const env = environments.value[item.path] || { client: '', server: '' }
  return env[side] || 'required'
}

const getEnvText = (item: InstanceFileNode<any>, side: 'client' | 'server' = 'client') => {
  const prefix = side === 'client' ? t('modrinth.environments.client') : t('modrinth.environments.server')
  const val = getEnvValue(item, side)
  if (val === 'required') {
    return prefix + ': ' + t('modrinth.environments.required')
  } else if (val === 'optional') {
    return prefix + ': ' + t('modrinth.environments.optional')
  } else if (val === 'unsupported') {
    return prefix + ': ' + t('modrinth.environments.unsupported')
  }
  return prefix + ': ' + t('modrinth.environments.required')
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
    const selected = selectedPaths.value
    const exportFiles: ExportFileDirective[] = leaves.value
      .filter(n => selected.has(n.path))
      .map(l => ({
        path: l.path,
        env: environments.value[l.path] ? environments.value[l.path]
          : undefined,
      }) as ExportFileDirective)
    const path = instance.value.path
    await exportModpack({
      instancePath: path,
      gameVersion: versionId.value || '',
      name: instance.value.name,
      files: exportFiles,
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
