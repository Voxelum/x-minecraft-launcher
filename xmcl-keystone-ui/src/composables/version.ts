import { parse } from '@/util/forgeWebParser'
import { MaybeRef, get } from '@vueuse/core'
import type { LabyModManifest } from '@xmcl/installer'
import { FabricArtifactVersion, ForgeVersion, MinecraftVersions, OptifineVersion, QuiltArtifactVersion, VersionMetadataServiceKey } from '@xmcl/runtime-api'
import { Ref, computed } from 'vue'
import { useSWRVModel } from './swrv'
import { kSWRVConfig } from './swrvConfig'
import { useService } from './service'

async function getJson<T>(url: string) {
  const res = await fetch(url)
  if (res.ok) {
    const result = await res.json()
    return result as T
  }
  throw new Error('Failed to load ' + url)
}

export function getMinecraftVersionsModel() {
  return {
    key: '/minecraft-versions',
    fetcher: async () => {
      const result = await Promise.any([
        getJson<MinecraftVersions>('https://launchermeta.mojang.com/mc/game/version_manifest.json'),
        getJson<MinecraftVersions>('https://bmclapi2.bangbang93.com/mc/game/version_manifest.json'),
      ])
      result.versions = result.versions.map(markRaw)
      return markRaw(result)
    },
  }
}

export function useMinecraftVersions() {
  const { data, isValidating, mutate, error } = useSWRVModel(
    getMinecraftVersionsModel(),
    inject(kSWRVConfig),
  )

  const { setLatestMinecraft } = useService(VersionMetadataServiceKey)
  watch(data, (d) => {
    if (d) {
      setLatestMinecraft(d.latest.release, d.latest.snapshot)
    }
  }, { immediate: true })

  const versions = computed(() => !data.value ? [] : data.value.versions)
  const release = computed(() => !data.value ? undefined : data.value.versions.find(v => v.id === data.value!.latest.release))
  const snapshot = computed(() => !data.value ? undefined : data.value.versions.find(v => v.id === data.value!.latest.snapshot))

  return {
    error,
    versions,
    isValidating,
    release,
    snapshot,
    mutate,
  }
}

export function useFabricVersions(minecraftVersion: Ref<string>) {
  const { data: allVersions, isValidating, mutate, error } = useSWRVModel(getFabricLoaderVersionsModel(),
    inject(kSWRVConfig))

  const { data: int } = useSWRVModel(getFabricGameVersionsModel(), inject(kSWRVConfig))

  const versions = computed(() => {
    if (!int.value || !int.value.includes(minecraftVersion.value)) {
      return []
    }
    const all = allVersions.value
    if (!all) return []
    return all
  })

  return {
    error,
    versions,
    mutate,
    isValidating,
  }
}

export function getFabricGameVersionsModel() {
  return {
    key: computed(() => '/fabric-game-versions'),
    fetcher: async () => {
      const int = await Promise.any([
        getJson<{ version: string }[]>('https://meta.fabricmc.net/v2/versions/game'),
        getJson<{ version: string }[]>('https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/game'),
      ])
      return int.map(v => v.version)
    },
  }
}

export function getFabricLoaderVersionsModel() {
  return {
    key: computed(() => '/fabric-versions'),
    fetcher: async () => {
      const loaders = await Promise.any([
        getJson<FabricArtifactVersion[]>('https://meta.fabricmc.net/v2/versions/loader'),
        getJson<FabricArtifactVersion[]>('https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader'),
      ])

      return loaders.map(markRaw)
    },
  }
}

export function useLabyModManifest() {
  return useSWRVModel(getLabyModManifestModel(),
    inject(kSWRVConfig))
}

export function getLabyModManifestModel() {
  return {
    key: '/labymod',
    fetcher: async () => {
      return getJson<LabyModManifest>('https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/manifest/production/latest.json')
    },
  }
}

export function getQuiltGameVersionsModel() {
  return {
    key: computed(() => '/quilt-game-versions'),
    fetcher: async () => {
      const int = await Promise.any([
        getJson<{ version: string }[]>('https://meta.quiltmc.org/v3/versions/game'),
        getJson<{ version: string }[]>('https://bmclapi2.bangbang93.com/quilt-meta/v3/versions/game'),
      ])
      return int.map(v => v.version)
    },
  }
}

