import { useService } from '@/composables'
import { getLatestNeoforge } from '@/composables/version'
import { InstanceServiceKey, VersionMetadataServiceKey } from '@xmcl/runtime-api'
import { RuntimeVersions } from '@xmcl/instance'

export function useInstanceModLoaderDefault() {
  const { editInstance } = useService(InstanceServiceKey)
  const metadata = useService(VersionMetadataServiceKey)

  async function apply(path: string, runtime: RuntimeVersions, loaders: Array<'forge' | 'quilt' | 'neoforge' | 'fabric' | string>) {
    for (const loader of loaders) {
      if (loader === 'fabric') {
        const { gameVersions, loaderVersions } = await metadata.getFabricVersions()
        if (gameVersions.includes(runtime.minecraft)) {
          const version = loaderVersions[0]
          await editInstance({
            instancePath: path,
            runtime: {
              ...runtime,
              fabricLoader: version.version,
            },
            version: '',
          })
          return true
        }
        return false
      } else if (loader === 'quilt') {
        const { gameVersions, loaderVersions } = await metadata.getQuiltVersions()
        if (gameVersions.includes(runtime.minecraft)) {
          const version = loaderVersions[0]
          await editInstance({
            instancePath: path,
            runtime: {
              ...runtime,
              quiltLoader: version.version,
            },
            version: '',
          })
          return true
        }
        return false
      } else if (loader === 'forge') {
        const forges = await metadata.getForgeVersions(runtime.minecraft)
        const version = forges.find(f => f.type === 'recommended') || forges[0]
        if (version) {
          await editInstance({
            instancePath: path,
            runtime: {
              ...runtime,
              forge: version.version,
            },
            version: '',
          })
          return true
        }
        return false
      } else if (loader === 'neoforge') {
        const versions = await metadata.getNeoForgedVersions(runtime.minecraft)
        const version = getLatestNeoforge(versions)
        if (version) {
          await editInstance({
            instancePath: path,
            runtime: {
              ...runtime,
              neoForged: version,
            },
            version: '',
          })
          return true
        }
        return false
      } else if (loader === 'minecraft') {
        return true
      }
    }

    return true
  }

  return apply
}
