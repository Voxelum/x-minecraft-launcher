<template>
  <v-dialog
    v-model="isShown"
    fullscreen
    hide-overlay
    transition="dialog-bottom-transition"
    scrollable
    width="800"
  >
    <v-card class="rounded-none">
      <v-toolbar
        class="moveable flex-1 flex-grow-0 rounded-none"
        tabs
        color="green en"
      >
        <v-toolbar-title class="text-white">
          {{ t('modpack.export') }}
        </v-toolbar-title>

        <v-spacer />
        <v-btn
          class="non-moveable"
          icon
          @click="cancel"
        >
          <v-icon>arrow_drop_down</v-icon>
        </v-btn>
      </v-toolbar>
      <div
        class="visible-scroll mx-0 max-h-[100vh] items-center justify-center overflow-y-auto overflow-x-hidden px-6 py-2"
      >
        <v-subheader>{{ t('modpack.general') }}</v-subheader>
        <div
          class="grid grid-cols-2 gap-4 gap-y-2"
        >
          <v-text-field
            v-model="name"
            prepend-inner-icon="edit"
            persistent-hint
            :hint="t('instance.nameHint')"
            :label="t('name')"
            required
          />
          <v-text-field
            v-model="author"
            prepend-inner-icon="person"
            persistent-hint
            :hint="t('modpack.authorHint')"
            :label="t('author')"
            required
          />
          <v-text-field
            v-model="data.version"
            prepend-inner-icon="history"
            persistent-hint
            :hint="t('modpack.modpackVersion')"
            :label="t('modpack.modpackVersion')"
            required
          />
          <v-select
            v-model="data.gameVersion"
            :items="localVersions"
            prepend-inner-icon="games"
            persistent-hint
            class="visible-scroll"
            :hint="t('instance.includeVersion', 2)"
            :label="t('instance.gameVersion')"
            required
          />
          <v-checkbox
            v-model="data.emitCurseforge"
            :label="t('modpack.emitCurseforge')"
            prepend-icon="$vuetify.icons.curseforge"
            hide-details
          />
          <v-checkbox
            v-model="data.emitMcbbs"
            :label="t('modpack.emitMcbbs')"
            hide-details
          />
          <v-checkbox
            v-model="data.emitModrinth"
            :label="t('modpack.emitModrinth')"
            hide-details
            prepend-icon="$vuetify.icons.modrinth"
          />

          <v-checkbox
            v-if="data.emitModrinth"
            v-model="data.emitModrinthStrict"
            :label="t('modpack.emitModrinthStrict')"
            hide-details
            prepend-icon="$vuetify.icons.modrinth"
          >
            <template #append>
              <v-tooltip
                top
              >
                <template #activator="{ on }">
                  <!-- <v-btn
                        text
                        icon
                      > -->
                  <a
                    class="rounded border border-dashed border-green-300 pb-[2px]"
                    target="browser"
                    href="https://docs.modrinth.com/docs/modpacks/format_definition/#downloads"
                    v-on="on"
                  >
                    <v-icon
                      color="primary"
                      class="cursor-pointer"
                      small
                    >
                      question_mark
                    </v-icon>
                  </a>
                  <!-- </v-btn> -->
                </template>
                {{ t('modpack.emitModrinthStrictDescription') }}
                <ul class="list-disc">
                  <li> cdn.modrinth.com </li>
                  <li>github.com</li>
                  <li>raw.githubusercontent.com</li>
                  <li>gitlab.com</li>
                </ul>
              </v-tooltip>
            </template>
          </v-checkbox>
          <template
            v-if="!(data.emitCurseforge || data.emitMcbbs || data.emitModrinth)"
          >
            <v-checkbox
              v-model="data.includeAssets"
              :label="t('modpack.includeAssets')"
              prepend-icon="texture"
              hide-details
            />
            <v-checkbox
              v-model="data.includeLibraries"
              :label="t('modpack.includeLibraries')"
              prepend-icon="camera_roll"
              hide-details
            />
          </template>
        </div>

        <div class="flex items-center">
          <v-subheader v-if="data.emitCurseforge || data.emitMcbbs">
            {{ t('modpack.overrides') }}
          </v-subheader>
          <v-subheader v-else>
            {{ t('modpack.includes') }}
          </v-subheader>
          <div class="flex-grow" />
          <v-text-field
            v-model="filterText"
            prepend-inner-icon="search"
            class="max-w-50"
            :label="t('filter')"
          />
        </div>

        <div
          style="padding: 5px; margin-bottom: 5px"
        >
          <v-skeleton-loader
            v-if="refreshing"
            type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
          />
          <InstanceManifestFileTree
            v-model="data.selected"
            selectable
            :search="filterText"
            :multiple="false"
          >
            <template #default="{ item, selected }">
              <template
                v-if="item.data && canExport(item.data) && selected && data.emitModrinth"
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
      </div>
      <div class="flex-grow" />
      <v-card-actions class="items-baseline gap-5">
        <v-btn
          text
          large
          :disabled="exporting || refreshing"
          @click="cancel"
        >
          {{ t('cancel') }}
        </v-btn>
        <v-spacer />
        <div class="flex flex-shrink flex-grow-0 items-center justify-center text-center text-sm text-gray-500">
          ~{{ getExpectedSize(totalSize) }}
        </div>
        <v-btn
          text
          color="primary"
          large
          :loading="exporting || refreshing"
          @click="confirm"
        >
          {{ t('modpack.export') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import { InstanceIOServiceKey, InstanceFile, ModpackServiceKey, ExportFileDirective, isAllowInModrinthModpack, InstanceManifestServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import { inc } from 'semver'
import { useDialog, useModrinthFilter, useZipFilter } from '../composables/dialog'
import { AppExportDialogKey } from '../composables/instanceExport'
import { useRefreshable, useService } from '@/composables'
import { getExpectedSize } from '@/util/size'
import InstanceManifestFileTree from '../components/InstanceManifestFileTree.vue'
import { kInstance } from '@/composables/instance'
import { injection } from '@/util/inject'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { InstanceFileExportData, InstanceFileNode, provideFileNodes, useInstanceFileNodesFromLocal } from '@/composables/instanceFileNodeData'
import { kLocalVersions } from '@/composables/versionLocal'

const { isShown, hide: cancel } = useDialog(AppExportDialogKey)
const { exportInstance } = useService(InstanceIOServiceKey)
const { editInstance } = useService(InstanceServiceKey)
const { getInstanceManifest } = useService(InstanceManifestServiceKey)
const { exportModpack } = useService(ModpackServiceKey)
const { showSaveDialog } = windowController
const { t } = useI18n()

// base data
const { instance } = injection(kInstance)
const { versionId } = injection(kInstanceVersion)
const { versions: _locals } = injection(kLocalVersions)

const name = computed(() => instance.value.name)
const author = computed(() => instance.value.author)
const modpackVersion = computed(() => instance.value.modpackVersion)
const zipFilter = useZipFilter()
const modrinthFilter = useModrinthFilter()
const baseVersion = modpackVersion.value || '0.0.0'
const localVersions = computed(() => _locals.value.map((v) => v.id))

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

const filterText = ref('')
const data = reactive({
  name: name.value,
  author: author.value,
  version: inc(baseVersion, 'patch') ?? '0.0.1',
  gameVersion: versionId.value,
  selected: [] as string[],
  fileApi: '',
  files: [] as InstanceFile[],
  includeLibraries: false,
  includeAssets: false,
  emitCurseforge: false,
  emitModrinth: true,
  emitModrinthStrict: true,
  emitMcbbs: false,
})

const enableCurseforge = computed(() => data.emitCurseforge || data.emitMcbbs)
const enableModrinth = computed(() => data.emitModrinth)

watch(enableModrinth, (v) => {
  if (v) {
    data.emitCurseforge = false
    data.emitMcbbs = false
  }
})

watch(enableCurseforge, (v) => {
  if (v) {
    data.emitModrinth = false
  }
})

const { leaves } = provideFileNodes(useInstanceFileNodesFromLocal(computed(() => data.files)))
const translatedMods = computed(() => ({
  curseforge: t('exportModpackTarget.curseforge'),
  modrinth: t('exportModpackTarget.modrinth'),
  override: t('exportModpackTarget.override'),
}))

function getDescription(item: InstanceFileNode<any>) {
    if (item.path.startsWith('mods/')) {
    let text = t('intro.struct.modJar')
    if (item.data) {
      if (item.data.curseforge) {
        text += (' 🧬 ' + translatedMods.value.curseforge)
      }
      if (item.data.modrinth) {
        text += (' 🧬 ' + translatedMods.value.modrinth)
      }
      if (!item.data.modrinth && !item.data.curseforge) {
        text += (' 🧬 ' + translatedMods.value.override)
      }
    }
    return text
  }
  return ''
}

function canExport(fileData: InstanceFileExportData) {
  if (!fileData.curseforge && !fileData.downloads) return false
  if (enableCurseforge.value) {
    return !!fileData.curseforge
  }
  if (enableModrinth.value && fileData.downloads) {
    if (fileData.downloads.length === 0) return false
    return fileData.downloads.some(v => isAllowInModrinthModpack(v, data.emitModrinthStrict))
  }
  return false
}

function reset() {
  data.includeAssets = false
  data.includeLibraries = false
  data.name = name.value
  data.author = author.value
  data.files = []
  data.selected = []
  data.gameVersion = versionId.value ?? ''
  data.version = inc(modpackVersion.value || '0.0.0', 'patch') ?? '0.0.1'
}

// loading
const { refresh, refreshing } = useRefreshable(async () => {
  const manifest = await getInstanceManifest({ path: instance.value.path })
  const files = manifest.files
  let selected = [] as string[]
  selected = files
    .filter(file => !file.path.startsWith('.'))
    .filter(file => !file.path.startsWith('logs'))
    .filter(file => !file.path.startsWith('crash-reports'))
    .filter(file => !file.path.startsWith('saves'))
    .filter(file => !file.path.startsWith('resourcepacks'))
    .map(file => file.path)
  nextTick().then(() => { data.selected = selected })
  data.files = files
})

// selecting & directives
const selectedPaths = computed(() => new Set(data.selected))

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

const totalSize = computed(() => {
  const existed = selectedPaths.value
  return leaves.value.filter(n => existed.has(n.path))
    .filter(n => !n.data || n.data.forceOverride || !canExport(n.data))
    .map(l => l.size)
    .reduce((a, b) => a + b, 0)
})

// export
const { refresh: confirm, refreshing: exporting } = useRefreshable(async () => {
  const { filePath, canceled } = await showSaveDialog({
    title: t('modpack.export'),
    defaultPath: `${data.name}-${data.version}`,
    filters: data.emitModrinth ? [modrinthFilter] : [zipFilter],
  })

  if (canceled) {
    return
  }
  if (filePath && data.gameVersion) {
    if (data.emitCurseforge || data.emitMcbbs || data.emitModrinth) {
      try {
        await exportModpack({
          instancePath: instance.value.path,
          name: data.name,
          files: exportFiles.value,
          author: data.author,
          version: data.version,
          gameVersion: data.gameVersion,
          destinationPath: filePath,
          emitCurseforge: data.emitCurseforge,
          emitMcbbs: data.emitMcbbs,
          emitModrinth: data.emitModrinth,
          strictModeInModrinth: data.emitModrinthStrict,
        })
        await editInstance({ instancePath: instance.value.path, modpackVersion: data.version })
      } catch (e) {
        console.error(e)
      }
    } else {
      const files = data.selected.filter(p => !!data.files.find(f => f.path === p))
      if (versionId.value) {
        await exportInstance({
          src: instance.value.path,
          version: versionId.value,
          destinationPath: filePath,
          includeLibraries: data.includeLibraries,
          includeAssets: data.includeAssets,
          files,
        })
      }
    }
    cancel()
  }
})

watch(isShown, (value) => {
  if (value) {
    reset()
    refresh()
  }
})
</script>
