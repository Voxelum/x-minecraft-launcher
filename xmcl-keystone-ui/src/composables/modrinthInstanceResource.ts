import { ModrinthUpstream, Resource, ResourceServiceKey, getModrinthVersionUri } from '@xmcl/runtime-api'
import { useService } from './service'
import { ProjectVersion } from '@xmcl/modrinth'

export function useModrinthInstanceResource() {
  const { getResourceByHash, getResourcesByUris } = useService(ResourceServiceKey)
  async function getResourceByUpstream(upstream: ModrinthUpstream) {
    let resource: Resource | undefined
    if (upstream.sha1) {
      resource = await getResourceByHash(upstream.sha1)
    }
    if (!resource) {
      const arr = await getResourcesByUris([getModrinthVersionUri({
        project_id: upstream.projectId,
        id: upstream.versionId,
      })])
      resource = arr[0]
    }
    return resource
  }
  async function getResourceByVersion(version: ProjectVersion) {
    let resource: Resource | undefined
    const file = version.files.find(f => f.primary) || version.files[0]
    if (file && file.hashes.sha1) {
      resource = await getResourceByHash(file.hashes.sha1)
    }
    if (!resource) {
      const arr = await getResourcesByUris([getModrinthVersionUri(version)])
      resource = arr[0]
    }
    return resource
  }
  return {
    getResourceByUpstream,
    getResourceByVersion,
  }
}
