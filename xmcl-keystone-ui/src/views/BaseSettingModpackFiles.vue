<template>
  <Teleport defer to="#modrinth-project-anchor">
    <BaseSettingModrinthProjectCard :project-id="boundProjectId" :last-version-id="modpackMetadata.modrinth.lastVersionId" :bind-loading="bindingProject" :create-loading="creatingProject" :unbinding="unbindingProject" @bind="openBindDialog" @create="openCreateDialog" @publish="openPublishDialog" @unbind="unbindProject" />
  </Teleport>

  <SettingCard :title="t('modpack.export')" icon="ios_share">
    <SettingItem
      long-action
      :title="t('modpack.exportDirectory')"
      :description="modpackMetadata.exportDirectory || t('modpack.exportDirectoryDescription')"
    >
      <template #preaction>
        <v-icon>folder_open</v-icon>
      </template>
      <template #action>
        <v-btn variant="tonal" prepend-icon="edit" @click="onSelectExportDirectory">
          {{ t('shared.browse') }}
        </v-btn>
      </template>
    </SettingItem>
    <v-divider class="my-2" />
    <SettingItem
      :title="t('modpack.emitCurseforge')"
      class="cursor-pointer"
      @click="modpackMetadata.emitCurseforge = !modpackMetadata.emitCurseforge"
    >
      <template #preaction>
        <v-icon>xmcl:curseforge</v-icon>
      </template>
      <template #action>
        <v-switch
          v-model="modpackMetadata.emitCurseforge"
          color="primary"
          hide-details
          inset
          density="compact"
          @click.stop
        />
      </template>
    </SettingItem>
    <v-divider class="my-2" />
    <SettingItem
      :title="t('modpack.emitModrinth')"
      class="cursor-pointer"
      @click="modpackMetadata.emitModrinth = !modpackMetadata.emitModrinth"
    >
      <template #preaction>
        <v-icon>xmcl:modrinth</v-icon>
      </template>
      <template #action>
        <v-switch
          v-model="modpackMetadata.emitModrinth"
          color="primary"
          hide-details
          inset
          density="compact"
          @click.stop
        />
      </template>
    </SettingItem>
    <template v-if="modpackMetadata.emitModrinth">
      <v-divider class="my-2" />
      <SettingItem
        :title="t('modpack.emitModrinthStrict')"
        class="cursor-pointer"
        @click="modpackMetadata.emitModrinthStrict = !modpackMetadata.emitModrinthStrict"
      >
        <template #preaction>
          <v-icon class="opacity-60">verified</v-icon>
        </template>
        <template #subtitle>
          <div class="flex items-center gap-2 flex-wrap">
            <span>{{ t('modpack.emitModrinthStrictDescription') }}</span>
            <a
              class="inline-flex items-center rounded border border-dashed border-green-300 px-1 text-xs"
              target="browser"
              href="https://docs.modrinth.com/docs/modpacks/format_definition/#downloads"
              @click.stop
            >
              docs.modrinth.com
            </a>
          </div>
        </template>
        <template #action>
          <v-switch
            v-model="modpackMetadata.emitModrinthStrict"
            color="primary"
            hide-details
            inset
            density="compact"
            @click.stop
          />
        </template>
      </SettingItem>
    </template>
  </SettingCard>

  <SettingCard class="base-setting-card--wide" :title="t('modpack.includes', 1)" icon="folder_zip">
    <template #header-action>
      <div class="flex items-center gap-2 min-w-0">
        <v-tabs v-model="fileSide" density="compact" color="primary" class="modpack-file-tabs">
          <v-tab value="client" size="small"><v-icon start size="small">desktop_windows</v-icon>{{ t('shared.client') }}</v-tab>
          <v-tab value="server" size="small" :disabled="!hasServerFiles"><v-icon start size="small">dns</v-icon>{{ t('shared.server') }}</v-tab>
        </v-tabs>
        <v-text-field
          v-model="filterText"
          :label="t('shared.filter')"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          prepend-inner-icon="search"
          class="flex-grow min-w-0 w-40"
        />
        <div class="text-sm whitespace-nowrap opacity-70">
          ~{{ getExpectedSize(totalSize) }}
        </div>
        <v-btn
          v-shared-tooltip="() => t('modpack.selectDefaultFiles')"
          variant="text"
          icon="restore"
          size="small"
          :disabled="(fileSide === 'client' ? refreshing : serverRefreshing) || !activeFiles.length"
          @click="selectDefaultFiles"
        />
        <v-btn
          variant="text"
          icon="refresh"
          size="small"
          :loading="refreshing"
          @click="refresh"
        />
      </div>
    </template>
    <div ref="scrollElement" class="visible-scroll modpack-files">
      <InstanceManifestFileTree
        v-model="activeSelection"
        :loading="refreshing || serverRefreshing"
        selectable
        :scroll-element="scrollElement"
      >
        <template #default="{ item }">
          <div v-if="fileSide === 'client' && (item.curseforge || item.modrinth)" class="inline-flex gap-2" @click.stop>
            <div class="v-btn-toggle v-btn-toggle--density-compact">
              <v-btn
                v-shared-tooltip="() => getEnvText(item, 'client')"
                variant="text"
                size="small"
                @click="toggle(item, 'client')"
              >
                <v-icon size="small" start>desktop_mac</v-icon>
                <v-icon v-if="getEnvValue(item, 'client') === 'required'" size="small" color="green">
                  check
                </v-icon>
                <v-icon
                  v-else-if="getEnvValue(item, 'client') === 'unsupported'"
                  size="small"
                  color="red"
                >
                  close
                </v-icon>
                <v-icon v-else size="small" color="orange"> question_mark </v-icon>
              </v-btn>
              <v-btn
                v-shared-tooltip="() => getEnvText(item, 'server')"
                variant="text"
                size="small"
                @click="toggle(item, 'server')"
              >
                <v-icon class="material-symbols-outlined" start size="small">hard_drive</v-icon>
                <v-icon v-if="getEnvValue(item, 'server') === 'required'" size="small" color="green">
                  check
                </v-icon>
                <v-icon
                  v-else-if="getEnvValue(item, 'server') === 'unsupported'"
                  size="small"
                  color="red"
                >
                  close
                </v-icon>
                <v-icon v-else size="small" color="orange"> question_mark </v-icon>
              </v-btn>
            </div>
          </div>
        </template>
      </InstanceManifestFileTree>
    </div>
    <div v-if="fileSide === 'server'" class="flex items-center gap-3 px-2 pb-2">
      <span v-if="!hasServerFiles" class="text-sm text-medium-emphasis">{{ t('server.exportNoFilesHint') }}</span>
      <v-spacer />
      <v-btn
        color="primary"
        variant="tonal"
        prepend-icon="folder"
        :disabled="!serverCache.selected.length"
        :loading="exportingServerFolder"
        @click="exportServerToFolder"
      >
        {{ t('server.exportToFolder') }}
      </v-btn>
    </div>
  </SettingCard>
