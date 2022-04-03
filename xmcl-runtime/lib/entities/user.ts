/* eslint-disable camelcase */

import { CLIENT_ID } from '../constant'
import { UserException } from '@xmcl/runtime-api'
import { Got } from 'got'
import FormData from 'form-data'

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
    state: 'ACTIVE' | string
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

export async function getOAuthToken(request: Got, code: string) {
  const oauthResponse: OAuthTokenResponse = await request.post('https://login.live.com/oauth20_token.srf', {
    form: {
      client_id: CLIENT_ID,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://login.live.com/oauth20_desktop.srf',
      scope: 'XboxLive.signin',
    },
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }).json()
  return oauthResponse
}

/**
 * authenticate with xbox live by ms oauth access token
 * @param oauthAccessToken The oauth access token
 */
export async function authenticateXboxLive(request: Got, oauthAccessToken: string) {
  const xblResponse: XBoxResponse = await request.post('https://user.auth.xboxlive.com/user/authenticate', {
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${oauthAccessToken}`,
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    }),
    retry: { limit: 3 },
    headers: {
      'Content-Type': 'application/json',
    },
  }).json()

  return xblResponse
}

/**
 * Authorize the xbox live. It will get the xsts token in response.
 * @param xblResponseToken
 */
export async function authorizeXboxLive(request: Got, xblResponseToken: string, relyingParty: 'rp://api.minecraftservices.com/' | 'http://xboxlive.com' = 'rp://api.minecraftservices.com/') {
  const xstsResponse: XBoxResponse = await request.post('https://xsts.auth.xboxlive.com/xsts/authorize', {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblResponseToken],
      },
      RelyingParty: relyingParty,
      TokenType: 'JWT',
    }),
  }).json()

  return xstsResponse
}

export async function acquireXBoxToken(request: Got, oauthAccessToken: string) {
  const req = request.extend({
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.27 Safari/537.36 Edg/88.0.705.18',
    },
  })
  const xblResponse: XBoxResponse = await authenticateXboxLive(req, oauthAccessToken)
  const minecraftXstsResponse: XBoxResponse = await authorizeXboxLive(req, xblResponse.Token, 'rp://api.minecraftservices.com/')
  const xstsResponse: XBoxResponse = await authorizeXboxLive(req, xblResponse.Token, 'http://xboxlive.com')
  const xboxGameProfile = await getXboxGameProfile(req, xstsResponse.DisplayClaims.xui[0].xid, xstsResponse.DisplayClaims.xui[0].uhs, xstsResponse.Token)

  return { xstsResponse: minecraftXstsResponse, xboxGameProfile }
}

export async function getXboxGameProfile(request: Got, xuid: string, uhs: string, xstsToken: string) {
  const response: XBoxGameProfileResponse = await request.get(`https://profile.xboxlive.com/users/xuid(${xuid})/profile/settings`, {
    searchParams: {
      settings: ['PublicGamerpic', 'Gamertag'].join(','),
    },
    headers: {
      'x-xbl-contract-version': '2',
      'content-type': 'application/json',
      Authorization: `XBL3.0 x=${uhs};${xstsToken}`,
    },
  }).json()
  return response
}

/**
 * This access token allows us to launch the game, but, we haven't actually checked if the account owns the game. Everything until here works with a normal Microsoft account!
 *
 * This will return the response with Minecraft access token!
 *
 * @param uhs uhs from {@link XBoxResponse}
 * @param xstsToken
 */
export async function loginMinecraftWithXBox(request: Got, uhs: string, xstsToken: string) {
  const mcResponse: MinecraftAuthResponse = await request.post('https://api.minecraftservices.com/authentication/login_with_xbox', {
    json: {
      identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
    },
  }).json()

  return mcResponse
}

/**
 * Return the owner ship list of the player with those token.
 * @param accessToken The Minecraft access token
 */
export async function checkGameOwnership(request: Got, accessToken: string) {
  const mcResponse: MinecraftOwnershipResponse = await request.get('https://api.minecraftservices.com/entitlements/mcstore', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).json()

  return mcResponse
}

/**
 * The new way to get game profile by the access token
 * @param accessToken The minecraft access token
 */
export async function getGameProfile(request: Got, accessToken: string) {
  const profileResponse: MinecraftProfileResponse | MinecraftProfileErrorResponse = await request.get('https://api.minecraftservices.com/minecraft/profile', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).json()

  if ('error' in profileResponse) {
    throw new UserException({ type: 'fetchMinecraftProfileFailed', ...profileResponse },
      `Cannot login to Microsoft! ${profileResponse.errorMessage}`)
  }

  return profileResponse
}

function getSkinFormData(buf: Buffer, fileName: string, variant: 'slim' | 'classic') {
  const form = new FormData()
  form.append('variant', variant)
  form.append('file', buf, { contentType: 'image/png', filename: fileName })
  return form
}

export async function changeAccountSkin(request: Got, accessToken: string, fileName: string, skin: string | Buffer, variant: 'slim' | 'classic') {
  const body = typeof skin === 'string' ? JSON.stringify({ url: skin, variant }) : getSkinFormData(skin, fileName, variant)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }

  if (typeof body === 'string') {
    headers['Content-Type'] = 'application/json'
  } else {
    Object.assign(headers, body.getHeaders())
  }

  const profileResponse: MinecraftProfileResponse | MinecraftProfileErrorResponse = await request('https://api.minecraftservices.com/minecraft/profile/skins', {
    method: 'POST',
    throwHttpErrors: false,
    headers,
    body,
  }).json()

  if ('error' in profileResponse || 'errorMessage' in profileResponse) {
    throw new UserException({ type: 'fetchMinecraftProfileFailed', ...profileResponse },
      `Cannot login to Microsoft! ${profileResponse.errorMessage}`)
  }

  return profileResponse
}