export function getQuiltLoaderVersionsModel() {
  return {
    key: computed(() => '/quilt-versions'),
    fetcher: async () => {
      const loaders = await Promise.any([
        getJson<FabricArtifactVersion[]>('https://meta.quiltmc.org/v3/versions/loader'),
        getJson<FabricArtifactVersion[]>('https://bmclapi2.bangbang93.com/quilt-meta/v3/versions/loader'),
      ])

      return loaders.map(markRaw)
    },
  }
}

export function useQuiltVersions(minecraftVersion: Ref<string>) {
  const { data: allVersions, isValidating, mutate, error } = useSWRVModel(getQuiltLoaderVersionsModel(),
    inject(kSWRVConfig))

  const { data: int } = useSWRVModel(getQuiltGameVersionsModel(), inject(kSWRVConfig))

  const versions = computed(() => {
    if (!int.value || !int.value.includes(minecraftVersion.value)) {
      return []
    }
    const all = allVersions.value
    if (!all) return []
    return all
  })

  return {
    error,
    versions,
    mutate,
    isValidating,
  }
}

export function useNeoForgedVersions(minecraft: Ref<string>) {
  const { data, isValidating, mutate, error } = useSWRVModel(getNeoForgedVersionModel(minecraft),
    inject(kSWRVConfig))

  const recommended = computed(() => {
    return ''
  })
  const latest = computed(() => {
    const vers = data.value
    if (!vers) return undefined
    return vers[0] ?? ''
  })
  const versions = computed(() => {
    const vers = data.value
    if (!vers) return []
    return vers
  })

  return {
    error,
    versions,
    mutate,
    isValidating,
    recommended,
    latest,
  }
}

export function getNeoForgedVersionModel(minecraft: MaybeRef<string>) {
  return {
    key: computed(() => `/neoforged-versions/${get(minecraft)}`),
    fetcher: async () => {
      const content = await Promise.any([
        getJson<{ versions: string[] }>('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge')
          .then((v) => v.versions.filter(v => v.startsWith(get(minecraft).substring(2)))),
        getJson<{ version: string }[]>(`https://bmclapi2.bangbang93.com/neoforge/list/${get(minecraft)}`)
          .then(v => v.map(v => v.version)),
      ])
      return content
    },
  }
}

export function useForgeVersions(minecraftVersion: Ref<string>) {
  const { data: versions, isValidating, mutate, error } = useSWRVModel(getForgeVersionsModel(minecraftVersion), inject(kSWRVConfig))

  const recommended = computed(() => {
    const vers = versions.value
    if (!vers) return undefined
    return vers.find(v => v.type === 'recommended')
  })
  const latest = computed(() => {
    const vers = versions.value
    if (!vers) return undefined
    return vers.find(v => v.type === 'latest')
  })

  return {
    error,
    versions,
    mutate,
    isValidating,
    recommended,
    latest,
  }
}

export function getForgeVersionsModel(minecraftVersion: MaybeRef<string>) {
  return {
    key: computed(() => '/forge-versions/' + get(minecraftVersion)),
    fetcher: async () => {
      const version = get(minecraftVersion)
      if (!version) {
        return []
      }
      const result = await Promise.any([
        fetch(`https://files.minecraftforge.net/net/minecraftforge/forge/index_${get(minecraftVersion)}.html`)
          .then((res) => res.ok ? res.text() : '')
          .then((text) => {
            // parse text as HTML
            if (!text) return []
            return parse(text)
          }),
        getJson<any[]>(`https://bmclapi2.bangbang93.com/forge/minecraft/${get(minecraftVersion)}`)
          .then(forges => forges.map(v => ({
            mcversion: v.mcversion,
            version: v.version,
            type: 'common',
            date: v.modified,
          } as ForgeVersion))),
      ])
      return result
    },
  }
}

export function useOptifineVersions() {
  const { data: allVersions, isValidating, mutate, error } = useSWRVModel(getOptifineVersionsModel(),
    inject(kSWRVConfig))

  const versions = computed(() => allVersions.value ?? [])

  return {
    error,
    versions,
    isValidating,
    mutate,
  }
}

export function getOptifineVersionsModel() {
  return {
    key: '/optifine-versions',
    fetcher: async () => {
      const versions = await getJson<OptifineVersion[]>('https://bmclapi2.bangbang93.com/optifine/versionList')
      return versions.map(markRaw)
    },
  }
}
