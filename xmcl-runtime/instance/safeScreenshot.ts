import { lstat } from 'fs/promises'
import { extname, isAbsolute, join, parse, relative, resolve } from 'path'

/** Require an existing regular image immediately inside the selected screenshot root. */
export async function safeScreenshotPath(instancePath: string, url: string): Promise<string> {
  const parsed = new URL(url)
  const requested = parsed.searchParams.get('path')
  if (parsed.origin !== 'http://launcher' || parsed.pathname !== '/media' || !requested || !isAbsolute(requested)) {
    throw new Error('Invalid screenshot URL')
  }
  const root = resolve(instancePath, 'screenshots')
  const target = resolve(requested)
  const name = relative(root, target)
  if (!name || name.includes('/') || name.includes('\\') || name.includes(':') || name.includes('\0') || name === '..' || isAbsolute(name) ||
    !['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'].includes(extname(name).toLowerCase())) {
    throw new Error('Screenshot is outside the selected instance')
  }
  await assertScreenshotDirectory(root)
  const info = await lstat(target)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('Screenshot is not a regular file')
  return target
}

/** Check all existing ancestors, including a symlinked screenshots directory. */
export async function assertScreenshotDirectory(directory: string): Promise<void> {
  const target = resolve(directory)
  const anchor = parse(target).root
  let current = anchor
  for (const component of relative(anchor, target).split(/[\\/]/)) {
    current = join(current, component)
    const info = await lstat(current).catch((e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT') return undefined
      throw e
    })
    if (info && (!info.isDirectory() || info.isSymbolicLink())) {
      throw new Error('Screenshot directory contains a link or incompatible file type')
    }
  }
}
