import { injection } from '@/util/inject';
import { ProjectGallery } from '@xmcl/modrinth';
import { InstallMarketOptions, Instance, InstanceInstallServiceKey, InstanceUpstream, ModpackServiceKey, waitModpackFiles } from '@xmcl/runtime-api';
import { InjectionKey } from 'vue';
import { getCurseforgeProjectModel } from './curseforge';
import { kInstances } from './instances';
import { getModrinthProjectModel } from './modrinthProject';
import { getModrinthVersionModel } from './modrinthVersions';
import { useService } from './service';
import { useSWRVModel } from './swrv';
import { kSWRVConfig } from './swrvConfig';

export const kInstanceUpstream: InjectionKey<ReturnType<typeof useInstanceUpstream>> = Symbol('InstanceUpstream');

export function useInstanceUpstream(instance: Ref<Instance>, { edit } = injection(kInstances)) {
  const config = injection(kSWRVConfig)
  const upstream = computed(() => instance.value?.upstream)
  const modirnthId = computed(() => upstream.value?.type === 'modrinth-modpack' ? upstream.value.projectId : undefined)
  const curseforgeId = computed(() => upstream.value?.type === 'curseforge-modpack' ? upstream.value.modId : undefined)
  const modrinthProject = useSWRVModel(getModrinthProjectModel(modirnthId), config)
  const curseforgeProject = useSWRVModel(getCurseforgeProjectModel(curseforgeId), config)
  const modrinthVersions = useSWRVModel(getModrinthVersionModel(modirnthId, undefined, undefined, undefined))

  const modrinthLatestVersion = computed(() => {
    const versions = modrinthVersions.data.value
    if (!modrinthProject.data.value || !versions) {
      return undefined
    }
    return versions.sort((a, b) => {
      return new Date(b.date_published).getTime() - new Date(a.date_published).getTime()
    }
    )[0]
  })
  const curseforgeLatestVersion = computed(() => {
    if (!curseforgeProject.data.value) {
      return undefined
    }
    return curseforgeProject.data.value.latestFiles[0]
  })
  const isUpToDate = computed(() => {
    if (!upstream.value) {
      return true
    }
    if (upstream.value.type === 'modrinth-modpack') {
      const latest = modrinthLatestVersion.value
      if (!latest) {
        return true
      }
      return upstream.value.versionId === latest.id
    } else if (upstream.value.type === 'curseforge-modpack') {
      const latest = curseforgeLatestVersion.value
      if (!latest) {
        return true
      }
      return upstream.value.fileId === latest.id
    }
    return true
  })

  function parseBackgroundDescription(description: string) {
    const splited = description.split(',').map((s) => s.trim())
    const isBackground = splited.some(b => b === 'background')
    const blur = splited.find(b => b.startsWith('blur'))?.slice(5)
    return isBackground ? {
      isBackground,
      blur: blur ? parseInt(blur, 10) : undefined,
    } : undefined
  }

  const updating = shallowRef({} as Record<string, boolean>)
  const { installModapckFromMarket } = useService(ModpackServiceKey)
  const { openModpack } = useService(ModpackServiceKey)
  const { installInstanceFiles } = useService(InstanceInstallServiceKey)
  async function updateToLatest() {
    const instancePath = instance.value?.path
    const upstream = instance.value?.upstream
    const taskId = `instance-upstream-update-${instancePath}`
    if (!instancePath || !upstream) {
      return
    }
    if (updating.value[taskId]) {
      return
    }
    try {
      updating.value[taskId] = true
      let options: InstallMarketOptions | undefined
      let newUpstream: InstanceUpstream | undefined
      if (modrinthLatestVersion.value) {
        const proj = modrinthProject.data.value!
        const version = { versionId: modrinthLatestVersion.value.id, icon: proj.icon_url }
        newUpstream = {
          type: 'modrinth-modpack',
          versionId: version.versionId,
          projectId: proj.id,
        } as InstanceUpstream
        options = {
          market: 0,
          version,
        } as InstallMarketOptions
      } else if (curseforgeLatestVersion.value) {
        options = {
          market: 1,
          file: { fileId: curseforgeLatestVersion.value.id, icon: curseforgeProject.data.value?.logo.url },
        }
        newUpstream = {
          type: 'curseforge-modpack',
          modId: curseforgeProject.data.value!.id,
          fileId: curseforgeLatestVersion.value.id,
        } as InstanceUpstream
      } else {
        return
      }
      const [result] = await installModapckFromMarket(options)
      const state = await openModpack(result)
      await waitModpackFiles(state)
      await installInstanceFiles({
        path: instancePath,
        files: state.files,
        upstream: newUpstream,
        id: taskId,
      })
      await edit({
        instancePath,
        ...state.config,
      })
    } finally {
      updating.value[taskId] = false
    }
  }
  const installing = computed(() => {
    return updating.value[`instance-upstream-update-${instance.value?.path}`] || false
  })

  const background = computed(() => {
    if (!upstream.value) {
      return undefined
    }
    if (upstream.value.type === 'modrinth-modpack') {
      const proj = modrinthProject.data.value
      if (proj) {
        let featured = undefined as undefined | ProjectGallery
        for (const gallery of proj.gallery) {
          if (gallery.featured) {
            featured = gallery
          }
          const parsed = parseBackgroundDescription(gallery.description)
          if (parsed) {
            return {
              url: gallery.raw_url,
              blur: parsed.blur || 0,
            }
          }
        }
        const found = featured || proj.gallery[0]
        return !found ? undefined : {
          url: found.raw_url,
          blur: 0,
        }
      }
    } else if (upstream.value.type === 'curseforge-modpack') {
      const proj = curseforgeProject.data.value
      if (proj) {
        for (const file of proj.screenshots) {
          const parsed = parseBackgroundDescription(file.description)
          if (parsed) {
            return {
              url: file.url,
              blur: parsed.blur || 0,
            }
          }
        }
      }
      const firstScreenshot = proj?.screenshots[0]
      return firstScreenshot ? {
        url: firstScreenshot.url,
        blur: 0,
      } : undefined
    }
  })

  return {
    background,
    modrinthProject,
    curseforgeProject,
    modrinthVersions,
    isUpToDate,
    updateToLatest,
    installing,
  }
}