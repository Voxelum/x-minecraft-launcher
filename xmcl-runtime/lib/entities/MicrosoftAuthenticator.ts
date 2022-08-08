/* eslint-disable camelcase */
import { Dispatcher, getGlobalDispatcher, request } from 'undici'

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

export class MicrosoftAuthenticator {
  constructor(private dispatcher: Dispatcher = getGlobalDispatcher()) {
  }

  /**
   * authenticate with xbox live by ms oauth access token
   * @param oauthAccessToken The oauth access token
   */
  async authenticateXboxLive(oauthAccessToken: string) {
    const xblResponse = await request('https://user.auth.xboxlive.com/user/authenticate', {
      method: 'POST',
      body: JSON.stringify({
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: `d=${oauthAccessToken}`,
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      dispatcher: this.dispatcher,
    })

    const result = await xblResponse.body.json() as XBoxResponse

    return result
  }

  /**
   * Authorize the xbox live. It will get the xsts token in response.
   * @param xblResponseToken
   */
  async authorizeXboxLive(xblResponseToken: string, relyingParty: 'rp://api.minecraftservices.com/' | 'http://xboxlive.com' = 'rp://api.minecraftservices.com/') {
    const xstsResponse = await request('https://xsts.auth.xboxlive.com/xsts/authorize', {
      method: 'POST',
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
      dispatcher: this.dispatcher,
    })

    const result: XBoxResponse = await xstsResponse.body.json()

    return result
  }

  async getXboxGameProfile(xuid: string, uhs: string, xstsToken: string) {
    const response = await request(`https://profile.xboxlive.com/users/xuid(${xuid})/profile/settings`, {
      query: {
        settings: ['PublicGamerpic', 'Gamertag'].join(','),
      },
      headers: {
        'x-xbl-contract-version': '2',
        'content-type': 'application/json',
        Authorization: `XBL3.0 x=${uhs};${xstsToken}`,
      },
      dispatcher: this.dispatcher,
    })

    const result: XBoxGameProfileResponse = await response.body.json()
    return result
  }

  async acquireXBoxToken(oauthAccessToken: string) {
    // const req = request.extend({
    //   headers: {
    //     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.27 Safari/537.36 Edg/88.0.705.18',
    //   },
    // })
    const xblResponse: XBoxResponse = await this.authenticateXboxLive(oauthAccessToken)
    const minecraftXstsResponse: XBoxResponse = await this.authorizeXboxLive(xblResponse.Token, 'rp://api.minecraftservices.com/')
    const xstsResponse: XBoxResponse = await this.authorizeXboxLive(xblResponse.Token, 'http://xboxlive.com')
    const xboxGameProfile = await this.getXboxGameProfile(xstsResponse.DisplayClaims.xui[0].xid, xstsResponse.DisplayClaims.xui[0].uhs, xstsResponse.Token)

    return { xstsResponse: minecraftXstsResponse, xboxGameProfile }
  }

  /**
   * This access token allows us to launch the game, but, we haven't actually checked if the account owns the game. Everything until here works with a normal Microsoft account!
   *
   * This will return the response with Minecraft access token!
   *
   * @param uhs uhs from {@link XBoxResponse}
   * @param xstsToken
   */
  async loginMinecraftWithXBox(uhs: string, xstsToken: string) {
    const mcResponse = await request('https://api.minecraftservices.com/authentication/login_with_xbox', {
      method: 'POST',
      body: JSON.stringify({
        identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
      }),
      headers: {
        'content-type': 'application/json',
      },
      dispatcher: this.dispatcher,
    })

    const result: MinecraftAuthResponse = await mcResponse.body.json()

    return result
  }
}
