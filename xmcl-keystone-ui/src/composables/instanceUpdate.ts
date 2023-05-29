import { injection } from '@/util/inject'
import { File, FileIndex } from '@xmcl/curseforge'
import { InstanceData, Resource, ResourceMetadata, ResourceServiceKey, getCurseforgeFileUri } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { DialogKey } from './dialog'
import { kModrinthInstall } from './modrinthInstall'
import { useModrinthLatestVersion } from './modrinthLatestVersion'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export type InstanceInstallOptions = {
  type: 'modrinth' | 'curseforge'
  currentResource?: { metadata: Pick<ResourceMetadata, 'instance'> } | Resource
  resource: Resource
}

export const InstanceInstallDialog: DialogKey<InstanceInstallOptions> = 'instance-install'
export const kUpstream: InjectionKey<Ref<{ upstream: InstanceData['upstream']; minecraft: string }>> = Symbol('Upstream')

export enum UpdateStatus {
  Unchecked,
  UpdateAvaiable,
  UpdateReady,
  NoUpdate,
}

export function useModrinthInstanceUpdate(props: {
  upstream: Required<InstanceData>['upstream'] & { type: 'modrinth-modpack' }
}, projectId: Ref<string>) {
  // Install
  const { onInstall, currentVersionResource } = injection(kModrinthInstall)
  // Latest modrinth modpack resource
  const { latestVersion, latestVersionResource, refreshing, error: _error, refresh } = useModrinthLatestVersion(computed(() => props.upstream.sha1 || currentVersionResource?.value?.hash || ''), projectId)

  const status = computed(() => {
    if (!latestVersion.value || !currentVersionResource.value) {
      return UpdateStatus.Unchecked
    }
    if (latestVersion.value.id === props.upstream.versionId) {
      return UpdateStatus.NoUpdate
    }
    if (latestVersionResource.value) {
      return UpdateStatus.UpdateReady
    }
    return UpdateStatus.UpdateAvaiable
  })

  const installError = ref(null as any)
  const error = computed(() => _error.value || installError.value)
  async function onUpdate() {
    // Should not duplicated request
    if (refreshing.value) return

    if (!latestVersion.value || !currentVersionResource.value) {
      await refresh()
      return
    }
    if (latestVersion.value.id === props.upstream.versionId) {
      // Should not do any thing if this is the version
      return
    }
    installError.value = null
    try {
      await onInstall(latestVersion.value)
    } catch (e) {
      installError.value = e
    }
  }

  return {
    onUpdate,
    error,
    refreshing,
    currentVersionResource,
    latestVersion,
    status,
  }
}

export function useCurseforgeInstanceUpdate(props: {
  upstream: Required<InstanceData>['upstream'] & { type: 'curseforge-modpack' }
}, targetFileResource: Ref<Resource | undefined>, targetFile: Ref<FileIndex | File | undefined>) {
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const fileId = computed(() => !targetFile.value ? undefined : 'modId' in targetFile.value ? targetFile.value.id : targetFile.value.fileId)

  const currentFileResource = ref(undefined as undefined | Resource)

  const status = computed(() => {
    if (!targetFile.value || !currentFileResource.value) {
      return UpdateStatus.Unchecked
    }
    if (fileId.value === props.upstream.fileId) {
      return UpdateStatus.NoUpdate
    }
    if (targetFileResource.value) {
      return UpdateStatus.UpdateReady
    }
    return UpdateStatus.UpdateAvaiable
  })

  const shouldDisable = computed(() => {
    return status.value === UpdateStatus.NoUpdate
  })

  const { refresh: refreshCurrentResource, refreshing } = useRefreshable(async () => {
    const [resource] = await getResourcesByUris([getCurseforgeFileUri({ modId: props.upstream.modId, id: props.upstream.fileId })])
    currentFileResource.value = resource
  })

  watch(() => props.upstream, refreshCurrentResource)
  onMounted(() => refreshCurrentResource())

  return {
    currentFileResource,
    shouldDisable,
    status,
  }
}
