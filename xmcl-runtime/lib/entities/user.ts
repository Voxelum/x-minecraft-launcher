/* eslint-disable camelcase */

import { GameProfileAndTexture } from '@xmcl/runtime-api'
import { GameProfile } from '@xmcl/user'
import { readFile } from 'fs/promises'
import { URL } from 'url'

export interface OAuthTokenResponse {
  token_type: string
  expires_in: number
  scope: string
  access_token: string
  refresh_token: string
  user_id: string
  foci: string
}
export interface XBoxResponse {
  IssueInstant: string
  NotAfter: string
  Token: string
  DisplayClaims: {
    xui: [
      {
        /**
         * gamer tag
         */
        gtg: string
        /**
         * user id
         */
        xid: string
        uhs: string
      },
    ]
  }
}

export interface XBoxGameProfileResponse {
  profileUsers: [{
    id: string
    hostId: string | null
    settings: [{
      'id': 'Gamertag'
      'value': string
    }, {
      'id': 'PublicGamerpic'
      'value': string
    }]
    isSponsoredUser: boolean
  }]
}

export interface MinecraftAuthResponse {
  username: string // this is not the uuid of the account
  roles: []
  access_token: string // jwt, your good old minecraft access token
  token_type: 'Bearer'
  expires_in: number
}
export interface MinecraftProfileResponse {
  id: string // the real uuid of the account, woo
  name: string // the mc user name of the account
  skins: [{
    id: string
    state: 'ACTIVE' | 'string'
    url: string
    variant: 'CLASSIC' | string
    alias: 'STEVE' | string
  }]
  capes: [{
    id: string
    state: 'ACTIVE' | string
    url: string
  }]
}
export interface MinecraftProfileErrorResponse {
  path: '/minecraft/profile'
  errorType: 'NOT_FOUND' | string
  error: string | 'NOT_FOUND'
  errorMessage: string
  developerMessage: string
}
export interface MinecraftOwnershipResponse {
  /**
     * If the account doesn't own the game, the items array will be empty.
     */
  items: Array<{
    name: 'product_minecraft' | 'game_minecraft'
    /**
         * jwt signature
         */
    signature: string
  }>
  /**
     * jwt signature
     */
  signature: string
  keyId: string
}

export function normalizeGameProfile(profile: GameProfile): GameProfileAndTexture {
  const exitedTextures = (profile as any).textures
  return {
    ...profile,
    textures: !exitedTextures
      ? {
        SKIN: {
          url: '',
        },
      }
      : exitedTextures,
  }
}

export async function normalizeSkinData(url: string) {
  url = url.replace('image:', 'file:')
  const { protocol } = new URL(url)
  if (protocol === 'file:' || protocol === 'image:') {
    return await readFile(url.replace('file://', '').replace('image://', ''))
  } else if (protocol === 'https:' || protocol === 'http:') {
    return url
  } else {
    throw new Error('Unknown url protocol! Require a file or http/https protocol!')
  }
}
