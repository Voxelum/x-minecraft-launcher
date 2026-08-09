<template>
  <div
    class="border-t border-[rgba(var(--v-theme-on-surface),0.1)] px-4 py-4"
    data-testid="base-setting-server-remote"
  >
    <div class="flex flex-col gap-5">
      <div
        class="remote-reconcile flex items-center gap-3 px-4 py-3"
        data-testid="remote-server-reconcile"
      >
        <v-progress-circular
          v-if="launchingRemote && reconcilePhase !== 'error'"
          indeterminate
          size="22"
          width="2"
          color="primary"
        />
        <v-icon v-else :color="reconcilePhase === 'error' ? 'error' : status?.serviceActive ? 'success' : undefined">
          {{ reconcilePhase === 'error' ? 'error' : status?.serviceActive ? 'check_circle' : 'cloud_queue' }}
        </v-icon>
        <div class="min-w-0 flex-grow">
          <div class="text-sm font-medium">{{ t(`server.remotePhase.${reconcilePhase}`) }}</div>
          <div class="truncate text-xs opacity-60">
            {{ reconcileDetail || (configured ? `${profile?.username}@${profile?.host}:${profile?.remotePath}` : t('server.remoteNotConfiguredHint')) }}
          </div>
        </div>
        <v-chip v-if="status?.platform" size="x-small" variant="tonal">{{ status.platform }}</v-chip>
        <v-chip size="x-small" variant="tonal" :color="status?.serviceActive ? 'success' : undefined">
          {{ status?.serviceActive ? t('baseSetting.info.running') : t('baseSetting.info.stopped') }}
        </v-chip>
      </div>

      <v-expansion-panels variant="accordion" class="remote-advanced">
      <!-- Connection profile -->
      <v-expansion-panel data-testid="remote-server-connection-advanced">
        <v-expansion-panel-title>
          <div class="flex items-center gap-2">
            <v-icon size="18" color="blue">dns</v-icon>
            <span class="text-sm font-semibold opacity-80">{{ t('server.remoteConnection') }}</span>
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
        <div class="grid grid-cols-3 gap-4 gap-y-2">
          <v-text-field
            v-model="form.name"
            class="col-span-3"
            prepend-inner-icon="label"
            :label="t('server.remoteTargetName')"
          />
          <v-text-field
            v-model="form.host"
            class="col-span-2"
            prepend-inner-icon="dns"
            persistent-hint
            :label="t('proxy.host')"
          />
          <v-text-field
            v-model.number="form.port"
            type="number"
            prepend-inner-icon="numbers"
            persistent-hint
            :label="t('server.port')"
          />
          <v-text-field
            v-model="form.username"
            prepend-inner-icon="person"
            persistent-hint
            :label="t('user.name')"
          />
          <v-text-field
            v-model="form.remotePath"
            class="col-span-2"
            prepend-inner-icon="folder"
            persistent-hint
            :label="t('server.exportSSHRemotePath')"
          />
          <v-select
            v-model="form.authMethod"
            :items="authMethodItems"
            prepend-inner-icon="key"
            persistent-hint
            :label="t('server.remoteAuthMethod')"
          />
          <v-text-field
            v-if="form.authMethod === 'privateKey'"
            v-model="form.privateKeyPath"
            class="col-span-2"
            prepend-inner-icon="fingerprint"
            readonly
            persistent-hint
            :label="t('server.exportSSHPrivateKeyPath')"
            @click="onSelectPrivateKey"
          />
          <v-text-field
            v-model="secret"
            class="col-span-2"
            type="password"
            prepend-inner-icon="lock"
            persistent-hint
            :hint="hasSavedCredentials ? t('server.remoteSavedCredentialsHint') : undefined"
            :label="form.authMethod === 'password' ? t('userServices.mojang.password') : 'Passphrase'"
          />
          <v-checkbox
            v-model="remember"
            :label="t('server.remoteRememberCredentials')"
            hide-details
          />
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <v-btn
            color="blue"
            variant="flat"
            size="small"
            rounded="pill"
            :loading="saving"
            data-testid="remote-server-save"
            @click="onSave"
          >
            {{ t('shared.save') }}
          </v-btn>
          <v-btn
            variant="tonal"
            size="small"
            :disabled="!configured"
            :loading="testing"
            data-testid="remote-server-test"
            @click="onTestConnection"
          >
            {{ t('server.remoteTestConnection') }}
          </v-btn>
          <v-btn
            v-if="hasSavedCredentials"
            variant="text"
            size="small"
            @click="onForgetCredentials"
          >
            {{ t('server.remoteForgetCredentials') }}
          </v-btn>
          <span
            v-if="testResult"
            class="text-xs"
            :class="testResult.ok ? 'text-green-500' : 'text-red-500'"
          >
            {{ testResult.ok ? t('server.remoteTestConnectionSuccess') : testResult.message }}
          </span>
        </div>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel data-testid="remote-server-deployment-advanced">
        <v-expansion-panel-title>
          <div class="flex items-center gap-2">
            <v-icon size="18" color="blue">cloud_upload</v-icon>
            <span class="text-sm font-semibold opacity-80">{{ t('server.remoteDeployment') }}</span>
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
        <div class="deployment-categories mb-4">
          <div v-for="category in deploymentCategories" :key="category.key" class="deployment-category">
            <div class="min-w-0 flex-grow">
              <div class="text-sm font-medium">{{ category.title }}</div>
              <div class="text-xs opacity-60">{{ category.summary }}</div>
            </div>
            <v-btn
              v-if="category.selectable"
              icon="folder_open"
              size="small"
              variant="text"
              :title="t('server.remoteSelectFiles')"
              @click="openFileSelector(category.key as 'config' | 'extra')"
            />
            <v-select
              v-model="category.policy.value"
              :items="deploymentPolicyItems"
              density="compact"
              hide-details
              class="policy-select"
            />
          </div>
        </div>
        <div v-if="deploymentPreview" class="mb-4 flex flex-wrap gap-2" data-testid="remote-server-deployment-preview">
          <v-chip size="small" color="success" variant="tonal">+{{ deploymentPreview.add }}</v-chip>
          <v-chip size="small" color="info" variant="tonal">~{{ deploymentPreview.update }}</v-chip>
          <v-chip size="small" color="error" variant="tonal">-{{ deploymentPreview.delete }}</v-chip>
          <v-chip size="small" variant="tonal">={{ deploymentPreview.skip }}</v-chip>
          <span class="self-center text-xs opacity-60">{{ formatBytes(deploymentPreview.uploadBytes) }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <v-btn
            color="blue"
            variant="flat"
            prepend-icon="cloud_upload"
            :disabled="!configured"
            :loading="deployingServer"
            data-testid="remote-server-deploy"
            @click="onDeployServer"
          >
            {{ t('server.remoteDeploy') }}
          </v-btn>
          <v-btn
            variant="tonal"
            prepend-icon="difference"
            :disabled="!configured"
            :loading="previewingDeployment"
            @click="onPreviewDeployment"
          >
            {{ t('server.remotePreview') }}
          </v-btn>
          <v-btn
            variant="tonal"
            prepend-icon="inventory_2"
            :disabled="offlineServerFiles.length === 0"
            :loading="buildingOfflinePackage"
            @click="onBuildOfflinePackage"
          >
            {{ t('server.remoteBuildOfflinePackage') }}
          </v-btn>
        </div>
        <v-alert v-if="deploymentError" type="error" variant="tonal" density="compact" class="mt-3">
          {{ deploymentError }}
        </v-alert>
        </v-expansion-panel-text>
      </v-expansion-panel>

      </v-expansion-panels>

      <!-- Live status -->
      <div class="surface-panel p-4">
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <v-icon size="18" color="blue">monitor_heart</v-icon>
            <span class="text-sm font-semibold opacity-80">{{ t('server.remoteStatus') }}</span>
          </div>
          <v-btn
            icon
            size="small"
            variant="text"
            :loading="statusLoading"
            :disabled="!configured"
            @click="refreshStatus"
          >
            <v-icon size="18">refresh</v-icon>
          </v-btn>
        </div>
        <div v-if="!configured" class="text-sm opacity-60">
          {{ t('server.remoteNotConfiguredHint') }}
        </div>
        <div v-else-if="status" class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div>
            {{ t('server.remoteConnected') }}:
            <span :class="status.connected ? 'text-green-500' : 'text-red-500'">
              {{ status.connected ? '✓' : '✗' }}
            </span>
          </div>
          <div>
            {{ t('server.remoteServiceActive') }}:
            <span :class="status.serviceActive ? 'text-green-500' : 'opacity-60'">
              {{ status.serviceActive ? '✓' : '✗' }}
            </span>
          </div>
          <div>
            {{ t('server.remoteServerInstalled') }}:
            <span :class="status.serverInstalled ? 'text-green-500' : 'opacity-60'">
              {{ status.serverInstalled ? '✓' : '✗' }}
            </span>
          </div>
          <div>
            Java:
            <span :class="status.javaAvailable ? 'text-green-500' : 'text-red-500'">{{ status.javaAvailable ? '✓' : '✗' }}</span>
          </div>
          <div>
            systemd:
            <span :class="status.systemdAvailable ? 'text-green-500' : 'text-red-500'">{{ status.systemdAvailable ? '✓' : '✗' }}</span>
          </div>
          <div>
            {{ t('server.remotePathWritable') }}:
            <span :class="status.remotePathWritable ? 'text-green-500' : 'text-red-500'">{{ status.remotePathWritable ? '✓' : '✗' }}</span>
          </div>
          <div>
            {{ t('server.remoteWorldPresent') }}:
            <span :class="status.worldPresent ? 'text-green-500' : 'opacity-60'">{{ status.worldPresent ? '✓' : '✗' }}</span>
          </div>
          <div v-if="status.error" class="col-span-2 text-red-500">{{ status.error }}</div>
          <div v-if="status.pid">PID: {{ status.pid }}</div>
          <div v-if="status.loadAverage">
            {{ t('server.remoteLoad') }}: {{ status.loadAverage.map(v => v.toFixed(2)).join(' / ') }}
          </div>
          <div v-if="status.memoryTotalMB !== undefined">
            {{ t('server.remoteMemory') }}: {{ status.memoryUsedMB }} / {{ status.memoryTotalMB }} MB
          </div>
          <div v-if="status.diskTotalMB !== undefined">
            {{ t('server.remoteDisk') }}: {{ status.diskUsedMB }} / {{ status.diskTotalMB }} MB
          </div>
        </div>
      </div>

    </div>
    <v-dialog v-model="showFileSelector" max-width="760">
      <v-card>
        <v-card-title>{{ fileSelector === 'config' ? t('server.remoteConfigFiles') : t('server.remoteExtraFiles') }}</v-card-title>
        <v-card-text>
          <ServerDeploymentFileSelector
            v-if="fileSelector === 'config'"
            v-model="configSelection"
            :files="configCategoryFiles"
          />
          <ServerDeploymentFileSelector
            v-else
            v-model="extraSelection"
            :files="extraCategoryFiles"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showFileSelector = false">{{ t('shared.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>

</template>
<script setup lang="ts">
import ServerDeploymentFileSelector from '@/components/ServerDeploymentFileSelector.vue'
import { useRefreshable, useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceServerLaunch } from '@/composables/instanceServerLaunch'
import { useInstanceModpackMetadata } from '@/composables/instanceModpackMetadata'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kRemoteServer } from '@/composables/remoteServer'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'
import { getErrorMessage } from '@/util/error'
import { InstanceServerConfigSchema, type InstanceFile, type RemoteServerConnection, type ServerDeploymentPolicy } from '@xmcl/instance'
import { InstanceManifestServiceKey, InstanceServiceKey, ModpackServiceKey, type ExportFileDirective, type ServerDeploymentCategory, type ServerDeploymentFile, type ServerDeploymentPlan, type ServerDeploymentPreview } from '@xmcl/runtime-api'