</template>

<script lang="ts" setup>
import InstanceManifestFileTree from '@/components/InstanceManifestFileTree.vue'
import BaseSettingModrinthProjectCard from '@/components/BaseSettingModrinthProjectCard.vue'
import SettingItem from '@/components/SettingItem.vue'
import SettingCard from '@/components/SettingCard.vue'
import { useRefreshable, useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import {
  InstanceFileNode,
  provideFileNodes,
  useInstanceFileNodesFromLocal,
} from '@/composables/instanceFileNodeData'
import { useInstanceModpackMetadata } from '@/composables/instanceModpackMetadata'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kModpackExport } from '@/composables/modpack'
import { useInstanceVersionServerInstall } from '@/composables/instanceVersionServerInstall'
import { kUserContext } from '@/composables/user'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { getModrinthModLoaders } from '@/util/modrinth'
import { getModSides } from '@/util/modSides'
import { getExpectedSize } from '@/util/size'
import { syncRef } from '@vueuse/core'
import type { InstanceFile } from '@xmcl/instance'
import type { Project } from '@xmcl/modrinth'
import {
  ExportFileDirective,
  BaseServiceKey,
  InstanceIOServiceKey,
  InstanceManifestServiceKey,
  InstanceModsServiceKey,
  InstanceResourcePacksServiceKey,
  InstanceServiceKey,
  InstanceShaderPacksServiceKey,
  ModpackServiceKey,
} from '@xmcl/runtime-api'
import { useDialog } from '@/composables/dialog'
import { ModrinthProjectBindDialogKey, ModrinthProjectCreateDialogKey, ModrinthVersionPublishDialogKey, useModrinthProjectBindingBus } from '@/composables/modrinthProjectBinding'
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'

