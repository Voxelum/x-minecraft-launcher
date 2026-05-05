import path from 'path'

let existedFiles = [] as string[]
let checksums: Record<string, string> = {}

/** @ignore */
export function exists(name: string) {
  return Promise.resolve(existedFiles.indexOf(name) !== -1)
}
/** @ignore */
export function checksum(name: string, algorithm: string) {
  return Promise.resolve(checksums[name])
}
/** @ignore */
export function __addChecksum(record: object) {
  for (const [k, v] of Object.entries(record)) {
    checksums[path.join(/* root, */ k)] = v
  }
}
/** @ignore */
export function __addExistedFile(name: string) {
  existedFiles.push(path.join(/* root, */ name))
}
/** @ignore */
export function __reset() {
  checksums = {}
  existedFiles = []
}
/** @ignore */
export function isNotNull(v: any) {
  return !!v
}
