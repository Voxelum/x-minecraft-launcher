/* eslint-disable camelcase */

export interface ReleaseFile {
  /**
   * The file name
   */
  name: string
  /**
   * The file download url
   */
  url: string
  /** Set on Vardrynn releases: the signed fields needed to re-verify the file offline. */
  platform?: string
  arch?: string
  sha256?: string
  signature?: string
}

/**
 * The operations for the update electron app
 */
export const enum ElectronUpdateOperation {
  /**
   * Use electron auto updater to update
   */
  AutoUpdater = 'autoupdater',
  /**
   * Use asar incremental update
   */
  Asar = 'asar',
  /**
   * Ask user to manually update
   */
  Manual = 'manual',
  /**
   * Use appx update
   */
  Appx = 'appx',
  /**
   * Download a signed Vardrynn package, verify it and hand it to the OS installer
   */
  Verified = 'verified',
}

export interface ReleaseInfo {
  /**
   * The version name.
   */
  name: string
  /**
   * The version body. Might be markdown
   */
  body: string
  /**
   * The date string of the release
   */
  date: string
  /**
   * The files of the releases
   */
  files: Array<ReleaseFile>
  /**
   * Is this a new update compare to the current version.
   */
  newUpdate: boolean
  /**
   * The suggested operation for the update
   */
  operation: string
}

/** Explicit host limitation, independent of release discovery and update status.
 * Omitted by existing adapters to preserve their current behavior.
 */
export interface UpdateCapability {
  automatic: false
  reason: 'not-implemented' | 'not-configured'
}
