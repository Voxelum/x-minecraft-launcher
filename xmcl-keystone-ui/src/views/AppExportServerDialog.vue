<script setup lang="ts">
import InstanceManifestFileTree from '@/components/InstanceManifestFileTree.vue'
import { useRefreshable, useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { useLocaleError } from '@/composables/error'
import { kInstance } from '@/composables/instance'
import { AppExportServerDialogKey } from '@/composables/instanceExport'
import { provideFileNodes, useInstanceFileNodesFromLocal } from '@/composables/instanceFileNodeData'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { useInstanceVersionServerInstall } from '@/composables/instanceVersionServerInstall'
import { kUserContext } from '@/composables/user'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { useLocalStorage } from '@vueuse/core'
import { InstanceFile } from '@xmcl/instance'
import { BaseServiceKey, InstanceIOServiceKey, InstanceManifestServiceKey } from '@xmcl/runtime-api'

const { isShown, hide: cancel } = useDialog(AppExportServerDialogKey, () => {
  refresh()

  const existedConfig = cachedUserServers.value[path.value]
  exportToServer.value = !!existedConfig && !!(existedConfig.host || existedConfig.remotePath || existedConfig.username || existedConfig.privateKeyPath)
  cachedUserServer.value = existedConfig || { host: '', remotePath: '', username: '', privateKeyPath: '' }
}, () => {
  data.files = []
  data.selected = []
  authenticateError.value = undefined

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

const noFiles = computed(() => data.files.length === 0)
const { serverVersionId } = injection(kInstanceVersion)
const noVersion = computed(() => !serverVersionId.value)

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
const { leaves } = provideFileNodes(useInstanceFileNodesFromLocal(computed(() => data.files.filter(f => f.path.toLowerCase().includes((filterText.value || '').toLowerCase())))))
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
const { userProfile } = injection(kUserContext)

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
  authenticateError.value = undefined
  const selectedFiles = data.files.filter(f => data.selected.includes(f.path))
  const id = await install()
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
      await exportInstanceAsServer({
        output: { type: 'folder', path: filePaths[0] },
        options: await generateLaunchOptions(path.value, userProfile.value, '', 'server', { version: id }, true),
        files: selectedFiles,
      })
        .then(() => {
          showItemInDirectory(filePaths[0])
          cancel()
        })
        .catch(handleTheExportServerError)
    }
  } else {
    await exportInstanceAsServer({
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
      options: await generateLaunchOptions(path.value, userProfile.value, '', 'server', { version: id }, true),
      files: selectedFiles,
    })
      .then(() => {
        cancel()
      })
      .catch(handleTheExportServerError)
  }
})

const tError = useLocaleError()

function handleTheExportServerError(e: any) {
  if (e.message === 'All configured authentication methods failed' && e.level === 'client-authentication') {
    authenticateError.value = t('server.exportSSHAuthenticationFailed')
  } else {
    authenticateError.value = tError(e)
  }
}

type Rule = (v: string) => boolean | string

const hostNameRules = computed(() => [
  v => !!v || t('server.hostRequired'),
] as Rule[])

const usernameRules = computed(() => [
  v => !!v || t('loginError.requireUsername'),
] as Rule[])

const authenticateError = ref(undefined as string | undefined)

const hasError = computed(() => {
  if (!exportToServer.value) {
    return false
  }
  const hasHostNameError = hostNameRules.value.some(rule => rule(cachedUserServer.value.host) !== true)
  const hasUserNameError = usernameRules.value.some(rule => rule(cachedUserServer.value.username) !== true)
  if (hasHostNameError) {
    return true
  }
  if (hasUserNameError) {
    return true
  }
  return false
})

