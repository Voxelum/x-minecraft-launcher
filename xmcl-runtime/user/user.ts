/* eslint-disable camelcase */

import { AuthlibInjectorApiProfile, GameProfileAndTexture, YggdrasilApi } from '@xmcl/runtime-api'
import { GameProfile } from '@xmcl/user'
import { readFile } from 'fs-extra'
import { request } from 'undici'

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
  const resolved = new URL(url)
  if (resolved.protocol === 'file:' || resolved.protocol === 'image:') {
    return await readFile(url.replace('file://', '').replace('image://', ''))
  } else if (resolved.protocol === 'https:' || resolved.protocol === 'http:') {
    if (resolved.host === 'launcher' && resolved.pathname === '/media') {
      const path = resolved.searchParams.get('path')
      if (path) return await readFile(path)
    }
    return url
  } else {
    throw new Error('Unknown url protocol! Require a file or http/https protocol!')
  }
}

export async function loadYggdrasilApiProfile(url: string) {
  const api: YggdrasilApi = { url }

  async function loadHostFavicon() {
    const parsedUrl = new URL(url)
    try {
      const resp = await request(parsedUrl.protocol + parsedUrl.host + '/favicon.ico')
      if (resp.statusCode === 200) {
        api.favicon = parsedUrl.protocol + parsedUrl.host + '/favicon.ico'
      }
    } catch {
      try {
        const resp = await request(parsedUrl.protocol + parsedUrl.host)
        const body = await resp.body.text()
        const match = body.match(/<link rel="shortcut icon" href="([^"]+)" \/>/)
        if (match) {
          api.favicon = match[1]
        }
      } catch (e) { }
    }
  }
  async function loadMetadata() {
    try {
      const resp = await request(url)
      const body = await resp.body.json() as AuthlibInjectorApiProfile

      api.authlibInjector = {
        meta: {
          serverName: typeof body?.meta?.serverName === 'string' ? body.meta.serverName : '',
          implementationName: typeof body?.meta?.implementationName === 'string' ? body.meta.implementationName : '',
          implementationVersion: typeof body?.meta?.implementationVersion === 'string' ? body.meta.implementationVersion : '',
          links: {
            homepage: typeof body?.meta?.links?.homepage === 'string' ? body.meta.links.homepage : '',
            register: typeof body?.meta?.links?.register === 'string' ? body.meta.links.register : '',
          },
          'feature.non_email_login': typeof body?.meta?.['feature.non_email_login'] === 'boolean' ? body.meta['feature.non_email_login'] : false,
        },
        signaturePublickey: typeof body?.signaturePublickey === 'string' ? body.signaturePublickey : '',
        skinDomains: typeof body?.skinDomains === 'object' ? body.skinDomains : [],
      }
    } catch (e) {

    }
  }

  await Promise.all([loadHostFavicon(), loadMetadata()])

  return api
}