const { t } = useI18n()
const { getInstanceManifest, getInstanceServerManifest } = useService(InstanceManifestServiceKey)
const { getInstanceModpackMetadata } = useService(InstanceServiceKey)
const { exportModpack, unbindModrinthProject } = useService(ModpackServiceKey)

const { modpackMetadata } = inject('modpackMetadata', useInstanceModpackMetadata())
const cache = shallowReactive({
  selected: [] as string[],
  files: [] as InstanceFile[],
})
const serverCache = shallowReactive({ selected: [] as string[], files: [] as InstanceFile[] })
const defaultServerFileRoots = ['mods', 'config', 'defaultconfigs', 'kubejs', 'scripts', 'plugins']
const fileSide = ref<'client' | 'server'>('client')
const activeSelection = computed({
  get: () => fileSide.value === 'client' ? cache.selected : serverCache.selected,
  set: (value: string[]) => {
    if (fileSide.value === 'client') cache.selected = value
    else serverCache.selected = value
  },
})
const activeFiles = computed(() => fileSide.value === 'client' ? cache.files : serverCache.files)
const selectedPaths = computed(() => new Set(activeSelection.value))
const filterText = ref('')
const { leaves } = provideFileNodes(
  useInstanceFileNodesFromLocal(
    computed(() =>
      activeFiles.value.filter((f) =>
        f.path.toLowerCase().includes((filterText.value || '').toLowerCase()),
      ),
    ),
  ),
)

const { instance } = injection(kInstance)
const { versionId } = injection(kInstanceVersion)
const scrollElement = ref<HTMLElement | null>(null)
const boundProjectId = computed(() => typeof modpackMetadata.modrinth.projectId === 'string' ? modpackMetadata.modrinth.projectId : (modpackMetadata.modrinth.projectId as Project | undefined)?.id || '')
const { show: showCreateProject, isShown: isCreateDialogShown } = useDialog(ModrinthProjectCreateDialogKey)
const { show: showBindProject, isShown: isBindDialogShown } = useDialog(ModrinthProjectBindDialogKey)
const { show: showPublishVersion } = useDialog(ModrinthVersionPublishDialogKey)
const { interact, userData } = injection(kModrinthAuthenticatedAPI)
const authenticatingAction = ref<'bind' | 'create'>()
const bindingProject = computed(() => authenticatingAction.value === 'bind' || isBindDialogShown.value)
const creatingProject = computed(() => authenticatingAction.value === 'create' || isCreateDialogShown.value)
const unbindingProject = ref(false)
const bindingBus = useModrinthProjectBindingBus()
const hasServerFiles = computed(() => serverCache.files.length > 0)

function getDefaultClientFiles(files: InstanceFile[]) {
  return files
    .filter(
      (file) =>
        file.path.startsWith('resourcepacks') ||
        file.path.startsWith('mods') ||
        file.path.startsWith('config') ||
        file.path.startsWith('scripts') ||
        file.path.startsWith('shaderpacks') ||
        file.path.startsWith('options.txt') ||
        file.path.startsWith('optionsof.txt') ||
        file.path.startsWith('theme.json') ||
        file.path.startsWith('theme'),
    )
    .filter((file) => !file.path.endsWith('.disabled'))
    .map((file) => file.path)
}

