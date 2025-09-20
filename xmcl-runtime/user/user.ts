/* eslint-disable camelcase */

import { AuthlibInjectorApiProfile, GameProfileAndTexture, OICDLikeConfig, YggdrasilApi } from '@xmcl/runtime-api'
import { GameProfile } from '@xmcl/user'
import { readFile } from 'fs-extra'

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

export async function loadYggdrasilApiProfile(url: string, fetch = globalThis.fetch) {
  const api: YggdrasilApi = { url }

  async function loadHostFavicon() {
    const parsedUrl = new URL(url)
    try {
      const resp = await fetch(parsedUrl.protocol + parsedUrl.host + '/favicon.ico')
      if (resp.status === 200) {
        api.favicon = parsedUrl.protocol + parsedUrl.host + '/favicon.ico'
      }
    } catch {
      try {
        const resp = await fetch(parsedUrl.protocol + parsedUrl.host)
        const body = await resp.text()
        const match = body.match(/<link rel="shortcut icon" href="([^"]+)" \/>/)
        if (match) {
          api.favicon = match[1]
        }
      } catch (e) { }
    }
  }
  async function loadMetadata() {
    try {
      const resp = await fetch(url)
      const body = await resp.json() as AuthlibInjectorApiProfile

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

      if (body?.meta?.['feature.openid_configuration_url']) {
        const configResp = await fetch(body?.meta?.['feature.openid_configuration_url'])
        const config = await configResp.json() as OICDLikeConfig
        api.ocidConfig = config
      }
    } catch (e) {

    }
  }
  await Promise.all([loadHostFavicon(), loadMetadata()])

  return api
}

export function transformGameProfileTexture(profile: GameProfile) {
  if (!profile.properties) return
  const texturesBase64 = profile.properties.textures
  if (!texturesBase64) return
  const textures = JSON.parse(Buffer.from(texturesBase64, 'base64').toString())
  const skin = textures?.textures.SKIN
  const uploadable = profile.properties.uploadableTextures

  // mark skin already refreshed
  if (skin) {
    return {
      ...profile,
      textures: {
        ...textures.textures,
        SKIN: skin,
      },
      uploadable: uploadable ? uploadable.split(',') as any : undefined,
    }
  }
}
