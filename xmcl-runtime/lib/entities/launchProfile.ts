import { readJson } from 'fs-extra'
import { join } from 'path'

export interface LauncherProfile {
  /**
   * All the launcher profiles and their configurations.
   */
  profiles: {
    [name: string]: {
      name: string
      /**
       * The profile type.
       * Types are custom (manually created by the user),
       * latest-release (uses the latest stable release),
       * and latest-snapshot (uses the latest build of Minecraft).
       */
      type: string
      gameDir: string
      javaDir: string
      javaArgs: string
      /**
       * The version ID that the profile targets. Version IDs are determined in the version.json in every directory in ~/versions
       */
      lastVersionId: string
      /**
       * An Base64-encoded image which represents the icon of the profile in the profiles menu.
       */
      icon: string
      created: string
      /**
       * An ISO 8601 formatted date which represents the last time the profile was used.
       */
      lastUsed: string
    }
  }
  clientToken: string
  /**
   * All the logged in accounts.
   * Every account in this key contains a UUID-hashed map (which is used to save the selected user)
   * which in turn includes the access token, e-mail, and a profile (which contains the account display name)
   */
  authenticationDatabase: {
    [uuid: string]: {
      accessToken: string
      username: string
      profiles: {
        [uuid: string]: {
          displayName: string
        }
      }
      properties: object[]
    }
  }
  settings: {}
  /**
   * Contains the UUID-hashed account and the UUID of the currently selected user
   */
  selectedUser: {
    /**
     * The UUID-hashed key of the currently selected account
     */
    account: string
    /**
     * The UUID of the currently selected player
     */
    profile: string
  }
}

export async function readLaunchProfile(minecraft: string) {
  const profilePath = join(minecraft, 'launcher_profiles.json')
  const profile: LauncherProfile = await readJson(profilePath)
  return profile
}
