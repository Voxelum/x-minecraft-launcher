<template>
  <v-dialog
    v-model="isShown"
    width="800"
  >
    <v-card>
      <v-toolbar

        tabs
        color="green en"
      >
        <v-toolbar-title>
          {{ t('modpack.export') }}
        </v-toolbar-title>

        <v-spacer />
        <v-btn
          icon
          @click="cancel"
        >
          <v-icon>arrow_drop_down</v-icon>
        </v-btn>
      </v-toolbar>
      <v-container
        grid-list-sm
        class="max-h-[70vh]"
        style="overflow: auto;"
      >
        <v-subheader>{{ t('modpack.general') }}</v-subheader>
        <v-container
          grid-list-md
          style="padding-top: 0px"
        >
          <v-layout row>
            <v-flex d-flex>
              <v-text-field
                v-model="name"

                persistent-hint
                :hint="t('instance.nameHint')"
                :label="t('name')"
                required
              />
            </v-flex>
            <v-flex d-flex>
              <v-text-field
                v-model="author"
                persistent-hint
                :hint="t('modpack.authorHint')"
                :label="t('author')"
                required
              />
            </v-flex>
          </v-layout>
          <v-layout row>
            <v-flex d-flex>
              <v-text-field
                v-model="data.version"
                persistent-hint
                :hint="t('modpack.modpackVersion')"
                :label="t('modpack.modpackVersion')"
                required
              />
            </v-flex>
            <v-flex
              d-flex
              xs6
            >
              <v-select
                v-model="data.gameVersion"
                :items="localVersions"

                persistent-hint
                :hint="$tc('instance.includeVersion', 2)"
                :label="t('instance.gameVersion')"
                required
              />
            </v-flex>
          </v-layout>
          <v-layout
            row
          >
            <v-flex d-flex>
              <v-checkbox
                v-model="data.emitCurseforge"
                :label="t('modpack.emitCurseforge')"
                hide-details
              />
            </v-flex>
            <v-flex
              d-flex
              xs6
            >
              <v-checkbox
                v-model="data.emitMcbbs"
                :label="t('modpack.emitMcbbs')"
                hide-details
              />
            </v-flex>
          </v-layout>
          <v-layout
            v-if="!(data.emitCurseforge || data.emitMcbbs)"
            row
          >
            <v-flex d-flex>
              <v-checkbox
                v-model="data.includeAssets"
                :label="t('modpack.includeAssets')"
                hint="abc"
                hide-details
              />
            </v-flex>
            <v-flex
              d-flex
              xs6
            >
              <v-checkbox
                v-model="data.includeLibraries"
                :label="t('modpack.includeLibraries')"
                hint="abc"
                hide-details
              />
            </v-flex>
          </v-layout>
        </v-container>

        <v-layout>
          <v-subheader v-if="data.emitCurseforge || data.emitMcbbs">
            {{ t('modpack.overrides') }}
          </v-subheader>
          <v-subheader v-else>
            {{ t('modpack.includes') }}
          </v-subheader>
        </v-layout>
        <v-layout
          row
          style="padding: 5px; margin-bottom: 5px"
        >
          <instance-manifest-file-tree
            v-model="data.selected"
            selectable
            :multiple="false"
          />
        </v-layout>
      </v-container>
      <v-card-actions class="gap-5 items-baseline">
        <v-btn
          text
          large
          :disabled="exporting || refreshing"
          @click="cancel"
        >
          {{ t('cancel') }}
        </v-btn>
        <v-spacer />
        <div class="flex items-center justify-center text-center text-gray-500 flex-shrink flex-grow-0 text-sm">
          ~{{ getExpectedSize(totalSize) }}
        </div>
        <!-- <v-btn
          text
          color="primary"
          large
          :loading="exporting || refreshing"
          @click="confirm"
        >
          {{ t('modpack.export') }}
        </v-btn> -->
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
import { InstanceIOServiceKey, LocalInstanceFile, ModpackServiceKey } from '@xmcl/runtime-api'
import { inc } from 'semver'
import { useDialog, useZipFilter } from '../composables/dialog'
import { useInstance, useInstanceVersion } from '../composables/instance'
import { AppExportDialogKey } from '../composables/instanceExport'
import { provideFileNodes, useInstanceFileNodesFromLocal } from '../composables/instanceFiles'
import { useLocalVersions } from '../composables/version'
import { useI18n, useRefreshable, useService } from '/@/composables'
import { getExpectedSize } from '/@/util/size'
import InstanceManifestFileTree from '../components/InstanceManifestFileTree.vue'

