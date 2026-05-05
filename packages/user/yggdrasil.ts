/* eslint-disable n/no-unsupported-features/node-builtins */
import { GameProfile, GameProfileWithProperties } from './gameProfile'

/**
 * The auth response format.
 *
 * Please refer https://wiki.vg/Authentication
 */
export interface YggrasilAuthentication {
  /**
   * hexadecimal or JSON-Web-Token (unconfirmed) [The normal accessToken can be found in the payload of the JWT (second by '.' separated part as Base64 encoded JSON object), in key "yggt"]
   */
  accessToken: string
  /**
   * identical to the one received
   */
  clientToken: string
  /**
   * only present if the agent field was received
   */
  availableProfiles: GameProfile[]
  /**
   * only present if the agent field was received
   */
  selectedProfile: GameProfile
  /**
   * only present if requestUser was true in the request payload
   */
  user?: {
    id: string
    username: string
    email?: string
    registerIp?: string
    migratedFrom?: string
    migratedAt?: number
    registeredAt?: number
    passwordChangedAt?: number
    dateOfBirth?: number
    suspended?: boolean
    blocked?: boolean
    secured?: boolean
    migrated?: boolean
    emailVerified?: boolean
    legacyUser?: boolean
    verifiedByParent?: boolean
    properties?: object[]
  }
}

export interface YggdrasilClientOptions {
  headers?: Record<string, string>
  fetch?: typeof fetch
  FormData?: typeof FormData
  File?: typeof File
}

export interface ProfileLookupException {
  /**
   * - statusCode=204 -> error="NoPlayerFound"
   * - statusCode=400 -> error="IllegalArgumentException" (parsed from body)
   * - statusCode=other -> error=statusCode.toString()
   */
  error: 'NoPlayerFoundException' | 'IllegalArgumentException' | 'GeneralException'
  errorMessage?: string | 'Invalid timestamp.'
  statusCode?: number
  statusMessage?: string
}

export interface SetTextureOption {
  accessToken: string
  uuid: string
  type: 'skin' | 'cape' | 'elytra'
  texture?:
    | {
        url: string
        metadata?: { model?: 'slim' | 'steve'; [key: string]: any }
      }
    | {
        data: Uint8Array
        metadata?: { model?: 'slim' | 'steve'; [key: string]: any }
      }
}

export class YggdrasilError extends Error {
  error: string
  errorMessage: string
  cause?: string

  constructor(
    readonly statusCode: number,
    message: string,
    o?: any,
  ) {
    super(message)
    this.name = 'YggdrasilError'
    this.error = o?.error
    this.errorMessage = o?.errorMessage
    this.cause = o?.cause
  }
}

export class YggdrasilClient {
  protected headers: Record<string, string>
  protected fetch: typeof fetch
  protected FormData: typeof FormData
  protected File: typeof File

  /**
   * Create client for official-like api endpoint
   * @param api The official-like api endpoint
   */
  constructor(
    public api: string,
    options?: YggdrasilClientOptions,
  ) {
    this.headers = options?.headers ?? {}
    this.fetch = options?.fetch || fetch
    this.FormData = options?.FormData || FormData
    this.File = options?.File || File
  }

  async validate(accessToken: string, clientToken: string, signal?: AbortSignal) {
    const response = await this.fetch(this.api + '/validate', {
      method: 'POST',
      body: JSON.stringify({ accessToken, clientToken }),
      headers: {
        ...this.headers,
        'content-type': 'application/json; charset=utf-8',
      },
      signal,
    })
    return response.ok
  }

  async invalidate(accessToken: string, clientToken: string, signal?: AbortSignal) {
    return await this.fetch(this.api + '/invalidate', {
      method: 'POST',
      body: JSON.stringify({ accessToken, clientToken }),
      headers: {
        ...this.headers,
        'content-type': 'application/json; charset=utf-8',
      },
      signal,
    }).then((s) => s.ok)
  }

  async login(
    {
      username,
      password,
      clientToken,
      requestUser,
    }: { username: string; password: string; clientToken: string; requestUser?: boolean },
    signal?: AbortSignal,
  ) {
    const response = await this.fetch(this.api + '/authenticate', {
      method: 'POST',
      body: JSON.stringify({
        agent: { name: 'Minecraft', version: 1 },
        requestUser: typeof requestUser === 'boolean' ? requestUser : false,
        username,
        password,
        clientToken,
      }),
      headers: {
        ...this.headers,
        'content-type': 'application/json; charset=utf-8',
      },
      signal,
    })

    if (response.status >= 400) {
      const body = await response.text()
      throw new YggdrasilError(
        response.status,
        response.status + ':' + body,
        response.headers.get('content-type')?.startsWith('application/json')
          ? JSON.parse(body)
          : undefined,
      )
    }

    const authentication: YggrasilAuthentication = (await response.json()) as YggrasilAuthentication
    return authentication
  }

  async refresh(
    {
      accessToken,
      requestUser,
      clientToken,
    }: { accessToken: string; clientToken: string; requestUser?: boolean },
    signal?: AbortSignal,
  ) {
    const response = await this.fetch(this.api + '/refresh', {
      method: 'POST',
      body: JSON.stringify({
        accessToken,
        clientToken,
        requestUser: typeof requestUser === 'boolean' ? requestUser : false,
      }),
      headers: {
        ...this.headers,
        'content-type': 'application/json; charset=utf-8',
      },
      signal,
    })

    if (response.status >= 400) {
      const body = await response.text()
      throw new YggdrasilError(
        response.status,
        response.status + ':' + body,
        response.headers.get('content-type')?.startsWith('application/json')
          ? JSON.parse(body)
          : undefined,
      )
    }

    const authentication = (await response.json()) as YggrasilAuthentication
    return authentication
  }
}

