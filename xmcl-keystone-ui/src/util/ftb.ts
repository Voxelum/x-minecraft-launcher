import { Template } from '@/composables/instanceTemplates'
import { CachedFTBModpackVersionManifest, FTBFile, InstanceFile, JavaRecord, ModpackInstallProfile } from '@xmcl/runtime-api'

export function getFTBPath(file: FTBFile) {
  const name = file.name.startsWith('/') ? file.name.substring(1) : file.name
  const path = file.path.replace('./', '') + name
  return path
}

export function getFTBTemplateAndFile(man: CachedFTBModpackVersionManifest, javas: JavaRecord[]) {
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
      const majorMatched = javas.filter(v => v.majorVersion === parsedVersion.majorVersion)
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
    fabricLoader: man.targets.find(f => f.name === 'fabric')?.version || '',
    quiltLoader: man.targets.find(f => f.name === 'quilt')?.version || '',
    neoForged: man.targets.find(f => f.name === 'neoforge')?.version || '',
    optifine: '',
    liteloader: '',
    yarn: '',
  }
  const files: InstanceFile[] = markRaw(man.files.map(f => ({
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

  return [{
    name: `${man.projectName}-${man.name}`,
    author: man.authors[0].name,
    java: getRuntime() ?? '',
    runtime,
    upstream: {
      type: 'ftb-modpack',
      id: man.parent,
      versionId: man.id,
    },
    icon: man.iconUrl,
  } as ModpackInstallProfile['instance'], files] as const
}
