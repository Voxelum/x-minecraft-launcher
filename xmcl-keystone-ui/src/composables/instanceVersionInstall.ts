import { getSWRV } from '@/util/swrvGet'
import { InstallServiceKey, LocalVersionHeader, RuntimeVersions, VersionServiceKey, parseOptifineVersion } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useService } from './service'
import { kSWRVConfig } from './swrvConfig'
import { getForgeVersionsModel, getLabyModManifestModel, getMinecraftVersionsModel, getNeoForgedVersionModel } from './version'

export function useInstanceVersionInstall(versions: Ref<LocalVersionHeader[]>) {
  const {
    installForge,
    installNeoForged,
    installMinecraft,
    installOptifine,
    installFabric,
    installQuilt,
    installLabyModVersion,
  } = useService(InstallServiceKey)

  const { refreshVersion } = useService(VersionServiceKey)

  const cfg = inject(kSWRVConfig)

  async function install(runtime: RuntimeVersions, jar = false) {
    const { minecraft, forge, fabricLoader, quiltLoader, optifine, neoForged, labyMod } = runtime
    const mcVersions = await getSWRV(getMinecraftVersionsModel(), cfg)
    const local = versions.value
    const localMinecraft = local.find(v => v.id === minecraft)
    if (!localMinecraft || jar) {
      const metadata = mcVersions.versions.find(v => v.id === minecraft)!
      await installMinecraft(metadata)
    } else {
      await refreshVersion(localMinecraft.id)
    }

    let forgeVersion = undefined as undefined | string
    if (forge) {
      const localForge = local.find(v => v.forge === forge && v.minecraft === minecraft)
      if (!localForge) {
        const forgeVersions = await getSWRV(getForgeVersionsModel(minecraft), cfg)
        const found = forgeVersions.find(v => v.version === forge)
        const forgeVersionId = found?.version ?? forge
        forgeVersion = await installForge({ mcversion: minecraft, version: forgeVersionId, installer: found?.installer })
      } else {
        forgeVersion = localForge.id
        await refreshVersion(localForge.id)
      }
    }

    if (neoForged) {
      const localNeoForge = local.find(v => v.neoForged === neoForged && v.minecraft === minecraft)
      if (!localNeoForge) {
        const neoForgedVersion = await getSWRV(getNeoForgedVersionModel(minecraft), cfg)
        const found = neoForgedVersion.find(v => v === neoForged)
        const id = found ?? neoForged
        forgeVersion = await installNeoForged({ version: id, minecraft })
      } else {
        forgeVersion = localNeoForge.id
        await refreshVersion(localNeoForge.id)
      }
    }

    if (optifine) {
      let optifineVersion = optifine
      if (optifineVersion.startsWith(minecraft)) {
        optifineVersion = optifineVersion.substring(minecraft.length)
      }
      const localOptifine = local.find(v => v.minecraft === minecraft && v.optifine === optifineVersion && v.forge === (forgeVersion || ''))
      if (localOptifine) {
        await refreshVersion(localOptifine.id)
        return localOptifine.id
      }
      const { type, patch } = parseOptifineVersion(optifineVersion)
      const [ver] = await installOptifine({ type, patch, mcversion: minecraft, inheritFrom: forgeVersion })
      return ver
    } else if (forgeVersion) {
      return forgeVersion
    }

    if (fabricLoader) {
      const localFabric = local.find(v => v.fabric === fabricLoader && v.minecraft === runtime.minecraft)
      if (localFabric) {
        await refreshVersion(localFabric.id)
        return localFabric.id
      }
      return await installFabric({ loader: fabricLoader, minecraft })
    }

    if (quiltLoader) {
      const localQuilt = local.find(v => v.quilt === quiltLoader && v.minecraft === runtime.minecraft)
      if (localQuilt) {
        await refreshVersion(localQuilt.id)
        return localQuilt.id
      }
      return await installQuilt({ version: quiltLoader, minecraftVersion: minecraft })
    }

    if (labyMod) {
      const localLabyMod = local.find(v => v.labyMod === labyMod && v.minecraft === runtime.minecraft)
      if (localLabyMod) {
        await refreshVersion(localLabyMod.id)
        return localLabyMod.id
      }

      const manifest = await getSWRV(getLabyModManifestModel(), cfg)

      return await installLabyModVersion({ manifest, minecraftVersion: minecraft })
    }

    return minecraft
  }

  return {
    install,
  }
}
