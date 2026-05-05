import type { ResolvedLibrary, Version } from '@xmcl/core'
import type { InstallProfile } from './profile'

export class InstallError extends Error {
  constructor(
    public issue: InstallIssue = {},
    message: string = '',
    cause?: Error,
  ) {
    super(message, { cause })
    this.name = 'InstallError'
  }
}

export interface InstallIssue {
  /**
   * bad minecraft jar
   */
  jar?: string
  /**
   * bad forge install
   */
  forge?: {
    minecraft: string
    version: string
  }
  /**
   * libraries requires to install
   */
  libraries?: ResolvedLibrary[]
  /**
   * assets that failed to install
   */
  assets?: { name: string; hash: string; size: number }[]
  /**
   * bad assets index
   */
  assetsIndex?: Version.AssetIndex

  profile?: InstallProfile
  /**
   * optifine version that failed to install. e.g. "1.12.2_HD_U_G6_pre1"
   */
  optifine?: string
}

export function mergeInstallIssue(target: InstallIssue, source: InstallIssue) {
  if (source.jar) {
    target.jar = source.jar
  }
  if (source.assetsIndex) {
    target.assetsIndex = source.assetsIndex
  }
  if (source.libraries) {
    target.libraries = (target.libraries ?? []).concat(source.libraries)
  }
  if (source.assets) {
    target.assets = (target.assets ?? []).concat(source.assets)
  }
  if (source.forge) {
    target.forge = source.forge
  }
  if (source.profile) {
    target.profile = source.profile
  }
  if (source.optifine) {
    target.optifine = source.optifine
  }
  return target
}

export function isInstallError(e: any): e is InstallError {
  return e instanceof InstallError || (e && typeof e === 'object' && 'issue' in e && e.issue && e.name === 'InstallError')
}
