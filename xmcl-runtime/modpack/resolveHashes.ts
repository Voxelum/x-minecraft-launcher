import { File, HashAlgo } from '@xmcl/curseforge'

export function resolveHashes(file: File) {
  const hashes: Record<string, string> = {}
  if (file.hashes && typeof file.hashes === 'object') {
    for (const h of file.hashes) {
      if (h.algo === HashAlgo.Sha1) {
        hashes.sha1 = h.value
      } else if (h.algo === HashAlgo.Md5) {
        hashes.md5 = h.value
      }
    }
  }
  return hashes
}