const { t } = useI18n()
const { path, instance } = injection(kInstance)
const { versionId } = injection(kInstanceVersion)
const { generateLaunchOptions } = injection(kInstanceLaunch)
const { userProfile } = injection(kUserContext)
const { modpackMetadata } = inject('modpackMetadata', useInstanceModpackMetadata, true)
const { getInstanceManifest, getInstanceServerManifest } = useService(InstanceManifestServiceKey)
const { editInstance } = useService(InstanceServiceKey)
const { exportModpack } = useService(ModpackServiceKey)
const serverLaunch = injection(kInstanceServerLaunch)

const remote = injection(kRemoteServer)
const {
  profile,
  configured,
  status,
  statusLoading,
  refreshStatus,
  hasSavedCredentials,
  watchingLog,
  logLines,
  uploadServer,
  previewServerDeployment,
} = remote

const authMethodItems = [
  { title: t('server.remoteAuthPassword'), value: 'password' },
  { title: t('server.remoteAuthPrivateKey'), value: 'privateKey' },
]
const deploymentPolicyItems = computed(() => [
  { title: t('server.remotePolicyMirror'), value: 'mirror' },
  { title: t('server.remotePolicyOverlay'), value: 'overlay' },
  { title: t('server.remotePolicyInitialize'), value: 'initialize' },
  { title: t('server.remotePolicyPreserve'), value: 'preserve' },
])

