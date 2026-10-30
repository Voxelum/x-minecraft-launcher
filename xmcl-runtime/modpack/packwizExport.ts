import type { PackwizFileMeta, PackwizIndexManifest } from '@xmcl/instance'
import type { ExportFileDirective } from '@xmcl/runtime-api'
import { createHash } from 'node:crypto'
import { posix } from 'node:path'
import { stringify } from 'smol-toml'
import type { ZipFile } from 'yazl'

// A Packwiz metadata filename is relative to the metadata's directory, not the pack root.
export function addPackwizMetadata(zip: ZipFile, path: string, meta: PackwizFileMeta): PackwizIndexManifest['files'][number] {
  const buffer = Buffer.from(stringify({ ...meta, filename: posix.basename(path) }))
  const file = `${path}.pw.toml`
  zip.addBuffer(buffer, file)
  return { file, hash: createHash('sha256').update(buffer).digest('hex'), metafile: true }
}

export function validatePackwizPaths(files: ExportFileDirective[]) {
  const seen = new Set(['pack.toml', 'index.toml'])
  for (const { path } of files) {
    if (seen.has(path) || seen.has(`${path}.pw.toml`)) {
      throw new Error(`Packwiz export has conflicting destination: ${path}`)
    }
    seen.add(path)
    seen.add(`${path}.pw.toml`)
  }
}

export function addPackwizOverride(zip: ZipFile, file: ExportFileDirective, buffer: Buffer): PackwizIndexManifest['files'][number] {
  // Index entries for raw files cannot express side restrictions. Never silently
  // install a server-only config on clients (or a client-only config on servers).
  if (file.env?.client === 'unsupported' || file.env?.server === 'unsupported') {
    throw new Error(`Packwiz cannot preserve side restrictions for raw file: ${file.path}`)
  }
  zip.addBuffer(buffer, file.path)
  return { file: file.path, hash: createHash('sha256').update(buffer).digest('hex') }
}

export function getPackwizSide(file: ExportFileDirective): 'client' | 'server' | 'both' {
  if (file.env?.client === 'unsupported' && file.env?.server === 'unsupported') {
    throw new Error(`Packwiz file is unsupported on both sides: ${file.path}`)
  }
  return file.env?.client === 'unsupported' ? 'server' : file.env?.server === 'unsupported' ? 'client' : 'both'
}
