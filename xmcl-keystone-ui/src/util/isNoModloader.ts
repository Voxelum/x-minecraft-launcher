import { RuntimeVersions } from '@xmcl/instance'

export function isNoModLoader(runtime: RuntimeVersions) {
  const noModLoader = !runtime.forge && !runtime.fabricLoader && !runtime.quiltLoader &&
    !runtime.liteLoader && !runtime.neoForged
  return noModLoader
}
