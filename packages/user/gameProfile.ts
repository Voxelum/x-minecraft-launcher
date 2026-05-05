/**
 * The game profile of the user.
 *
 * In auth response, it will usually carry the `userId`, `createdAt` properties.
 *
 * In `lookup` function, it will carry the `properties` property.
 */
export interface GameProfile {
  /**
   * game profile unique id
   */
  id: string
  /**
   * This is in game displayed name
   */
  name: string
  properties?: { [name: string]: string }
  userId?: string
  createdAt?: number
  legacyProfile?: boolean
  suspended?: boolean
  paid?: boolean
  migrated?: boolean
  legacy?: boolean
}

export interface GameProfileWithProperties extends GameProfile {
  properties: { [name: string]: string }
}
