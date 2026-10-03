import type { InstanceFile } from '@xmcl/instance'

/** Keep the final overlay for each Windows path without merging Linux files. */
export function deduplicateInstanceFiles(files: InstanceFile[], platform = process.platform): InstanceFile[] {
  if (platform !== 'win32') return files
  const seen = new Map<string, InstanceFile>()
  for (const file of files) seen.set(file.path.toLowerCase(), file)
  return [...seen.values()]
}
