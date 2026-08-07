/* eslint-disable n/no-unsupported-features/node-builtins */
/* eslint-disable camelcase */
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

export interface XBoxPresenceRecord {
  xuid: string
  state: 'Online' | 'Offline' | 'Away' | string
  devices?: Array<{
    type: string
    titles?: Array<{
      id: number
      name: string
      placement?: string
      state?: string
    }>
  }>
}

export interface XBoxPresenceResponse {
  userPresence?: XBoxPresenceRecord[]
}

export interface XBoxGameProfileResponse {
  profileUsers: [
    {
      id: string
      hostId: string | null
      settings: [
        {
          id: 'Gamertag'
          value: string
        },
        {
          id: 'PublicGamerpic'
          value: string
        },
      ]
      isSponsoredUser: boolean
    },
  ]
}

export interface MinecraftAuthResponse {
  username: string // this is not the uuid of the account
  roles: []
  access_token: string // jwt, your good old minecraft access token
  token_type: 'Bearer'
  expires_in: number
}

export interface MicrosoftAuthenticatorOptions {
  fetch?: typeof fetch
  xboxDeviceTokenStorage?: XboxDeviceTokenStorage
}

export interface XboxDeviceTokenState {
  id: string
  privateKey: JsonWebKey
  token?: Pick<XBoxResponse, 'Token' | 'NotAfter'>
}

export interface XboxDeviceTokenStorage {
  get(): Promise<XboxDeviceTokenState | undefined>
  put(state: XboxDeviceTokenState): Promise<void>
}

const textEncoder = new TextEncoder()

function concatBytes(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function uint32(value: number) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value)
  return bytes
}

function uint64(value: bigint) {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigUint64(0, value)
  return bytes
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

async function createXboxSignature(privateKey: CryptoKey, timestamp: bigint, path: string, body: string) {
  const zero = new Uint8Array([0])
  const policyVersion = uint32(1)
  const signatureContent = concatBytes(
    policyVersion,
    zero,
    uint64(timestamp),
    zero,
    textEncoder.encode('POST'),
    zero,
    textEncoder.encode(path),
    zero,
    zero,
    textEncoder.encode(body),
    zero,
  )
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    signatureContent,
  ))
  return bytesToBase64(concatBytes(policyVersion, uint64(timestamp), signature))
}

/**
  * Thrown by {@link MicrosoftAuthenticator.loginMinecraftWithXBox} when the
  * Minecraft auth endpoint returns a non-200 response. Carries enough
  * context that the launcher can tell the user *exactly* what went wrong
  * instead of a generic "loginMinecraftByXboxFailed" (see issue #1445).
  *
  * Retry semantics (for 408/425/429/5xx) are intentionally out of scope of
  * this module -- compose them on the caller side by wrapping the injected
  * `fetch` (see ``xmcl-runtime/user/utils/withRetry.ts`` in the launcher).
  */
export class MicrosoftMinecraftXboxLoginError extends Error {
  name = 'MicrosoftMinecraftXboxLoginError'
  constructor(
    public status: number,
    public body: string,
    /** Effective Retry-After in ms from the response header, if any. */
    public retryAfter?: number,
    /**
     * True when the status is in the transient set a retrying client would
     * normally retry (408/425/429/5xx). Useful to tell the user "try again
     * in a moment" vs. "this is a permanent error".
     */
    public retryable?: boolean,
  ) {
    super(`Failed to login minecraft with xbox, status code: ${status}: ${body}}`)
  }
}

/**
 * The microsoft authenticator for Minecraft (Xbox) account.
 */
export class MicrosoftAuthenticator {
  fetch: typeof fetch
  private xboxDeviceTokenStorage?: XboxDeviceTokenStorage
  private xboxDeviceTokenState: XboxDeviceTokenState | undefined
  private xboxDeviceTokenStateLoaded = false
  private xboxDeviceTokenTask: Promise<Pick<XBoxResponse, 'Token' | 'NotAfter'>> | undefined

