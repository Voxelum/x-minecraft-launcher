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