</script>
<template>
  <v-dialog
    v-model="isShown"
    width="800"
    :persistent="false"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div class="flex w-full max-h-[85vh] flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center px-6 pt-6 pb-4">
        <div class="flex items-center gap-3 flex-grow">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style="background-color: rgba(var(--v-theme-primary), 0.12)"
          >
            <v-icon size="22" color="primary">ios_share</v-icon>
          </div>
          <div class="text-base font-bold tracking-tight" style="color: rgba(var(--v-theme-on-surface), 0.9);">
            {{ t('server.export') }}
          </div>
        </div>
        <v-btn
          icon="close"
          variant="text"
          size="small"
          @click="cancel"
        />
      </div>

      <v-divider class="mx-6 opacity-20" />

      <!-- Content -->
      <div
        ref="scrollElement"
        class="flex-1 min-h-0 overflow-y-auto invisible-scroll px-6 pb-6 pt-4 flex flex-col gap-5"
      >
        <!-- Export Option -->
        <div class="surface-panel p-4">
          <div class="mb-3 flex items-center gap-2">
            <v-icon size="18" color="green">cloud_upload</v-icon>
            <span class="text-sm font-semibold opacity-80">{{ t('server.exportOption') }}</span>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <v-checkbox
              :model-value="!exportToServer"
              :label="t('server.exportToFolder')"
              hide-details
              @update:model-value="exportToServer = !$event"
            />
            <v-checkbox
              :model-value="exportToServer"
              :label="t('server.upload')"
              hide-details
              @update:model-value="exportToServer = !!$event"
            />
          </div>
        </div>

        <!-- SSH Options -->
        <div
          v-if="exportToServer"
          class="surface-panel p-4"
        >
          <div class="mb-3 flex items-center gap-2">
            <v-icon size="18" color="green">terminal</v-icon>
            <span class="text-sm font-semibold opacity-80">{{ t('server.exportSSHOptions') }}</span>
          </div>
          <div class="grid grid-cols-3 gap-4 gap-y-2">
            <v-text-field
              v-model="cachedUserServer.host"
              class="col-span-1"
              prepend-inner-icon="dns"
              persistent-hint
              :rules="hostNameRules"
              :label="t('proxy.host')"
              required
            />
            <v-text-field
              v-model="cachedUserServer.username"
              prepend-inner-icon="person"
              persistent-hint
              :label="t('user.name')"
              :rules="usernameRules"
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
              :error-messages="authenticateError"
              :label="!cachedUserServer.privateKeyPath ? t('userServices.mojang.password') : 'Passphrase'"
            />
            <v-text-field
              v-model="cachedUserServer.privateKeyPath"
              class="col-span-2"
              prepend-inner-icon="fingerprint"
              persistent-hint
              readonly
              :error-messages="authenticateError"
              :label="t('server.exportSSHPrivateKeyPath')"
              @click="onSelectPrivateKey"
            />
          </div>
        </div>

        <!-- File Selection -->
        <div class="surface-panel p-4">
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <v-icon size="18" color="green">folder_open</v-icon>
              <span class="text-sm font-semibold opacity-80">{{ t('modpack.includes') }}</span>
            </div>
            <div class="flex items-center gap-1">
              <v-btn
                v-shared-tooltip="() => t('env.select.all')"
                variant="text"
                icon
                size="small"
                @click="selectAll"
              >
                <v-icon size="18">select_all</v-icon>
              </v-btn>
              <v-btn
                v-shared-tooltip="() => t('env.select.fit')"
                variant="text"
                icon
                size="small"
                @click="selectFit"
              >
                <v-icon size="18">tab_unselected</v-icon>
              </v-btn>
              <v-btn
                v-shared-tooltip="() => t('env.select.none')"
                variant="text"
                icon
                size="small"
                @click="selectNone"
              >
                <v-icon size="18">deselect</v-icon>
              </v-btn>
            </div>
          </div>
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

        <v-alert
          v-if="noFiles"
          type="info"
          variant="tonal"
          rounded="lg"
        >
          {{ t('server.exportNoFilesHint') }}
        </v-alert>
      </div>

      <v-divider class="mx-6 opacity-20" />

      <!-- Footer -->
      <div class="flex items-center px-6 py-4 gap-4">
        <v-btn
          :disabled="exporting || refreshing"
          variant="text"
          rounded="pill"
          @click="cancel"
        >
          {{ t('shared.cancel') }}
        </v-btn>
        <v-spacer />
        <span class="text-sm opacity-50">
          ~{{ getExpectedSize(totalSize) }}
        </span>
        <v-btn
          :disabled="hasError"
          color="green"
          variant="flat"
          rounded="pill"
          :loading="exporting || refreshing"
          @click="exportAsFile"
        >
          <v-icon start size="16">ios_share</v-icon>
          {{ t('server.export') }}
        </v-btn>
      </div>
    </div>
  </v-dialog>
</template>
<style scoped>

</style>