const { isShown, hide: cancel } = useDialog(AppExportDialogKey)
const { getInstanceManifest, exportInstance } = useService(InstanceIOServiceKey)
const { exportModpack } = useService(ModpackServiceKey)
const { showSaveDialog } = windowController
const { t } = useI18n()

// base data
const { folder } = useInstanceVersion()
const { localVersions: _locals } = useLocalVersions()
const { name, author, modpackVersion } = useInstance()
const zipFilter = useZipFilter()
const baseVersion = modpackVersion.value || '0.0.0'
const localVersions = computed(() => _locals.value.map((v) => v.id))

const data = reactive({
  name: name.value,
  author: author.value,
  version: inc(baseVersion, 'patch') ?? '0.0.1',
  gameVersion: folder.value,
  selected: [] as string[],
  fileApi: '',
  files: [] as LocalInstanceFile[],
  includeLibraries: false,
  includeAssets: false,
  emitCurseforge: false,
  emitMcbbs: false,
})

const enableCurseforge = computed(() => data.emitCurseforge || data.emitMcbbs)
const enableModrinth = computed(() => false)
const { leaves } = provideFileNodes(useInstanceFileNodesFromLocal(computed(() => data.files), reactive({
  curseforge: enableCurseforge,
  modrinth: enableModrinth,
  downloads: false,
})))
watch([enableCurseforge, enableModrinth], () => {
  for (const node of leaves.value) {
    if (!enableCurseforge.value && node.choice === 'curseforge') {
      node.choice = node.choices[0].value
    } else if (!enableModrinth.value && node.choice === 'modrinth') {
      node.choice = node.choices[0].value
    }
  }
})

function reset() {
  data.includeAssets = false
  data.includeLibraries = false
  data.name = name.value
  data.author = author.value
  data.files = []
  data.selected = []
  data.gameVersion = folder.value ?? ''
  data.version = inc(modpackVersion.value || '0.0.0', 'patch') ?? '0.0.1'
}

// loading
const { refresh, refreshing } = useRefreshable(async () => {
  const manifest = await getInstanceManifest()
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

const exportDirectives = computed(() => {
  const existed = selectedPaths.value
  return leaves.value
    .filter(n => existed.has(n.id))
    .filter(l => l.choice)
    .map(l => ({ path: l.id, exportAs: l.choice as 'curseforge' | 'modrinth' }))
})

const totalSize = computed(() => {
  const existed = selectedPaths.value
  const discount = new Set(exportDirectives.value.map(v => v.path))
  return leaves.value.filter(n => existed.has(n.id))
    .filter(n => !discount.has(n.id))
    .map(l => l.size)
    .reduce((a, b) => a + b, 0)
})

// export
const { refresh: confirm, refreshing: exporting } = useRefreshable(async () => {
  const { filePath } = await showSaveDialog({
    title: t('modpack.export'),
    defaultPath: `${data.name}-${data.version}`,
    filters: [zipFilter],
  })
  if (filePath) {
    if (data.emitCurseforge || data.emitMcbbs) {
      try {
        const overrides = data.selected.filter(p => !!data.files.find(f => f.path === p && !f.isDirectory))
        const directives = exportDirectives.value
        await exportModpack({
          overrides,
          name: data.name,
          exportDirectives: directives,
          author: data.author,
          version: data.version,
          gameVersion: data.gameVersion,
          destinationPath: filePath,
          emitCurseforge: data.emitCurseforge,
          emitMcbbs: data.emitMcbbs,
        })
      } catch (e) {
        console.error(e)
      }
    } else {
      const files = data.selected.filter(p => !!data.files.find(f => f.path === p && !f.isDirectory))
      await exportInstance({
        destinationPath: filePath,
        includeLibraries: data.includeLibraries,
        includeAssets: data.includeAssets,
        files,
      })
    }
  }
  cancel()
})

watch(isShown, (value) => {
  if (value) {
    reset()
    refresh()
  }
})
</script>
