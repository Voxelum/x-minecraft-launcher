import { FTBFile } from '@xmcl/runtime-api'

export function getFTBPath(file: FTBFile) {
  const name = file.name.startsWith('/') ? file.name.substring(1) : file.name
  const path = file.path.replace('./', '') + name
  return path
}
