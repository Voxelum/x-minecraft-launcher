import { FileHash } from '@xmcl/curseforge'

export function guessCurseforgeFileUrl(id: number, name: string) {
  const fileId = id.toString()
  return [`https://edge.forgecdn.net/files/${fileId.slice(0, 4)}/${fileId.slice(4)}/${name}`, `https://mediafiles.forgecdn.net/files/${fileId.slice(0, 4)}/${fileId.slice(4)}/${name}`]
}

export function resolveCurseforgeHash(hashes: FileHash[]) {
  const hash = (hashes || [])[0]
  if (hash) {
    const algo = hash.algo === 1 ? 'sha1' : hash.algo === 2 ? 'md5' : undefined
    if (algo) {
      if (hash.value.length !== 40 && algo === 'sha1') {
        return undefined
      }
      if (hash.value.length !== 32 && algo === 'md5') {
        return undefined
      }
      return { algorithm: algo, hash: hash.value }
    }
  }
}