const form = reactive({
  name: '',
  host: '',
  port: 22,
  username: '',
  remotePath: '',
  authMethod: 'password' as 'password' | 'privateKey',
  privateKeyPath: '',
})

function syncFormFromProfile() {
  const p = profile.value
  form.name = p?.name ?? t('server.targetRemote')
  form.host = p?.host ?? ''
  form.port = p?.port ?? 22
  form.username = p?.username ?? ''
  form.remotePath = p?.remotePath ?? ''
  form.authMethod = p?.authMethod ?? 'password'
  form.privateKeyPath = p?.privateKeyPath ?? ''
  syncDeploymentFromInstance()
}

onMounted(syncFormFromProfile)
watch(path, syncFormFromProfile)

const clientFiles = shallowRef<InstanceFile[]>([])
const serverFiles = shallowRef<InstanceFile[]>([])
const configPolicy = ref<ServerDeploymentPolicy>('mirror')
const modsPolicy = ref<ServerDeploymentPolicy>('mirror')
const worldPolicy = ref<ServerDeploymentPolicy>('initialize')
const extraPolicy = ref<ServerDeploymentPolicy>('overlay')
const configSelection = ref<string[]>([])
const extraSelection = ref<string[]>([])
const configSelectionInitialized = ref(false)
const fileSelector = ref<'config' | 'extra'>('config')
const showFileSelector = computed({
  get: () => !!fileSelector.value && fileSelectorOpen.value,
  set: value => { fileSelectorOpen.value = value },
})
const fileSelectorOpen = ref(false)

