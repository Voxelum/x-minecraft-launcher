import { useService } from '@/composables'
import { getLatestNeoforge } from '@/composables/version'
import { InstanceServiceKey, VersionMetadataServiceKey } from '@xmcl/runtime-api'
import { RuntimeVersions } from '@xmcl/instance'

export function useInstanceModLoaderDefault() {
  const { editInstance } = useService(InstanceServiceKey)
  const metadata = useService(VersionMetadataServiceKey)

  async function apply(
    path: string,
    runtime: RuntimeVersions,
    loaders: Array<'forge' | 'quilt' | 'neoforge' | 'fabric' | string>,
    targetGameVersions?: string[],
  ) {
    for (const loader of loaders) {
      if (loader === 'fabric') {
        const { gameVersions, loaderVersions } = await metadata.getFabricVersions()
        let mc = runtime.minecraft
        if (targetGameVersions && targetGameVersions.length > 0) {
          if (!targetGameVersions.includes(mc) || !gameVersions.includes(mc)) {
            const matched = targetGameVersions.find((v) => gameVersions.includes(v))
            if (!matched) continue
            mc = matched
          }
        } else if (!gameVersions.includes(mc)) {
          mc = gameVersions[0] || '1.21.4'
        }
        const version = loaderVersions[0]
        if (version) {
          await editInstance({
            instancePath: path,
            runtime: {
              ...runtime,
              minecraft: mc,
              fabricLoader: version.version,
              forge: '',
              neoForged: '',
              quiltLoader: '',
            },
            version: '',
          })
          return true
        }
        continue
      } else if (loader === 'quilt') {
        const { gameVersions, loaderVersions } = await metadata.getQuiltVersions()
        let mc = runtime.minecraft
        if (targetGameVersions && targetGameVersions.length > 0) {
          if (!targetGameVersions.includes(mc) || !gameVersions.includes(mc)) {
            const matched = targetGameVersions.find((v) => gameVersions.includes(v))
            if (!matched) continue
            mc = matched
          }
        } else if (!gameVersions.includes(mc)) {
          mc = gameVersions[0] || '1.21.4'
        }
        const version = loaderVersions[0]
        if (version) {
          await editInstance({
            instancePath: path,
            runtime: {
              ...runtime,
              minecraft: mc,
              quiltLoader: version.version,
              forge: '',
              neoForged: '',
              fabricLoader: '',
            },
            version: '',
          })
          return true
        }
        continue
      } else if (loader === 'forge') {
        let mc = runtime.minecraft
        let forges: any[] = []
        if (targetGameVersions && targetGameVersions.length > 0) {
          if (targetGameVersions.includes(mc)) {
            forges = await metadata.getForgeVersions(mc).catch(() => [])
          }
          if (!forges || forges.length === 0) {
            for (const v of targetGameVersions) {
              const check = await metadata.getForgeVersions(v).catch(() => [])
              if (check && check.length > 0) {
                mc = v
                forges = check
                break
              }
            }
          }
        } else {
          forges = await metadata.getForgeVersions(mc).catch(() => [])
        }
        const version = forges?.find((f) => f.type === 'recommended') || forges?.[0]
        if (version) {
          await editInstance({
            instancePath: path,
            runtime: {
              ...runtime,
              minecraft: mc,
              forge: version.version,
              fabricLoader: '',
              quiltLoader: '',
              neoForged: '',
            },
            version: '',
          })
          return true
        }
        continue
      } else if (loader === 'neoforge') {
        let mc = runtime.minecraft
        let versions: any[] = []
        if (targetGameVersions && targetGameVersions.length > 0) {
          if (targetGameVersions.includes(mc)) {
            versions = await metadata.getNeoForgedVersions(mc).catch(() => [])
          }
          if (!versions || versions.length === 0) {
            for (const v of targetGameVersions) {
              const check = await metadata.getNeoForgedVersions(v).catch(() => [])
              if (check && check.length > 0) {
                mc = v
                versions = check
                break
              }
            }
          }
        } else {
          versions = await metadata.getNeoForgedVersions(mc).catch(() => [])
        }
        const version = getLatestNeoforge(versions)
        if (version) {
          await editInstance({
            instancePath: path,
            runtime: {
              ...runtime,
              minecraft: mc,
              neoForged: version,
              fabricLoader: '',
              quiltLoader: '',
              forge: '',
            },
            version: '',
          })
          return true
        }
        continue
      } else if (loader === 'minecraft') {
        let mc = runtime.minecraft
        if (targetGameVersions && targetGameVersions.length > 0 && !targetGameVersions.includes(mc)) {
          mc = targetGameVersions[0]
          await editInstance({
            instancePath: path,
            runtime: {
              ...runtime,
              minecraft: mc,
            },
            version: '',
          })
        }
        return true
      }
    }

    return false
  }

  return apply
}