/**
 * The texture structure for yggdrasil API
 */
export interface YggdrasilTexturesInfo {
  /**
   * java time in ms
   */
  timestamp: number
  /**
   * player name
   */
  profileName: string
  /**
   * player id
   */
  profileId: string
  textures: {
    SKIN?: YggdrasilTexture
    CAPE?: YggdrasilTexture
    ELYTRA?: YggdrasilTexture
  }
}

/**
 * The data structure that hold the texture
 */
export interface YggdrasilTexture {
  url: string
  metadata?: { model?: 'slim' | 'steve'; [key: string]: any }
}

export function isTextureSlim(o: YggdrasilTexture) {
  return o.metadata ? o.metadata.model === 'slim' : false
}

export function getTextureType(o: YggdrasilTexture) {
  return isTextureSlim(o) ? 'slim' : 'steve'
}

export class YggdrasilThirdPartyClient extends YggdrasilClient {
  public profileApi: string
  public textureApi: string
  /**
   * Create thirdparty (authlib-injector) style client
   * @param api The api url following https://github.com/yushijinhun/authlib-injector/wiki/Yggdrasil-%E6%9C%8D%E5%8A%A1%E7%AB%AF%E6%8A%80%E6%9C%AF%E8%A7%84%E8%8C%83
   * @param clientToken
   * @param dispatcher
   */
  constructor(api: string, options?: YggdrasilClientOptions) {
    super(api + '/authserver', options)
    // eslint-disable-next-line no-template-curly-in-string
    this.profileApi = api + '/sessionserver/session/minecraft/profile/${uuid}'
    // this.profileApi = api + '/yggdrasil/sessionserver/session/minecraft/profile/${uuid}'
    // eslint-disable-next-line no-template-curly-in-string
    this.textureApi = api + '/api/user/profile/${uuid}/${type}'
  }

  async lookup(uuid: string, unsigned = true, signal?: AbortSignal) {
    // eslint-disable-next-line no-template-curly-in-string
    const url = new URL(this.profileApi.replace('${uuid}', uuid))
    url.searchParams.append('unsigned', unsigned ? 'true' : 'false')
    const response = await this.fetch(url.toString(), {
      method: 'GET',
      headers: this.headers,
      signal,
    })
    if (response.status !== 200) {
      const body = await response.text()
      throw new YggdrasilError(
        response.status,
        response.status + ':' + body,
        response.headers.get('content-type')?.startsWith('application/json')
          ? JSON.parse(body)
          : undefined,
      )
    }
    const o = (await response.json()) as any
    if (o.properties && o.properties instanceof Array) {
      const properties = o.properties as Array<{ name: string; value: string; signature: string }>
      const to: { [key: string]: string } = {}
      for (const prop of properties) {
        // if (prop.signature && api.publicKey && !await verify(prop.value, prop.signature, api.publicKey)) {
        // console.warn(`Discard corrupted prop ${prop.name}: ${prop.value} as the signature mismatched!`)
        // } else {
        to[prop.name] = prop.value
        // }
      }
      o.properties = to
    }
    return o as GameProfileWithProperties
  }

  async setTexture(options: SetTextureOption, signal?: AbortSignal) {
    // eslint-disable-next-line no-template-curly-in-string
    const url = new URL(
      this.textureApi.replace('${uuid}', options.uuid).replace('${type}', options.type),
    )

    // eslint-disable-next-line no-undef
    const requestOptions: RequestInit = {
      headers: {
        ...this.headers,
        Authorization: `Bearer ${options.accessToken}`,
      },
      signal,
    }
    if (!options.texture) {
      // delete texture
      requestOptions.method = 'DELETE'
    } else if ('data' in options.texture) {
      requestOptions.method = 'PUT'
      // upload texture
      const form = new this.FormData()
      form.append('model', options.texture.metadata?.model || 'steve')
      form.append(
        'file',
        new this.File([options.texture.data] as any, 'Steve.png', { type: 'image/png' }),
      )
      requestOptions.body = form
    } else if ('url' in options.texture) {
      // set texture
      requestOptions.method = 'POST'
      url.searchParams.append('model', options.texture.metadata?.model || '')
      url.searchParams.append('url', options.texture.url)
    } else {
      throw new TypeError('Illegal Option Format!')
    }

    const response = await this.fetch(url.toString(), requestOptions)
    if (response.status === 401) {
      if (response.headers.get('content-type') === 'application/json') {
        const body = (await response.json()) as any
        throw new YggdrasilError(response.status, response.status.toString(), {
          error: body.error ?? 'Unauthorized',
          errorMessage: body.errorMessage ?? 'Unauthorized',
        })
      } else {
        const body = await response.text()
        throw new YggdrasilError(response.status, response.status + ':' + body, {
          error: 'Unauthorized',
          errorMessage: 'Unauthorized: ' + body,
        })
      }
    }
    if (response.status >= 400) {
      const body = await response.text()
      throw new YggdrasilError(response.status, response.status + ':' + body, {
        error: 'SetSkinFailed',
        errorMessage: 'Fail to set skin ' + body,
      })
    }
  }
}