function syncDeploymentFromInstance() {
  const deployment = InstanceServerConfigSchema.parse(instance.value.serverConfig ?? {}).deployment
  configPolicy.value = deployment.config.policy
  modsPolicy.value = deployment.mods.policy
  worldPolicy.value = deployment.world.policy
  extraPolicy.value = deployment.extra.policy
  configSelectionInitialized.value = deployment.config.files !== undefined
  configSelection.value = deployment.config.files ?? []
  extraSelection.value = deployment.extra.files ?? []
}

async function refreshDeploymentFiles() {
  const [clientManifest, serverManifest] = await Promise.all([
    getInstanceManifest({ path: path.value }),
    getInstanceServerManifest({ path: path.value }),
  ])
  clientFiles.value = clientManifest.files
  serverFiles.value = serverManifest
  if (!configSelectionInitialized.value) {
    configSelection.value = configCategoryFiles.value.map(file => file.path)
    configSelectionInitialized.value = true
  }
}
onMounted(refreshDeploymentFiles)
watch(path, refreshDeploymentFiles)
const offlineServerFiles = computed(() => {
  const selected = new Set(modpackMetadata.emittedServerFiles)
  return selected.size
    ? serverFiles.value.filter(file => selected.has(file.path))
    : serverFiles.value.filter(file => !file.path.startsWith('logs') && !file.path.endsWith('.disabled'))
})
const serverConfigFiles = new Set(['eula.txt', 'server.properties', 'ops.json', 'whitelist.json', 'banned-ips.json', 'banned-players.json'])
function categorizeServerFile(file: InstanceFile): ServerDeploymentCategory {
  if (file.path.startsWith('mods/')) return 'mods'
  if (file.path.startsWith('world/')) return 'world'
  if (serverConfigFiles.has(file.path) || file.path.startsWith('config/') || file.path.startsWith('defaultconfigs/')) return 'config'
  return 'extra'
}
const configCategoryFiles = computed(() => serverFiles.value.filter(file => categorizeServerFile(file) === 'config'))
const extraCategoryFiles = computed(() => serverFiles.value.filter(file => categorizeServerFile(file) === 'extra'))
const deploymentPolicies = computed<Record<ServerDeploymentCategory, ServerDeploymentPolicy>>(() => ({
  config: configPolicy.value,
  mods: modsPolicy.value,
  world: worldPolicy.value,
  extra: extraPolicy.value,
}))
const deploymentPlan = computed<ServerDeploymentPlan>(() => {
  const config = new Set(configSelection.value)
  const extra = new Set(extraSelection.value)
  const files: ServerDeploymentFile[] = serverFiles.value
    .map(file => ({ ...file, category: categorizeServerFile(file) }))
    .filter(file => file.category === 'mods' || file.category === 'world' || (file.category === 'config' ? config.has(file.path) : extra.has(file.path)))
  return { policies: deploymentPolicies.value, files }
})
const deploymentCategories = computed(() => [
  { key: 'config', title: t('server.remoteConfigFiles'), summary: t('server.remoteSelectedFiles', { count: configSelection.value.length }), policy: configPolicy, selectable: true },
  { key: 'mods', title: t('server.remoteMods'), summary: t('server.remoteSelectedFiles', { count: deploymentPlan.value.files.filter(file => file.category === 'mods').length }), policy: modsPolicy, selectable: false },
  { key: 'world', title: t('server.remoteWorld'), summary: instance.value.serverConfig?.world.saveName || t('server.remoteNoWorldSelected'), policy: worldPolicy, selectable: false },
  { key: 'extra', title: t('server.remoteExtraFiles'), summary: t('server.remoteSelectedFiles', { count: extraSelection.value.length }), policy: extraPolicy, selectable: true },
])

