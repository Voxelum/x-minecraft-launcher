<template>
  <v-dialog
    v-model="isShown"
    width="800"
    @input="$emit('input', $event)"
  >
    <v-card>
      <v-toolbar

        tabs
        color="green en"
      >
        <v-toolbar-title>
          {{ $t('profile.modpack.export') }}
        </v-toolbar-title>

        <v-spacer />
        <v-btn
          icon
          @click="$emit('input', false)"
        >
          <v-icon>arrow_drop_down</v-icon>
        </v-btn>
      </v-toolbar>
      <v-container
        grid-list-sm
        class="max-h-[70vh]"
        style="overflow: auto;"
      >
        <v-subheader>{{ $t('profile.modpack.general') }}</v-subheader>
        <v-container
          grid-list-md
          style="padding-top: 0px"
        >
          <v-layout row>
            <v-flex d-flex>
              <v-text-field
                v-model="name"

                persistent-hint
                :hint="$t('profile.nameHint')"
                :label="$t('name')"
                required
              />
            </v-flex>
            <v-flex d-flex>
              <v-text-field
                v-model="author"
                persistent-hint
                :hint="$t('profile.authorHint')"
                :label="$t('author')"
                required
              />
            </v-flex>
          </v-layout>
          <v-layout row>
            <v-flex d-flex>
              <v-text-field
                v-model="version"
                persistent-hint
                :hint="$t('profile.instanceVersion')"
                :label="$t('profile.instanceVersion')"
                required
              />
            </v-flex>
            <v-flex
              d-flex
              xs6
            >
              <v-select
                v-model="gameVersion"
                :items="localVersions"

                persistent-hint
                :hint="$tc('profile.modpack.includeVersion', 2)"
                :label="$t('profile.gameVersion')"
                required
              />
            </v-flex>
          </v-layout>
          <v-layout
            row
          >
            <v-flex d-flex>
              <v-checkbox
                v-model="emitCurseforge"
                :label="$t('profile.modpack.emitCurseforge')"
                hide-details
              />
            </v-flex>
            <v-flex
              d-flex
              xs6
            >
              <v-checkbox
                v-model="emitMcbbs"
                :label="$t('profile.modpack.emitMcbbs')"
                hide-details
              />
            </v-flex>
          </v-layout>
          <v-layout
            v-if="!(emitCurseforge || emitMcbbs)"
            row
          >
            <v-flex d-flex>
              <v-checkbox
                v-model="includeAssets"
                :label="$t('profile.modpack.includeAssets')"
                hint="abc"
                hide-details
              />
            </v-flex>
            <v-flex
              d-flex
              xs6
            >
              <v-checkbox
                v-model="includeLibraries"
                :label="$t('profile.modpack.includeLibraries')"
                hint="abc"
                hide-details
              />
            </v-flex>
          </v-layout>
        </v-container>

        <v-layout>
          <v-subheader v-if="emitCurseforge || emitMcbbs">
            {{ $t('profile.modpack.overrides') }}
          </v-subheader>
          <v-subheader v-else>
            {{ $t('profile.modpack.includes') }}
          </v-subheader>
        </v-layout>
        <v-layout
          row
          style="padding: 5px; margin-bottom: 5px"
        >
          <instance-files
            v-model="selected"
          />
        </v-layout>
        <v-layout row>
          <v-btn
            text
            large
            :disabled="exporting"
            @click="cancel"
          >
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <div class="flex items-center justify-center text-center text-gray-500 flex-shrink flex-grow-0 text-sm">
            ~{{ getExpectedSize(totalSize) }}
          </div>
          <v-btn
            text
            color="primary"
            large
            :loading="exporting"
            @click="confirm"
          >
            {{ $t('profile.modpack.export') }}
          </v-btn>
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { InjectionKey, Ref } from '@vue/composition-api'
import InstanceFiles from './AppExportDialogInstanceFiles.vue'
import { useI18n, useService } from '/@/composables'
import { ModpackServiceKey, InstanceFile, InstanceIOServiceKey } from '@xmcl/runtime-api'
import { basename } from '/@/util/basename'
import { getExpectedSize } from '/@/util/size'
import { inc } from 'semver'
import { useInstance, useInstanceVersion } from '../composables/instance'
import { DialogKey, useDialog, useZipFilter } from '../composables/dialog'
import { useLocalVersions } from '../composables/version'

export const AppExportDialogKey: DialogKey<string> = 'export'

export interface FileNode {
  name: string
  id: string
  size: number
  source: 'modrinth' | 'curseforge' | ''
  sources: string[]
  children?: FileNode[]
}

export const FileNodesSymbol: InjectionKey<Ref<FileNode[]>> = Symbol('FileNodes')