function getDefaultServerFiles(files: InstanceFile[]) {
  return files
    .filter(file => defaultServerFileRoots.some(root => file.path.startsWith(`${root}/`)))
    .filter(file => !file.path.endsWith('.disabled'))
    .map(file => file.path)
}

function selectDefaultFiles() {
  activeSelection.value = fileSide.value === 'client'
    ? getDefaultClientFiles(cache.files)
    : getDefaultServerFiles(serverCache.files)
}

const stopBindingBus = bindingBus.on((project) => {
  modpackMetadata.modrinth = { ...modpackMetadata.modrinth, projectId: project.id }
})
onUnmounted(stopBindingBus)

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
      .filter((file) => modpackMetadata.emittedFiles!.includes(file.path))
      .map((file) => file.path)
  } else {
    selected = getDefaultClientFiles(files)
  }
  nextTick().then(() => {
    cache.selected = selected
  })
  cache.files = files

  const selectedFiles = files.filter(
    (f) =>
      (f.path.startsWith('mods') ||
        f.path.startsWith('resourcepacks') ||
        f.path.startsWith('shaderpacks')) &&
      f.hashes.sha1,
  )

  if (
    modpackMetadata.filesEnvironments &&
    Object.keys(modpackMetadata.filesEnvironments).length > 0
  ) {
    const existed = Object.keys(modpackMetadata.filesEnvironments)

    const newToAdd = selectedFiles.filter((f) => !existed.includes(f.path))
    const toDelete = existed.filter((f) => !selectedFiles.find((file) => file.path === f))
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

const { refresh: refreshServer, refreshing: serverRefreshing } = useRefreshable(async () => {
  const files = await getInstanceServerManifest({ path: instance.value.path })
  const selected = modpackMetadata.emittedServerFiles.length
    ? files.filter(file => modpackMetadata.emittedServerFiles.includes(file.path)).map(file => file.path)
    : getDefaultServerFiles(files)
  serverCache.files = files
  serverCache.selected = selected
})

async function updateEnvironments(
  files: InstanceFile[],
  envs: Record<string, { client: string; server: string }>,
) {
  const withHash = files.filter(
    (f) =>
      (f.path.startsWith('mods') ||
        f.path.startsWith('resourcepacks') ||
        f.path.startsWith('shaderpacks')) &&
      f.hashes.sha1,
  )
  const hashToSide = await getModSides(
    withHash.map((f_1) => ({ hash: f_1.hashes.sha1, modrinth: f_1.modrinth })),
    true,
  ).catch(() => ({}) as Record<string, { client: string; server: string }>)
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
  refreshServer()
})

watch(() => serverCache.selected, (selected) => {
  modpackMetadata.emittedServerFiles = [...selected]
}, { deep: true })
watch(() => cache.selected, (selected) => {
  modpackMetadata.emittedFiles = [...selected]
}, { deep: true })

const totalSize = computed(() => {
  const existed = selectedPaths.value
  return leaves.value
    .filter((n) => existed.has(n.path))
    .filter((n) => !n?.curseforge && !n.data?.downloads /* || !canExport(n.data) */)
    .map((l) => l.size)
    .reduce((a, b) => a + b, 0)
})