  constructor(options?: MicrosoftAuthenticatorOptions) {
    this.fetch = options?.fetch || fetch
    this.xboxDeviceTokenStorage = options?.xboxDeviceTokenStorage
  }

  /**
   * Authenticate with xbox live by ms oauth access token
   * @param oauthAccessToken The oauth access token
   */
  async authenticateXboxLive(oauthAccessToken: string, signal?: AbortSignal) {
    const xblResponse = await this.fetch('https://user.auth.xboxlive.com/user/authenticate', {
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
        'x-xbl-contract-version': '1',
      },
      signal,
    })

    if (xblResponse.status !== 200) {
      throw new Error(
        `Failed to authenticate with xbox live, status code: ${xblResponse.status}: ${await xblResponse.text()}}`,
      )
    }

    const result = (await xblResponse.json()) as XBoxResponse

    return result
  }

  async authenticateXboxDevice(signal?: AbortSignal) {
    let state = await this.loadXboxDeviceTokenState()
    let privateKey: CryptoKey
    if (state?.id && state.privateKey?.d && state.privateKey.x && state.privateKey.y) {
      try {
        privateKey = await crypto.subtle.importKey(
          'jwk',
          state.privateKey,
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['sign'],
        )
      } catch {
        state = undefined
      }
    }
    if (!state) {
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      )
      const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
      state = {
        id: crypto.randomUUID(),
        privateKey: privateKeyJwk,
      }
      privateKey = keyPair.privateKey
    }
    const body = JSON.stringify({
      Properties: {
        DeviceType: 'Win32',
        Id: `{${state.id}}`,
        AuthMethod: 'ProofOfPossession',
        ProofKey: {
          kty: 'EC',
          alg: 'ES256',
          crv: 'P-256',
          use: 'sig',
          x: state.privateKey.x,
          y: state.privateKey.y,
        },
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT',
    })
    const windowsTimestamp = BigInt(Date.now() + 11_644_473_600_000) * 10_000n
    const response = await this.fetch('https://device.auth.xboxlive.com/device/authenticate', {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        'x-xbl-contract-version': '1',
        Signature: await createXboxSignature(privateKey!, windowsTimestamp, '/device/authenticate', body),
      },
      signal,
    })

    if (response.status !== 200) {
      throw new Error(
        `Failed to authenticate Xbox device, status code: ${response.status}: ${await response.text()}}`,
      )
    }

    const token = (await response.json()) as Pick<XBoxResponse, 'Token' | 'NotAfter'>
    state.token = token
    this.xboxDeviceTokenState = state
    await this.xboxDeviceTokenStorage?.put(state)
    return token
  }

  private async loadXboxDeviceTokenState() {
    if (!this.xboxDeviceTokenStateLoaded) {
      this.xboxDeviceTokenState = await this.xboxDeviceTokenStorage?.get()
      this.xboxDeviceTokenStateLoaded = true
    }
    return this.xboxDeviceTokenState
  }

  private async acquireXboxDeviceToken(signal?: AbortSignal) {
    const state = await this.loadXboxDeviceTokenState()
    const notAfter = state?.token?.NotAfter ? Date.parse(state.token.NotAfter) : Number.NaN
    if (state?.token?.Token && Number.isFinite(notAfter) && notAfter > Date.now() + 5 * 60_000) {
      return state.token
    }
    if (!this.xboxDeviceTokenTask) {
      this.xboxDeviceTokenTask = this.authenticateXboxDevice(signal).finally(() => {
        this.xboxDeviceTokenTask = undefined
      })
    }
    return this.xboxDeviceTokenTask
  }

  /**
   * Authorize the xbox live. It will get the xsts token in response.
   * @param xblResponseToken The {@link XBoxResponse.Token}
   */
  async authorizeXboxLive(
    xblResponseToken: string,
    relyingParty:
      | 'rp://api.minecraftservices.com/'
      | 'http://xboxlive.com' = 'rp://api.minecraftservices.com/',
    signal?: AbortSignal,
    deviceToken?: string,
  ) {
    const xstsResponse = await this.fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Properties: {
          SandboxId: 'RETAIL',
          UserTokens: [xblResponseToken],
          ...(deviceToken ? { DeviceToken: deviceToken } : {}),
        },
        RelyingParty: relyingParty,
        TokenType: 'JWT',
      }),
      signal,
    })

    if (xstsResponse.status !== 200) {
      const errText = await xstsResponse.text()
      let errObj = {} as any
      try {
        errObj = JSON.parse(errText)
      } catch (e) {}
      throw Object.assign(
        new Error(
          `Failed to authorize with xbox live, status code: ${xstsResponse.status}: ${errText}}`,
        ),
        errObj,
      )
    }

    const result = (await xstsResponse.json()) as XBoxResponse

    return result
  }

  /**
   * Get xbox user profile, including **username** and **avatar**.
   *
   * You can find the parameters from the {@link XBoxResponse}.
   *
   * @param xuid The `xuid` in a {@link XBoxResponse.DisplayClaims}
   * @param uhs The `uhs` in a {@link XBoxResponse.DisplayClaims}
   * @param xstsToken The {@link XBoxResponse.Token}
   * @returns The user game profile.
   */
  async getXboxGameProfile(xuid: string, uhs: string, xstsToken: string, signal?: AbortSignal) {
    const url = new URL(`https://profile.xboxlive.com/users/xuid(${xuid})/profile/settings`)
    url.searchParams.append('settings', ['PublicGamerpic', 'Gamertag'].join(','))
    const response = await this.fetch(url.toString(), {
      headers: {
        'x-xbl-contract-version': '2',
        'content-type': 'application/json',
        Authorization: `XBL3.0 x=${uhs};${xstsToken}`,
      },
      signal,
    })

    if (response.status !== 200) {
      throw new Error(
        `Failed to get xbox game profile, status code: ${response.status}: ${await response.text()}}`,
      )
    }

    const result = (await response.json()) as XBoxGameProfileResponse
    return result
  }

  /**
   * Fetch Xbox Live presence status for a list of xuids or single xuid.
   *
   * @param xuids Array of Xbox User IDs (xuid)
   * @param uhs The `uhs` in {@link XBoxResponse.DisplayClaims}
   * @param xstsToken The {@link XBoxResponse.Token}
   */
  async getXboxPresence(xuids: string[], uhs: string, xstsToken: string, signal?: AbortSignal): Promise<XBoxPresenceRecord[]> {
    if (xuids.length === 0) return []
    const response = await this.fetch('https://presence.xboxlive.com/users/batch', {
      method: 'POST',
      headers: {
        'x-xbl-contract-version': '3',
        'content-type': 'application/json',
        Authorization: `XBL3.0 x=${uhs};${xstsToken}`,
      },
      body: JSON.stringify({
        users: xuids,
        level: 'all',
      }),
      signal,
    })

    if (response.status !== 200) {
      return []
    }

    try {
      const result = (await response.json()) as XBoxPresenceResponse | XBoxPresenceRecord[]
      if (Array.isArray(result)) return result
      if (result && Array.isArray((result as XBoxPresenceResponse).userPresence)) {
        return (result as XBoxPresenceResponse).userPresence!
      }
      return []
    } catch {
      return []
    }
  }

  /**
   * Acquire both Minecraft and xbox token and xbox game profile.
   * You can use the xbox token to login Minecraft by {@link loginMinecraftWithXBox}.
   *
   * This method is the composition of calling
   * - {@link authenticateXboxLive}
   * - {@link authorizeXboxLive} to `rp://api.minecraftservices.com/`
   * - {@link authorizeXboxLive} to `http://xboxlive.com`
   * - {@link getXboxGameProfile}
   *
   * You can call them individually if you want a more detailed control.
   *
   * @param oauthAccessToken The microsoft access token
   * @param signal The abort signal
   * @returns The object contain xstsResponse (minecraft xbox token) and xbox game profile
   */
  async acquireXBoxToken(oauthAccessToken: string, signal?: AbortSignal) {
    const xblResponse: XBoxResponse = await this.authenticateXboxLive(oauthAccessToken, signal)
    const deviceToken = (await this.acquireXboxDeviceToken(signal)).Token
    const minecraftXstsResponse = await this.authorizeXboxLive(
      xblResponse.Token,
      'rp://api.minecraftservices.com/',
      signal,
      deviceToken,
    )
    // The `http://xboxlive.com` relying party is only needed to fetch the
    // Xbox avatar/gamertag. Some accounts that legitimately own Minecraft
    // (missing full Xbox Live profile, region/age restrictions, etc.) can
    // authorize `rp://api.minecraftservices.com/` but fail here. The official
    // launcher never requests this relying party, which is why those users
    // report "it runs fine in the regular launcher". Treat it as optional so
    // a failure here never blocks an otherwise valid login -- the caller just
    // won't get an Xbox avatar.
    const xstsResponse: XBoxResponse | undefined = await this.authorizeXboxLive(
      xblResponse.Token,
      'http://xboxlive.com',
      signal,
      deviceToken,
    ).catch(() => undefined)

    return { minecraftXstsResponse, liveXstsResponse: xstsResponse }
  }

  /**
   * This will return the response with Minecraft access token!
   *
   * This access token allows us to launch the game, but, we haven't actually checked if the account owns the game. Everything until here works with a normal Microsoft account!
   *
   * @param uhs uhs from {@link XBoxResponse} of {@link acquireXBoxToken}
   * @param xstsToken You need to get this token from {@link acquireXBoxToken}
   */
  /**
    * Login Minecraft with an Xbox token. This method does exactly one HTTP
    * attempt -- if you need retry/backoff for transient failures (408, 425,
    * 429, 5xx), compose it on the caller side by wrapping the `fetch` you
    * inject into this authenticator. On any non-200 the method throws a
    * {@link MicrosoftMinecraftXboxLoginError} that carries `status`,
    * `body`, parsed `retryAfter` (ms) and a `retryable` flag so the UI can
    * surface a precise message (see issue #1445).
    *
    * @param uhs uhs from {@link XBoxResponse} of {@link acquireXBoxToken}
    * @param xstsToken You need to get this token from {@link acquireXBoxToken}
    */
  async loginMinecraftWithXBox(uhs: string, xstsToken: string, signal?: AbortSignal) {
    const mcResponse = await this.fetch(
      'https://api.minecraftservices.com/authentication/login_with_xbox',
      {
        method: 'POST',
        body: JSON.stringify({
          identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
        }),
        headers: {
          'content-type': 'application/json',
        },
        signal,
      },
    )

    if (mcResponse.status === 200) {
      return (await mcResponse.json()) as MinecraftAuthResponse
    }

    const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504])
    const body = await mcResponse.text()
    // Parse Retry-After (seconds or HTTP-date) so the UI can show a sensible
    // wait hint when the caller's retry budget has been exhausted.
    let retryAfterMs: number | undefined
    const retryAfter = mcResponse.headers.get('retry-after')
    if (retryAfter) {
      const asInt = parseInt(retryAfter, 10)
      if (!Number.isNaN(asInt)) {
        retryAfterMs = asInt * 1000
      } else {
        const dateMs = Date.parse(retryAfter)
        if (!Number.isNaN(dateMs)) {
          retryAfterMs = Math.max(0, dateMs - Date.now())
        }
      }
    }

    throw new MicrosoftMinecraftXboxLoginError(
      mcResponse.status,
      body,
      retryAfterMs,
      transientStatuses.has(mcResponse.status),
    )
  }
}