function provideFiles(files: Ref<InstanceFile[]>, enableCurseforge: Ref<boolean>, enableModrinth: Ref<boolean>) {
  function buildEdges(cwd: FileNode[], filePaths: string[], currentPath: string, file: FileNode) {
    const remained = filePaths.slice(1)
    if (remained.length > 0) { // edge
      const name = filePaths[0]
      let edgeNode = cwd.find(n => n.name === name)
      if (!edgeNode) {
        edgeNode = {
          name,
          id: currentPath,
          size: 0,
          source: '',
          sources: [],
          children: [],
        }
        cwd.push(edgeNode)
      }
      buildEdges(edgeNode.children!, remained, currentPath ? (currentPath + '/' + name) : name, file)
    } else { // leaf
      cwd.push(file)
    }
  }

  const leaves: Ref<FileNode[]> = ref([])
  const nodes: Ref<FileNode[]> = ref([])

  watch(files, (files) => {
    const leavesNode: FileNode[] = files.map((f) => reactive({
      name: basename(f.path),
      id: f.path,
      size: f.size,
      source: '',
      sources: computed(() => [...f.sources].filter(s => s === 'curseforge' ? enableCurseforge.value : s === 'modrinth' ? enableModrinth.value : true)),
      children: f.isDirectory ? [] : undefined,
    }))
    const result: FileNode[] = []
    for (const file of leavesNode) {
      buildEdges(result, file.id.split('/'), '', file)
    }
    leaves.value = leavesNode
    nodes.value = result
  })

  watch([enableCurseforge, enableModrinth], () => {
    for (const node of leaves.value) {
      if (!enableCurseforge.value && node.source === 'curseforge') {
        node.source = node.sources[0] as any
      } else if (!enableModrinth.value && node.source === 'modrinth') {
        node.source = node.sources[0] as any
      }
    }
  })

  provide(FileNodesSymbol, nodes)

  return { nodes, leaves }
}

export default defineComponent({
  components: { InstanceFiles },
  setup(props, context) {
    const { name, author, modpackVersion } = useInstance()
    const { getInstanceFiles, exportInstance } = useService(InstanceIOServiceKey)
    const { exportModpack } = useService(ModpackServiceKey)
    const { showSaveDialog } = windowController
    const { localVersions } = useLocalVersions()
    const { folder } = useInstanceVersion()
    const { $t } = useI18n()
    const zipFilter = useZipFilter()
    const baseVersion = modpackVersion.value || '0.0.0'
    const data = reactive({
      name: name.value,
      author: author.value,
      version: inc(baseVersion, 'patch') ?? '0.0.1',
      gameVersion: '',
      refreshing: false,
      exporting: false,
      selected: [] as string[],
      fileApi: '',
      files: [] as InstanceFile[],
      includeLibraries: false,
      includeAssets: false,
      emitCurseforge: false,
      emitMcbbs: false,
    })
    const enableCurseforge = computed(() => data.emitCurseforge || data.emitMcbbs)
    const enableModrinth = computed(() => false)
    const { nodes, leaves } = provideFiles(computed(() => data.files), enableCurseforge, enableModrinth)
    function reset() {
      data.includeAssets = false
      data.includeLibraries = false
      data.name = name.value
      data.author = author.value
      data.selected = []
      data.gameVersion = folder.value ?? ''
      data.version = inc(modpackVersion.value || '0.0.0', 'patch') ?? '0.0.1'
    }
    function refresh() {
      if (data.refreshing) return
      data.refreshing = true
      getInstanceFiles().then((files) => {
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
      }).finally(() => { data.refreshing = false })
    }
    function cancel() {
      context.emit('input', false)
    }
    const selectedPaths = computed(() => new Set(data.selected))

    const exportDirectives = computed(() => {
      const existed = selectedPaths.value
      return leaves.value
        .filter(n => existed.has(n.id))
        .filter(l => l.source)
        .map(l => ({ path: l.id, exportAs: l.source as 'curseforge' | 'modrinth' }))
    })
    const totalSize = computed(() => {
      const existed = selectedPaths.value
      const discount = new Set(exportDirectives.value.map(v => v.path))
      return leaves.value.filter(n => existed.has(n.id))
        .filter(n => !discount.has(n.id))
        .map(l => l.size)
        .reduce((a, b) => a + b, 0)
    })
    async function confirm() {
      const { filePath } = await showSaveDialog({
        title: $t('profile.modpack.export'),
        defaultPath: `${data.name}-${data.version}`,
        filters: [zipFilter],
      })
      if (filePath) {
        data.exporting = true
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
        data.exporting = false
      }

      context.emit('input', false)
    }
    const { isShown } = useDialog(AppExportDialogKey)
    watch(() => isShown, (value) => {
      if (value) {
        reset()
        refresh()
      }
    })
    return {
      isShown,
      localVersions: computed(() => localVersions.value.map((v) => v.id)),
      ...toRefs(data),
      totalSize,
      getExpectedSize,
      enableCurseforge,
      enableModrinth,
      cancel,
      confirm,
      refresh,
    }
  },
})
</script>
