import { RuntimeVersions } from '@xmcl/runtime-api'

export function isNoModLoader(runtime: RuntimeVersions) {
  const noModLoader = !runtime.forge && !runtime.fabricLoader && !runtime.quiltLoader &&
    !runtime.liteLoader && !runtime.neoForged
  return noModLoader
}
