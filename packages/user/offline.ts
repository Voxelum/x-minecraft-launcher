import { v4 } from 'uuid'
import { getOfflineUUID } from 'user-offline-uuid'

/**
 * Random generate a new token by uuid v4. It can be client or auth token.
 * @returns a new token
 */
export function newToken() {
  return v4().replace(/-/g, '')
}

export { getOfflineUUID }

/**
 * Create an offline auth. It'll ensure the user game profile's `uuid` is the same for the same `username`.
 *
 * @param username The username you want to have in-game.
 */
export function offline(username: string, uuid?: string) {
  const id = uuid || getOfflineUUID(username)
  const prof = {
    id,
    name: username,
  }
  return {
    accessToken: newToken(),
    clientToken: newToken(),
    selectedProfile: prof,
    availableProfiles: [prof],
    user: {
      id,
      username,
    },
  }
}
