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

export async function getFiles(dir: string, domain?: ResourceDomain) {
  if (domain === ResourceDomain.Blueprints) {
    async function collect(currentDir: string) {
      const entries: File[] = []
      const files = await readdir(currentDir, { withFileTypes: true })
      for (const file of files) {
        if (shouldIgnoreFile(file.name, domain) || file.name.endsWith('.txt')) continue
        const path = join(currentDir, file.name)
        if (file.isDirectory()) {
          entries.push(...await collect(path))
        } else {
          const entry = await getFile(path, file.name)
          if (entry) entries.push(entry)
        }
      }
      return entries
    }

    return collect(dir)
  }

  const files = await readdir(dir)
  const entries = await Promise.all(
    files.map(async (file) => {
      if (shouldIgnoreFile(file, domain)) return
      if (file.endsWith('.txt')) return
      const path = join(dir, file)
      return getFile(path, file)
    }),
  ).then((f) => f.filter((v): v is File => !!v))
  return entries
}