const { exportInstanceAsServer } = useService(InstanceIOServiceKey)
const { showItemInDirectory } = useService(BaseServiceKey)
const { generateLaunchOptions } = injection(kInstanceLaunch)
const { userProfile } = injection(kUserContext)
const { install: installServer } = useInstanceVersionServerInstall()
const { refresh: exportServerToFolder, refreshing: exportingServerFolder } = useRefreshable(async () => {
  const { filePaths, canceled } = await windowController.showOpenDialog({
    title: t('server.export'),
    defaultPath: `${instance.value.name}-server`,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || !filePaths[0]) return
  const version = await installServer()
  await exportInstanceAsServer({
    output: { type: 'folder', path: filePaths[0] },
    options: await generateLaunchOptions(instance.value.path, userProfile.value, '', 'server', { version }, true),
    files: serverCache.files.filter(file => serverCache.selected.includes(file.path)),
  })
  showItemInDirectory(filePaths[0])
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
  const prefix = side === 'client' ? t('shared.client') : t('shared.server')
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
  windowController
    .showOpenDialog({
      title: t('modpack.exportDirectory'),
      properties: ['openDirectory', 'createDirectory'],
    })
    .then(({ filePaths, canceled }) => {
      if (!canceled && filePaths.length > 0) {
        modpackMetadata.exportDirectory = filePaths[0]
      }
    })
}

function getExportFiles() {
  const selected = selectedPaths.value
  const clientFiles = cache.files
    .filter((file) => selected.has(file.path))
    .map((file) => ({
      path: file.path,
      env: environments.value[file.path] || undefined,
    }) as ExportFileDirective)
  const selectedServerFiles = new Set(serverCache.selected)
  const serverFiles = serverCache.files
    .filter(file => selectedServerFiles.has(file.path))
    .map(file => ({
      path: file.path,
      source: `server/${file.path}`,
      override: true,
      env: { client: 'unsupported' as const, server: 'required' as const },
    }))
  return [...clientFiles, ...serverFiles]
}

function getPublishOptions() {
  return {
    instancePath: instance.value.path, gameVersion: instance.value.runtime.minecraft || versionId.value || '', loaders: getModrinthModLoaders(instance.value.runtime, false),
    name: instance.value.name, author: instance.value.author, currentVersion: modpackMetadata.modpackVersion,
    destinationDirectory: modpackMetadata.exportDirectory, strictMode: modpackMetadata.emitModrinthStrict,
    profile: modpackMetadata.modrinth.profile, versionType: modpackMetadata.modrinth.versionType, files: getExportFiles(),
  }
}

async function requireModrinthLogin(action: 'bind' | 'create') {
  if (userData.value) return true
  authenticatingAction.value = action
  try { await interact(); return !!userData.value } finally { authenticatingAction.value = undefined }
}
async function openBindDialog() { if (await requireModrinthLogin('bind')) showBindProject({ instancePath: instance.value.path }) }
async function openCreateDialog() { if (await requireModrinthLogin('create')) showCreateProject({ instancePath: instance.value.path, name: instance.value.name, summary: instance.value.description || '', hasServer: !!instance.value.server }) }
async function unbindProject() {
  unbindingProject.value = true
  try {
    await unbindModrinthProject(instance.value.path)
    modpackMetadata.modrinth = {
      ...modpackMetadata.modrinth,
      projectId: '',
      lastVersionId: '',
      lastPublishedAt: 0,
      lastPublishedFiles: [],
      pendingProjectStatus: undefined,
      artifacts: [],
    }
  } finally {
    unbindingProject.value = false
  }
}
function openPublishDialog(project: Project) {
  const options = getPublishOptions()
  const projectId = project?.id || boundProjectId.value
  if (projectId) {
    showPublishVersion({
      ...options,
      projectId,
      projectSlug: project?.slug || instance.value.name,
      onPublished: async () => {
        const metadata = await getInstanceModpackMetadata(instance.value.path)
        if (metadata) Object.assign(modpackMetadata, metadata)
      },
    })
  }
}

const disabledBuild = computed(
  () =>
    !modpackMetadata.emitCurseforge &&
    !modpackMetadata.emitModrinth,
)
const { refresh: confirm, refreshing: exporting } = useRefreshable(async () => {
  try {
    const path = instance.value.path
    await exportModpack({
      instancePath: path,
      gameVersion: instance.value.runtime.minecraft || versionId.value || '',
      name: instance.value.name,
      files: getExportFiles(),
      author: instance.value.author,
      version: modpackMetadata.modpackVersion,
      destinationDirectory: modpackMetadata.exportDirectory,
      emitOffline: false,
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
  padding: 6px 8px !important;
}

.v-btn {
  margin: 0;
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

.modpack-file-tabs {
  min-width: 230px;
}

.dark .modpack-files {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>