const secret = ref('')
const remember = ref(false)
const forgetCredentialsOnUnmount = ref(false)

type ReconcilePhase = 'idle' | 'connect' | 'inspect' | 'install' | 'sync' | 'world' | 'service' | 'start' | 'logs' | 'ready' | 'error'
const reconcilePhase = ref<ReconcilePhase>('idle')
const reconcileDetail = ref('')

function hashDesiredState(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const desiredRevision = computed(() => hashDesiredState(JSON.stringify({
  config: instance.value.serverConfig,
  runtime: instance.value.runtime,
  version: versionId.value,
})))

function openFileSelector(category: 'config' | 'extra') {
  fileSelector.value = category
  fileSelectorOpen.value = true
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}

async function onSelectPrivateKey() {
  const { filePaths, canceled } = await windowController.showOpenDialog({
    title: t('server.exportSSHPrivateKeyPath'),
    properties: ['openFile'],
    filters: [{ name: t('server.exportSSHPrivateKeyPath'), extensions: ['pem', 'ppk'] }],
  })
  if (!canceled) {
    form.privateKeyPath = filePaths[0]
  }
}

const { refresh: onSave, refreshing: saving } = useRefreshable(async () => {
  const patch: Partial<RemoteServerConnection> = {
    name: form.name || t('server.targetRemote'),
    host: form.host,
    port: form.port || 22,
    username: form.username,
    remotePath: form.remotePath,
    authMethod: form.authMethod,
    privateKeyPath: form.authMethod === 'privateKey' ? form.privateKeyPath : undefined,
  }
  await remote.saveProfile(patch)
  const current = InstanceServerConfigSchema.parse(instance.value.serverConfig ?? {})
  await editInstance({
    instancePath: path.value,
    serverConfig: {
      ...current,
      deployment: {
        config: { policy: configPolicy.value, files: configSelection.value },
        mods: { policy: modsPolicy.value },
        world: { policy: worldPolicy.value },
        extra: { policy: extraPolicy.value, files: extraSelection.value },
      },
    },
  })
  const providedSecret = secret.value
  if (providedSecret) {
    await remote.saveCredentials(
      form.authMethod === 'password' ? { password: providedSecret } : { passphrase: providedSecret },
    )
    secret.value = ''
  }
  forgetCredentialsOnUnmount.value = !remember.value && (hasSavedCredentials.value || !!providedSecret)
})

const deploymentError = ref('')
async function recordSuccessfulDeployment() {
  const revision = desiredRevision.value
  await remote.setDeploymentRevision(revision)
  await remote.saveProfile({ lastSyncedRevision: revision, lastSyncedAt: Date.now() })
}

async function deployCurrentState() {
  const credentials = secret.value
    ? form.authMethod === 'password' ? { password: secret.value } : { passphrase: secret.value }
    : undefined
  const version = await serverLaunch.prepareServer()
  await refreshDeploymentFiles()
  deploymentPreview.value = await previewServerDeployment(deploymentPlan.value)
  const options = await generateLaunchOptions(path.value, userProfile.value, '', 'server', { version }, true)
  await uploadServer(options, deploymentPlan.value, credentials)
  await serverLaunch.applyServerConfiguration()
}

const deploymentPreview = ref<ServerDeploymentPreview>()
const { refresh: onPreviewDeployment, refreshing: previewingDeployment } = useRefreshable(async () => {
  deploymentError.value = ''
  try {
    await onSave()
    await serverLaunch.prepareServer()
    await refreshDeploymentFiles()
    deploymentPreview.value = await previewServerDeployment(deploymentPlan.value)
  } catch (error) {
    deploymentError.value = getErrorMessage(error)
  }
})

const { refresh: onDeployServer, refreshing: deployingServer } = useRefreshable(async () => {
  deploymentError.value = ''
  try {
    await onSave()
    await refreshStatus()
    await deployCurrentState()
    await recordSuccessfulDeployment()
    await refreshStatus()
  } catch (error) {
    deploymentError.value = getErrorMessage(error)
  }
})

const { refresh: onBuildOfflinePackage, refreshing: buildingOfflinePackage } = useRefreshable(async () => {
  deploymentError.value = ''
  try {
    const selectedClient = new Set(modpackMetadata.emittedFiles)
    const clientDirectives: ExportFileDirective[] = clientFiles.value
      .filter(file => selectedClient.size === 0 || selectedClient.has(file.path))
      .map(file => ({ path: file.path, env: modpackMetadata.filesEnvironments[file.path] as ExportFileDirective['env'] }))
    const serverDirectives: ExportFileDirective[] = offlineServerFiles.value.map(file => ({
      path: `server/${file.path}`,
      source: `server/${file.path}`,
    }))
    await exportModpack({
      instancePath: path.value,
      gameVersion: versionId.value || '',
      name: instance.value.name,
      author: instance.value.author,
      version: modpackMetadata.modpackVersion,
      destinationDirectory: modpackMetadata.exportDirectory,
      files: [...clientDirectives, ...serverDirectives],
      emitCurseforge: false,
      emitModrinth: false,
      emitOffline: true,
    })
  } catch (error) {
    deploymentError.value = getErrorMessage(error)
  }
})

async function onForgetCredentials() {
  await remote.forgetCredentials()
}

const testResult = ref<{ ok: boolean; message?: string } | undefined>()
const { refresh: onTestConnection, refreshing: testing } = useRefreshable(async () => {
  testResult.value = undefined
  testResult.value = await remote.testConnection()
})

const actionMessage = ref<{ ok: boolean; message?: string } | undefined>()

const { refresh: onStop, refreshing: stopping } = useRefreshable(async () => {
  actionMessage.value = await remote.stopService()
  await refreshStatus()
})

const { refresh: onLaunchRemote, refreshing: launchingRemote } = useRefreshable(async () => {
  actionMessage.value = undefined
  deploymentError.value = ''
  reconcileDetail.value = ''
  try {
    reconcilePhase.value = 'connect'
    await onSave()
    const connection = await remote.testConnection()
    if (!connection.ok) throw new Error(connection.message || t('server.remoteTestConnection'))

    reconcilePhase.value = 'inspect'
    await refreshStatus()
    const snapshot = status.value
    if (snapshot?.platform !== 'Linux') throw new Error(t('server.remoteLinuxRequired'))
    if (!snapshot.javaAvailable) throw new Error(t('server.remoteJavaRequired'))
    if (!snapshot.systemdAvailable) throw new Error(t('server.remoteSystemdRequired'))
    if (!snapshot.remotePathWritable) throw new Error(t('server.remotePathNotWritable'))

    const needsSync = !snapshot.serverInstalled || snapshot.appliedRevision !== desiredRevision.value
    if (needsSync) {
      reconcilePhase.value = snapshot.serverInstalled ? 'sync' : 'install'
      await deployCurrentState()
      await recordSuccessfulDeployment()
    }

    reconcilePhase.value = 'service'
    const installed = await remote.installService()
    if (!installed.ok) throw new Error(installed.message || t('server.remoteInstallService'))

    reconcilePhase.value = 'start'
    const started = await remote.startService()
    if (!started.ok) throw new Error(started.message || t('server.remoteStartService'))

    reconcilePhase.value = 'logs'
    watchingLog.value = true
    await refreshStatus()
    actionMessage.value = started
    reconcilePhase.value = 'ready'
    reconcileDetail.value = t('server.remoteReconcileReady')
  } catch (error) {
    const message = getErrorMessage(error)
    reconcilePhase.value = 'error'
    reconcileDetail.value = message
    actionMessage.value = { ok: false, message }
  }
})

watch(() => status.value?.serviceActive, (value) => { serverLaunch.running.value = !!value }, { immediate: true })
watch([configured, () => instance.value.serverConfig?.eula], ([isConfigured, eula]) => {
  serverLaunch.canLaunch.value = isConfigured && !!eula
}, { immediate: true })
watch([launchingRemote, stopping], ([isLaunching, isStopping]) => { serverLaunch.loading.value = isLaunching || isStopping }, { immediate: true })
onMounted(() => {
  serverLaunch.active.value = true
  serverLaunch.setHandlers({ launch: onLaunchRemote, kill: onStop })
})
onBeforeUnmount(() => {
  serverLaunch.active.value = false
  serverLaunch.running.value = false
  serverLaunch.loading.value = false
  serverLaunch.canLaunch.value = false
  serverLaunch.setHandlers({})
  if (forgetCredentialsOnUnmount.value) remote.forgetCredentials()
})
</script>

<style scoped>
.remote-reconcile {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.025);
}

.remote-advanced :deep(.v-expansion-panel) {
  background: rgba(var(--v-theme-on-surface), 0.025);
}

.deployment-categories {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}

.deployment-category {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}

.policy-select {
  flex: 0 0 180px;
}

@media (max-width: 640px) {
  .deployment-category {
    align-items: stretch;
    flex-wrap: wrap;
    padding: 12px 0;
  }

  .policy-select {
    flex-basis: 100%;
  }
}
</style>
