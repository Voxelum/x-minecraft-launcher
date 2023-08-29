import { getFTBPath } from '@/util/ftb'
import { resolveModpackInstanceConfig } from '@/util/modpackFilesResolver'
import { CachedFTBModpackVersionManifest, InstanceFile, InstanceManifest, JavaRecord, ModpackInstallProfile, ModpackServiceKey, PeerConnection, Resource } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { DialogKey } from './dialog'
import { useService } from './service'

export const AddInstanceDialogKey: DialogKey<string> = 'add-instance-dialog'

export interface Template {
  filePath: string
  name: string
  instance: ModpackInstallProfile['instance']
  type: 'curseforge' | 'mcbbs' | 'modpack' | 'modrinth' | 'instance' | 'ftb' | 'peer'
  description: string
  files: InstanceFile[]
  loadFiles: () => Promise<InstanceFile[]>
}

export function useInstanceTemplates(javas: Ref<JavaRecord[]>, modpackResources: Ref<Resource[]>, peers: Ref<PeerConnection[]>, ftb: Ref<CachedFTBModpackVersionManifest[]>) {
  const { t } = useI18n()
  const { getModpackInstallFiles } = useService(ModpackServiceKey)

  const templates = computed(() => {
    const all = [] as Array<Template>
    for (const resource of modpackResources.value) {
      const config = resolveModpackInstanceConfig(resource)
      const type = resource.metadata['modrinth-modpack']
        ? 'modrinth'
        : resource.metadata['curseforge-modpack']
          ? 'curseforge'
          : resource.metadata['mcbbs-modpack'] ? 'mcbbs' : 'modpack'
      if (config) {
        let promise: Promise<InstanceFile[]> | undefined
        const result: Template = reactive({
          filePath: resource.path,
          name: config.name,
          instance: markRaw(config),
          description: computed(() => getActionText(type)),
          type,
          files: [],
          loadFiles: () => {
            if (!promise) {
              promise = getModpackInstallFiles(resource.path)
            }
            return promise
          },
        })
        all.push(result)
      }
    }

    for (const c of peers.value) {
      if (c.sharing) {
        all.push(getPeerTemplate(c.id, c.userInfo.name, c.sharing))
      }
    }

    for (const f of ftb.value) {
      all.push(getFtbTemplate(f))
    }

    return all
  })

  const getActionText = (type: string) => {
    if (type === 'mcbbs') return t('instanceTemplate.mcbbs')
    if (type === 'curseforge') return t('instanceTemplate.curseforge')
    if (type === 'modrinth') return t('instanceTemplate.modrinth')
    return t('instanceTemplate.modpack')
  }

  function getPeerTemplate(id: string, name: string, man: InstanceManifest) {
    const result: Template = {
      filePath: id,
      name: `${man.name ?? 'Instance'}@${name}`,
      description: '',
      instance: {
        name: `${man.name ?? 'Instance'}@${name}`,
        description: man.description,
        runtime: {
          minecraft: man.runtime.minecraft,
          forge: man.runtime.forge ?? '',
          fabricLoader: man.runtime.fabricLoader ?? '',
          quiltLoader: man.runtime.quiltLoader ?? '',
          optifine: man.runtime.optifine ?? '',
          yarn: '',
          liteloader: '',
        },
        vmOptions: man.vmOptions,
        mcOptions: man.mcOptions,
        minMemory: man.minMemory,
        maxMemory: man.maxMemory,
      },
      files: man.files,
      loadFiles: () => Promise.resolve(man.files),
      type: 'peer',
    }

    return result
  }

  function getFtbTemplate(man: CachedFTBModpackVersionManifest): Template {
    const getVersion = (str?: string) => {
      if (!str) { return undefined }
      const match = /(\d+)\.(\d)+\.(\d+)(_\d+)?/.exec(str)
      if (match === null) { return undefined }
      if (match[1] === '1') {
        return {
          version: str,
          majorVersion: Number.parseInt(match[2]),
          patch: Number.parseInt(match[4].substring(1)),
        }
      }
      return {
        version: str,
        majorVersion: Number.parseInt(match[1]),
        patch: Number.parseInt(match[3]),
      }
    }

    const getRuntime = () => {
      const javaRuntime = man.targets.find(v => v.name === 'java')
      if (javaRuntime) {
        const parsedVersion = getVersion(javaRuntime.version)
        if (!parsedVersion) {
          return
        }
        const majorMatched = javas.value.filter(v => v.majorVersion === parsedVersion.majorVersion)
        let selectedRecord = majorMatched[0]
        for (const v of majorMatched.slice(1)) {
          const currentPatch = getVersion(v.version)?.patch
          const selectedPatch = getVersion(selectedRecord.version)?.patch
          if (!currentPatch || !selectedPatch) continue
          const diff = Math.abs(currentPatch - parsedVersion.patch)
          const selectedDiff = Math.abs(selectedPatch - parsedVersion.patch)
          if (diff < selectedDiff) {
            selectedRecord = v
          }
        }
        if (selectedRecord) {
          return selectedRecord.path
        }
      }
    }
    const runtime = {
      minecraft: man.targets.find(f => f.name === 'minecraft')?.version || '',
      forge: man.targets.find(f => f.name === 'forge')?.version || '',
      fabricLoader: '',
      quiltLoader: '',
      optifine: '',
      liteloader: '',
      yarn: '',
    }
    const files = markRaw(man.files.map(f => ({
      path: getFTBPath(f),
      hashes: {
        sha1: f.sha1,
      },
      curseforge: f.curseforge
        ? {
          projectId: f.curseforge.project,
          fileId: f.curseforge.file,
        }
        : undefined,
      downloads: f.url ? [f.url] : undefined,
      size: f.size,
    })))
    return reactive({
      filePath: `${man.parent}-${man.id.toString()}`,
      name: '',
      description: computed(() => t('instanceTemplate.ftb')),
      instance: markRaw({
        name: `${man.projectName}-${man.name}`,
        author: man.authors[0].name,
        java: getRuntime() ?? '',
        runtime,
        upstream: {
          type: 'ftb-modpack',
          id: man.id,
        },
        icon: man.iconUrl,
      }),
      loadingFiles: false,
      loadFiles: () => Promise.resolve(files),
      files,
      type: 'ftb',
    })
  }

  return {
    templates,
  }
}
