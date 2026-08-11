import { useService } from '@/composables'
import type { Instance, RemoteServerConnection } from '@xmcl/instance'
import {
  InstanceServiceKey,
  type LaunchOptions,
  type RemoteServerCredentialsInput,
  type ServerDeploymentPlan,
  RemoteServerLogState,
  RemoteServerServiceKey,
  RemoteServerStatusState,
} from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref, computed, ref } from 'vue'
import { useState } from './syncableState'

export const kRemoteServer: InjectionKey<ReturnType<typeof useRemoteServer>> = Symbol('RemoteServer')

function emptyProfile(): RemoteServerConnection {
  return {
    name: 'SSH Target',
    host: '',
    port: 22,
    username: '',
    remotePath: '',
    authMethod: 'password',
  }
}

/**
 * Remote SSH server admin: the non-secret connection profile lives on
 * `instance.remoteServer` (edited via `InstanceService.editInstance`);
 * credentials, connection test, live status and log tail go through
 * `RemoteServerService`. Service desired state is owned by `serverConfig`.
 */
export function useRemoteServer(path: Ref<string>, instance: Ref<Instance>) {
  const { editInstance } = useService(InstanceServiceKey)
  const {
    hasCredentials,
    setCredentials,
    clearCredentials,
    testConnection,
    uploadServer: uploadServerImpl,
    previewServerDeployment,
    setDeploymentRevision,
    watchStatus,
    installService,
    uninstallService,
    startService,
    stopService,
    restartService,
    watchLog,
    readRemoteFile,
    writeRemoteFile,
  } = useService(RemoteServerServiceKey)

  const profile = computed(() => instance.value.remoteServer)
  const configured = computed(() => !!profile.value?.host && !!profile.value?.username && !!profile.value?.remotePath)
  const serviceConfigured = computed(() => configured.value && !!profile.value?.serviceName && !!profile.value?.startCommand)

  async function saveProfile(patch: Partial<RemoteServerConnection>) {
    const base = profile.value ?? emptyProfile()
    await editInstance({ instancePath: path.value, remoteServer: { ...base, ...patch } })
  }

  const { data: hasSavedCredentialsRaw, mutate: reloadHasCredentials } = useSWRV(
    computed(() => `${path.value}/remote-server/credentials`),
    () => hasCredentials(path.value),
  )

  async function saveCredentials(input: { password?: string; passphrase?: string }) {
    await setCredentials(path.value, input)
    await reloadHasCredentials()
  }

  async function forgetCredentials() {
    await clearCredentials(path.value)
    await reloadHasCredentials()
  }

  const { state: statusState, isValidating: statusLoading, revalidate: refreshStatus } = useState(
    () => configured.value ? watchStatus(path.value) : undefined,
    RemoteServerStatusState,
  )
  const status = computed(() => statusState.value?.status)

  const watchingLog = ref(false)
  const { state: logState } = useState(
    () => (watchingLog.value && configured.value) ? watchLog(path.value) : undefined,
    RemoteServerLogState,
  )
  const logLines = computed(() => logState.value?.lines ?? [])

  return {
    profile,
    configured,
    serviceConfigured,
    saveProfile,
    hasSavedCredentials: computed(() => !!hasSavedCredentialsRaw.value),
    saveCredentials,
    forgetCredentials,
    testConnection: () => testConnection(path.value),
    uploadServer: (options: LaunchOptions, plan: ServerDeploymentPlan, credentials?: RemoteServerCredentialsInput) => uploadServerImpl(path.value, options, plan, credentials),
    previewServerDeployment: (plan: ServerDeploymentPlan) => previewServerDeployment(path.value, plan),
    setDeploymentRevision: (revision: string) => setDeploymentRevision(path.value, revision),
    status,
    statusLoading,
    refreshStatus,
    installService: () => installService(path.value),
    uninstallService: () => uninstallService(path.value),
    startService: () => startService(path.value),
    stopService: () => stopService(path.value),
    restartService: () => restartService(path.value),
    watchingLog,
    logLines,
    readRemoteFile: (file: string) => readRemoteFile(path.value, file),
    writeRemoteFile: (file: string, content: string) => writeRemoteFile(path.value, file, content),
  }
}
