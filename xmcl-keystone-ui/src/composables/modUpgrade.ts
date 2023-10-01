import { Mod, ModFile } from '@/util/mod'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { Ref } from 'vue'
import { RuntimeVersions } from '@xmcl/runtime-api'
import { swrvGet } from '@/util/swrvGet'
import { injection } from '@/util/inject'
import { kSWRVConfig } from './swrvConfig'
import { FileModLoaderType } from '@xmcl/curseforge'

export function useModUpgrade(runtime: Ref<RuntimeVersions>, instanceMods: Ref<Mod[]>) {
  const { cache, dedupingInterval } = injection(kSWRVConfig)
  async function check() {
    for (const mod of instanceMods.value) {
      if (mod.installed.length > 0 && mod.curseforgeProjectId) {
        const gameVersion = runtime.value.minecraft
        const modLoaderType = (runtime.value.forge || runtime.value.neoForged)
          ? FileModLoaderType.Forge
          : runtime.value.fabricLoader
            ? FileModLoaderType.Fabric
            : runtime.value.quiltLoader
              ? FileModLoaderType.Quilt
              : FileModLoaderType.Any
        // this is a curseforge project and installed
        const files = await swrvGet(`/curseforge/${mod.curseforgeProjectId}/files?gameVersion=${gameVersion}&modLoaderType=${modLoaderType}&index=0`, () => clientCurseforgeV1.getModFiles({
          modId: mod.curseforgeProjectId!,
          gameVersion,
          modLoaderType,
        }), cache, dedupingInterval)
        if (files.data.length > 0) {
          const file = files.data[0]
          // if (file.id !== mod.installed[0].version) {
        }
      } else if (mod.installed.length > 0 && mod.modrinthProjectId) {
        // this is a modrinth project and installed
        const loaders = (runtime.value.forge || runtime.value.neoForged) ? ['forge'] : runtime.value.fabricLoader ? ['fabric'] : runtime.value.quiltLoader ? ['quilt'] : []
        const gameVersions = [runtime.value.minecraft]
        const versions = await swrvGet(`/modrinth/versions/?featured=${undefined}&loaders=${loaders || ''}&gameVersions=${gameVersions || ''}`, () => clientModrinthV2.getProjectVersions(
          mod.modrinthProjectId!,
          { loaders, gameVersions },
        ), cache, dedupingInterval)
      }
    }
  }
}
