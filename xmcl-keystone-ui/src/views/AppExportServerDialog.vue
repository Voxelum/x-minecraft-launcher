<script setup lang="ts">
import InstanceManifestFileTree from '@/components/InstanceManifestFileTree.vue'
import { useRefreshable, useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { AppExportServerDialogKey } from '@/composables/instanceExport'
import { provideFileNodes, useInstanceFileNodesFromLocal } from '@/composables/instanceFileNodeData'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { useInstanceVersionServerInstall } from '@/composables/instanceVersionServerInstall'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { useLocalStorage } from '@vueuse/core'
import { BaseServiceKey, InstanceFile, InstanceIOServiceKey, InstanceManifestServiceKey } from '@xmcl/runtime-api'

const { isShown, hide: cancel } = useDialog(AppExportServerDialogKey, () => {
  refresh()

  const existedConfig = cachedUserServers.value[path.value]
  exportToServer.value = !!existedConfig
  cachedUserServer.value = existedConfig || { host: '', remotePath: '', username: '', privateKeyPath: '' }
}, () => {
  data.files = []
  data.selected = []

  cachedUserServers.value = {
    ...cachedUserServers.value,
    [path.value]: cachedUserServer.value
  }
})
const { t } = useI18n()
const { path } = injection(kInstance)
const exportToServer = ref(false)

const data = reactive({
  uploadToServer: false,
  selected: [] as string[],
  files: [] as InstanceFile[]
})

type CachedUserServer = {
  host: string
  remotePath: string
  username: string
  privateKeyPath: string
}

const cachedUserServers = useLocalStorage('remoteSSHServers', () => ({}) as Record<string, CachedUserServer>)
const cachedUserServer = ref(cachedUserServers.value[path.value] || { host: '', remotePath: '', username: '', privateKeyPath: '' })

const password = ref('')

// loading
const { getInstanceServerManifest } = useService(InstanceManifestServiceKey)
const { refresh, refreshing } = useRefreshable(async () => {
  const files = await getInstanceServerManifest({ path: path.value })
  // const files = manifest.files
  let selected = [] as string[]
  selected = files
    .filter(file => !file.path.startsWith('logs') && !file.path.startsWith('libraries') && !file.path.startsWith('versions'))
    .filter(file => !file.path.endsWith('.disabled'))
    .map(file => file.path)
  nextTick().then(() => { data.selected = selected })
  data.files = markRaw(files)
})

const filterText = ref('')
const scrollElement = ref<HTMLElement | null>(null)
const { leaves } = provideFileNodes(useInstanceFileNodesFromLocal(computed(() => data.files.filter(f => f.path.toLowerCase().includes(filterText.value.toLowerCase())))))
const selectedPaths = computed(() => new Set(data.selected))

function selectFit() {
  const files = data.files
  let selected = [] as string[]
  selected = files
    .filter(file => !file.path.startsWith('logs') && !file.path.startsWith('libraries') && !file.path.startsWith('versions'))
    .filter(file => !file.path.endsWith('.disabled'))
    .map(file => file.path)
  nextTick().then(() => { data.selected = selected })
}

function selectAll() {
  const files = data.files
  const selected = files.map(file => file.path)
  data.selected = selected
}

function selectNone() {
  data.selected = []
}

const totalSize = computed(() => {
  const existed = selectedPaths.value
  return leaves.value.filter(n => existed.has(n.path))
    // .filter(n => !n.data || n.data.forceOverride || !canExport(n.data))
    .map(l => l.size)
    .reduce((a, b) => a + b, 0)
})

const { exportInstanceAsServer } = useService(InstanceIOServiceKey)
const { generateLaunchOptions } = injection(kInstanceLaunch)
const { showItemInDirectory } = useService(BaseServiceKey)

const { install } = useInstanceVersionServerInstall()

async function onSelectPrivateKey() {
  const { filePaths, canceled } = await windowController.showOpenDialog({
    title: t('server.exportSSHPrivateKeyPath'),
    properties: ['openFile'],
    filters: [{ name: t('server.exportSSHPrivateKeyPath'), extensions: ['pem', 'ppk'] }]
  })
  if (!canceled) {
    cachedUserServer.value.privateKeyPath = filePaths[0]
  }
}

// export
const { refresh: exportAsFile, refreshing: exporting } = useRefreshable(async () => {
  const selectedFiles = data.files.filter(f => data.selected.includes(f.path))
  await install()
  if (!exportToServer.value) {
    const defaultPath = `${basename(path.value)}-server`
    const { filePaths, canceled } = await windowController.showOpenDialog({
      title: t('server.export'),
      defaultPath,
      properties: ['openDirectory', 'createDirectory']
    })
    
    if (canceled) {
      return
    }
    
    if (filePaths[0]) {
      exportInstanceAsServer({
        output: { type: 'folder', path: filePaths[0] }, 
        options: await generateLaunchOptions(path.value, '', 'server'),
        files: selectedFiles,
      })
      
      showItemInDirectory(filePaths[0])
    }
  } else {
    exportInstanceAsServer({
      output: {
        type: 'ssh',
        host: cachedUserServer.value.host,
        port: 22,
        path: cachedUserServer.value.remotePath,
        username: cachedUserServer.value.username,
        credentials: cachedUserServer.value.privateKeyPath ? {
          privateKey: cachedUserServer.value.privateKeyPath,
          passphrase: password.value,
        } : {
          password: password.value
        },
      }, 
      options: await generateLaunchOptions(path.value, '', 'server'),
      files: selectedFiles,
    })
  }
  cancel()
})

</script>
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
          {{ t('server.export') }}
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

      <div class="px-6 py-2">
        <v-subheader>{{ t('server.exportOption') }}</v-subheader>
        <div
          class="grid grid-cols-2 gap-4 gap-y-2 z-12"
        >
          <v-checkbox
            :value="!exportToServer"
            :input-value="!exportToServer"
            :label="t('server.exportToFolder')"
            @change="exportToServer = !$event"
          ></v-checkbox>
          <v-checkbox
            :value="exportToServer"
            :input-value="exportToServer"
            :label="t('server.upload')"
            @change="exportToServer = $event"
          ></v-checkbox>
        </div>
        <v-subheader
          v-if="exportToServer"
        >
          {{ t('server.exportSSHOptions') }}
        </v-subheader>
        <div
          v-if="exportToServer"
          class="grid grid-cols-3 gap-4 gap-y-2 z-12"
        >
          <v-text-field
            v-model="cachedUserServer.host"
            class="col-span-1"
            prepend-inner-icon="dns"
            persistent-hint
            :label="t('proxy.host')"
            required
          />
          <v-text-field
            v-model="cachedUserServer.username"
            prepend-inner-icon="person"
            persistent-hint
            :label="t('user.name')"
            required
          />
          <v-text-field
            v-model="cachedUserServer.remotePath"
            class="col-span-1"
            prepend-inner-icon="folder"
            persistent-hint
            :label="t('server.exportSSHRemotePath')"
            required
          />
          <v-text-field
            v-model="password"
            prepend-inner-icon="lock"
            type="password"
            persistent-hint
            :label="!cachedUserServer.privateKeyPath ? t('userServices.mojang.password') : 'Passphrase'"
          />
          <v-text-field
            v-model="cachedUserServer.privateKeyPath"
            class="col-span-2"
            prepend-inner-icon="fingerprint"
            persistent-hint
            readonly
            :label="t('server.exportSSHPrivateKeyPath')"
            @click="onSelectPrivateKey"
          />
        </div>
      </div>
      <div class="px-6">
        <v-subheader>
          {{ t('modpack.includes') }}
          <v-spacer />
          <v-btn
            v-shared-tooltip="_ => t('env.select.all')"
            text
            icon
            @click="selectAll"
          >
            <v-icon>
              select_all
            </v-icon>
          </v-btn>
          <v-btn
            v-shared-tooltip="_ => t('env.select.fit')"
            text
            icon
            @click="selectFit"
          >
            <v-icon>
              tab_unselected
            </v-icon>
          </v-btn>

          <v-btn
            v-shared-tooltip="_ => t('env.select.none')"
            text
            icon
            @click="selectNone"
          >
            <v-icon>
              deselect
            </v-icon>
          </v-btn>
        </v-subheader>
      </div>
      <div
        ref="scrollElement"
        class="visible-scroll mx-0 max-h-[100vh] items-center justify-center overflow-y-auto overflow-x-hidden px-6 py-2"
      >
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
            :scroll-element="scrollElement"
            :multiple="false"
          />
        </div>
      </div>

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
          @click="exportAsFile"
        >
          {{ t('server.export') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<style scoped>

</style>