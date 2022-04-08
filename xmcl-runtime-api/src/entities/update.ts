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

  useAutoUpdater: boolean
  newUpdate: boolean
  /**
   * Is incremental asar release.
   */
  incremental: boolean
}
