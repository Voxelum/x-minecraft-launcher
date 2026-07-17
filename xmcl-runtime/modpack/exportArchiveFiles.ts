import type { ExportFileDirective } from '@xmcl/runtime-api'
import type { ZipFile } from 'yazl'

export interface ModpackExportArchives {
  curseforge?: ZipFile
  curseforgeServer?: ZipFile
  modrinth?: ZipFile
}

export function isServerOnlyExportFile(file: ExportFileDirective) {
  return file.env?.client === 'unsupported' && file.env.server !== 'unsupported'
}

export function getModrinthProfileFiles(
  files: ExportFileDirective[],
  profile: 'universal' | 'client' | 'server',
) {
  const clientFiles = files.filter(file => !isServerOnlyExportFile(file))
  const serverFiles = files.filter(isServerOnlyExportFile)
  if (profile === 'universal') return [...clientFiles, ...serverFiles]
  return (profile === 'client' ? clientFiles : serverFiles)
    .filter(file => file.env?.[profile] !== 'unsupported')
    .map(file => ({ ...file, env: undefined }))
}

export function addExportFileAsOverride(
  archives: ModpackExportArchives,
  source: string,
  file: ExportFileDirective,
) {
  if (isServerOnlyExportFile(file)) {
    archives.curseforgeServer?.addFile(source, file.path)
  } else {
    archives.curseforge?.addFile(source, `overrides/${file.path}`)
  }

  const modrinthDirectory = file.env?.client === 'unsupported'
    ? 'server-overrides'
    : file.env?.server === 'unsupported'
      ? 'client-overrides'
      : 'overrides'
  archives.modrinth?.addFile(source, `${modrinthDirectory}/${file.path}`)
}