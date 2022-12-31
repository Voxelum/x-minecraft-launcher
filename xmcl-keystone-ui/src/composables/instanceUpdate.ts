import { File } from '@xmcl/curseforge'
import { ProjectVersion } from '@xmcl/modrinth'
import { CurseForgeServiceKey, getCurseforgeFileUri, getModrinthVersionUri, InstanceData, ModrinthServiceKey, Resource, ResourceServiceKey } from '@xmcl/runtime-api'
import { DialogKey, useDialog } from './dialog'
import { useRefreshable } from './refreshable'
import { useServiceBusy } from './semaphore'
import { useService } from './service'

export type InstanceInstallOptions = {
  type: 'modrinth' | 'curseforge'
  currentResource?: Resource
  resource: Resource
}

export const InstanceInstallDialog: DialogKey<InstanceInstallOptions> = 'instance-install'

export enum UpdateStatus {
  Unchecked,
  UpdateAvaiable,
  UpdateReady,
  NoUpdate,
}

export function useModrinthInstanceUpdate(props: {
  instance: InstanceData
  upstream: Required<InstanceData>['upstream'] & { type: 'modrinth-modpack' }
}) {
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const { show } = useDialog(InstanceInstallDialog)
  const { push } = useRouter()

  const currentVersion = ref(undefined as undefined | ProjectVersion)
  const currentVersionResource = ref(undefined as undefined | Resource)
  const latestVersion = ref(undefined as undefined | ProjectVersion)
  const latestVersionResource = ref(undefined as undefined | Resource)

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

  const { refresh: refreshCurrentResource, refreshing: refreshingCurrentResource } = useRefreshable(async () => {
    const [resource] = await getResourcesByUris([getModrinthVersionUri({ project_id: props.upstream.projectId, id: props.upstream.versionId })])
    currentVersionResource.value = resource
  })

  watch(computed(() => props.upstream), refreshCurrentResource)

  const { getLatestProjectVersion, installVersion } = useService(ModrinthServiceKey)

  const installing = useServiceBusy(ModrinthServiceKey, 'installVersion', computed(() => latestVersion.value?.id ?? ''))
  const refreshing = useServiceBusy(ModrinthServiceKey, 'getLatestProjectVersion', computed(() => props.upstream.sha1 ?? currentVersionResource?.value?.hash ?? ''))
  const loading = computed(() => installing.value || refreshing.value)

  async function onUpdate() {
    if (!latestVersion.value || !currentVersionResource.value) {
      const hash = props.upstream.sha1 || currentVersionResource?.value?.hash
      if (!hash) {
        // TODO: show error
        return
      }
      latestVersion.value = await getLatestProjectVersion(hash)
      const [resource] = await getResourcesByUris([getModrinthVersionUri({ project_id: props.upstream.projectId, id: latestVersion.value.id })])
      latestVersionResource.value = resource
      return
    }
    if (latestVersion.value.id === props.upstream.versionId) {
      return
    }
    if (!latestVersionResource.value) {
      await installVersion({ version: latestVersion.value })
      return
    }
    show({
      type: 'modrinth',
      currentResource: currentVersionResource.value,
      resource: latestVersionResource.value,
    })
  }

  async function onReinstall() {
    if (!latestVersionResource.value) throw new Error()
    if (!currentVersionResource.value) throw new Error()
    show({
      type: 'modrinth',
      currentResource: currentVersionResource.value,
      resource: latestVersionResource.value,
    })
  }

  function goToPage() {
    push(`/modrinth/${props.upstream.projectId}`)
  }

  return {
    onUpdate,
    onReinstall,
    goToPage,
    currentVersion,
    latestVersion,
    installing,
    status,
    loading,
    refreshingCurrentResource,
  }
}

export function useCurseforgeInstanceUpdate(props: {
  instance: InstanceData
  upstream: Required<InstanceData>['upstream'] & { type: 'curseforge-modpack' }
}) {
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const { show } = useDialog(InstanceInstallDialog)
  const { push } = useRouter()

  const currentFileResource = ref(undefined as undefined | Resource)
  const latestFile = ref(undefined as undefined | File)
  const latestFileResource = ref(undefined as undefined | Resource)

  const status = computed(() => {
    if (!latestFile.value || !currentFileResource.value) {
      return UpdateStatus.Unchecked
    }
    if (latestFile.value.id === props.upstream.fileId) {
      return UpdateStatus.NoUpdate
    }
    if (latestFileResource.value) {
      return UpdateStatus.UpdateReady
    }
    return UpdateStatus.UpdateAvaiable
  })

  const { refresh: refreshCurrentResource, refreshing: refreshingCurrentResource } = useRefreshable(async () => {
    const [resource] = await getResourcesByUris([getCurseforgeFileUri({ modId: props.upstream.modId, id: props.upstream.fileId })])
    currentFileResource.value = resource
  })

  watch(computed(() => props.upstream), refreshCurrentResource)

  onMounted(refreshCurrentResource)

  const { getModFiles, installFile } = useService(CurseForgeServiceKey)

  const installing = useServiceBusy(CurseForgeServiceKey, 'installFile', computed(() => latestFile.value?.id.toString() ?? ''))
  const refreshing = useServiceBusy(CurseForgeServiceKey, 'getModFiles', computed(() => props.upstream.sha1 ?? currentFileResource?.value?.hash ?? ''))

  const { refresh: onUpdate, error, refreshing: updating } = useRefreshable(async () => {
    if (!latestFile.value) {
      const { data } = await getModFiles({ modId: props.upstream.modId, pageSize: 1 })
      latestFile.value = data[0]
      const [resource] = await getResourcesByUris([getCurseforgeFileUri({ modId: props.upstream.modId, id: latestFile.value.id })])
      latestFileResource.value = resource
      return
    }
    if (latestFile.value.id === props.upstream.fileId) {
      return
    }
    if (!latestFileResource.value) {
      await installFile({ file: latestFile.value, type: 'modpacks' })
      const [resource] = await getResourcesByUris([getCurseforgeFileUri({ modId: props.upstream.modId, id: latestFile.value.id })])
      latestFileResource.value = resource
      return
    }
    show({
      type: 'curseforge',
      currentResource: currentFileResource.value,
      resource: latestFileResource.value,
    })
  })

  function goToPage() {
    push(`/curseforge/modpacks/${props.upstream.modId}`)
  }

  const loading = computed(() => installing.value || refreshing.value || updating.value)

  async function onReinstall() {
    if (!currentFileResource.value) throw new Error()
    if (!latestFileResource.value) throw new Error()
    show({
      type: 'modrinth',
      currentResource: currentFileResource.value,
      resource: latestFileResource.value,
    })
  }

  return {
    onUpdate,
    onReinstall,
    error,
    goToPage,
    latestFile,
    currentFileResource,
    installing,
    status,
    loading,
  }
}
