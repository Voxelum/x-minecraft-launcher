import { lstat } from 'fs/promises'
import { isAbsolute, join, parse, relative, resolve } from 'path'

/** Resolve an untrusted archive name without following existing links below root. */
export async function safeBackupPath(root: string, name: string): Promise<string> {
  const parts = name.split(/[\\/]/)
  if (!name || isAbsolute(name) || parts.some(p => !p || p === '.' || p === '..' || (p.includes(':') || p.includes('\0')))) {
    throw new Error('Invalid backup path')
  }
  const base = resolve(root)
  const target = resolve(base, ...parts)
  const rel = relative(base, target)
  if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw new Error('Backup path escapes its root')
  }
  const anchor = parse(base).root
  const components = relative(anchor, target).split(/[\\/]/)
  let current = anchor
  for (let i = 0; i < components.length; i++) {
    current = join(current, components[i])
    const info = await lstat(current).catch((e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') return undefined
      throw e
    })
    if (!info) continue
    if (info.isSymbolicLink() || (i < components.length - 1 ? !info.isDirectory() : !info.isFile())) {
      throw new Error('Backup target contains a link or incompatible file type')
    }
  }
  return target
}

export function validateInstanceFolder(name: string): void {
  if (!name || (/[\\/:]/.test(name) || name.includes('\0')) || name === '.' || name === '..') {
    throw new Error('Invalid backup instance folder')
  }
}
