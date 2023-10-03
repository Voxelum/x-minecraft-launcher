import { InstallServiceKey, InstanceServiceKey, RuntimeVersions } from '@xmcl/runtime-api'
import { swrvGet } from './swrvGet'
import { useSWRVConfig } from '@/composables/swrvConfig'
import { useService } from '@/composables'
import { Ref } from 'vue'

export function useInstanceModLoaderDefault(path: Ref<string>, runtime: Ref<RuntimeVersions>) {
  const { cache, dedupingInterval } = useSWRVConfig()
  const { editInstance } = useService(InstanceServiceKey)
  const { getQuiltVersionList, getFabricVersionList, getForgeVersionList, getNeoForgedVersionList } = useService(InstallServiceKey)

  async function apply(loaders: Array<'forge' | 'quilt' | 'neoforge' | 'fabric' | string>) {
    for (const loader of loaders.map(l => l.toLowerCase())) {
      if (loader === 'fabric') {
        const versions = await swrvGet('/fabric-versions', () => getFabricVersionList(), cache, dedupingInterval)
        if (versions.yarns.some(v => v.gameVersion === runtime.value.minecraft)) {
          const version = versions.loaders[0]
          await editInstance({
            instancePath: path.value,
            runtime: {
              ...runtime.value,
              fabricLoader: version.version,
            },
          })
          return true
        }
      } else if (loader === 'quilt') {
        const versions = await swrvGet(`/quilt-versions/${runtime.value.minecraft}`, () => getQuiltVersionList({ minecraftVersion: runtime.value.minecraft }), cache, dedupingInterval)
        const version = versions[0]

        if (version) {
          await editInstance({
            instancePath: path.value,
            runtime: {
              ...runtime.value,
              quiltLoader: version.version,
            },
          })
          return true
        }
      } else if (loader === 'forge') {
        const forges = await swrvGet(`/forge-versions/${runtime.value.minecraft}`, () => getForgeVersionList({ minecraftVersion: runtime.value.minecraft }), cache, dedupingInterval)
        const version = forges.find(f => f.type === 'recommended') || forges[0]
        if (version) {
          await editInstance({
            instancePath: path.value,
            runtime: {
              ...runtime.value,
              forge: version.version,
            },
          })
          return true
        }
      } else if (loader === 'neoforge') {
        const versions = await swrvGet('/neoforged-versions', () => getNeoForgedVersionList(), cache, dedupingInterval)
        const version = versions.release
        if (version) {
          await editInstance({
            instancePath: path.value,
            runtime: {
              ...runtime.value,
              neoForged: version,
            },
          })
          return true
        }
      }
    }

    return false
  }

  return apply
}
