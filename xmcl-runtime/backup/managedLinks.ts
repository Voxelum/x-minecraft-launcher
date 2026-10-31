import { readlink } from 'fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'path'

/** Only launcher-created, top-level read-mostly instance cache links. Values
 * come from this app's game-data resolver, never the archive or renderer. */
export type ManagedRestoreLinks = Partial<Record<'libraries' | 'versions', string>>
export function validateManagedRestoreLinks(links?: ManagedRestoreLinks): void {
  if (links === undefined) return
  if (!links || typeof links !== 'object' || Array.isArray(links)) throw new Error('Invalid managed restore links')
  for (const [name, target] of Object.entries(links)) {
    if (!['libraries', 'versions'].includes(name) || typeof target !== 'string' || !isAbsolute(target) || resolve(target) !== target) throw new Error('Invalid managed restore link mapping')
  }
}
function canonicalTarget(text: string): string | undefined {
  // Match only the absolute canonical spelling used by the launcher. Resolving
  // arbitrary dot segments is unsafe: /var/../x can traverse a symlink before
  // the .. component and name something different from lexical path.resolve.
  let clean = text
  if (process.platform === 'win32') {
    clean = clean.replace(/^\\\\\?\\UNC\\/i, '\\\\').replace(/^\\\\\?\\/, '')
    while (clean.endsWith(sep) && clean.length > 3) clean = clean.slice(0, -1)
  }
  return isAbsolute(clean) && resolve(clean) === clean ? clean : undefined
}
export async function readManagedRestoreLink(root: string, path: string, links?: ManagedRestoreLinks): Promise<string> {
  const name = relative(root, path)
  if (dirname(path) !== root || !['libraries', 'versions'].includes(name)) throw new Error(`Unknown restore link: ${path}`)
  const expected = links?.[name as keyof ManagedRestoreLinks]
  if (!expected) throw new Error(`Unapproved restore link: ${path}`)
  const text = await readlink(path)
  if (canonicalTarget(text) !== expected) throw new Error(`Managed restore link points outside its cache root: ${path}`)
  // Do not stat/realpath/readdir/open the target. Preserve only the link itself.
  return text
}
