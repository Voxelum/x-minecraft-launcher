import { readdir, stat } from 'fs-extra'
import { basename, join } from 'path'
import { File } from '../File'
import { ResourceDomain } from '../ResourceDomain'
import { shouldIgnoreFile } from './shouldIgnoreFile'

export async function getFile(path: string, fileName = basename(path)) {
  const fstat = await stat(path).catch(() => null)
  if (!fstat) return
  const entry: File = {
    path,
    fileName,
    size: fstat.size,
    mtime: fstat.mtimeMs,
    ctime: fstat.ctimeMs,
    atime: fstat.atimeMs,
    isDirectory: fstat.isDirectory(),
    ino: fstat.ino,
  }
  return entry
}

export async function getFiles(dir: string, domain?: ResourceDomain): Promise<File[]> {
  const files = await readdir(dir)
  const entries: Array<File | File[] | undefined> = await Promise.all(
    files.map(async (file) => {
      if (shouldIgnoreFile(file, domain)) return
      if (file.endsWith('.txt')) return
      const path = join(dir, file)
      const entry = await getFile(path, file)
      if (!entry) return
      if (domain === ResourceDomain.Blueprints && entry.isDirectory) {
        return getFiles(path, domain)
      }
      return entry
    }),
  )
  return entries.flat().filter((v): v is File => !!v)
}
