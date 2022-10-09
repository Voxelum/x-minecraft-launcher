import { Authentication, GameProfileWithProperties, SetTextureOption } from '@xmcl/user'
import FormData from 'form-data'
import { Dispatcher, request } from 'undici'

export class YggdrasilError {
  error: string
  errorMessage: string
  cause?: string

  constructor(o: any) {
    this.error = o.error
    this.errorMessage = o.errorMessage
    this.cause = o.cause
  }
}

export class YggdrasilClient {
  constructor(
    readonly api: string,
    readonly clientToken: string | (() => string),
    readonly dispatcher?: Dispatcher,
  ) { }

  private getClientToken() {
    return typeof this.clientToken === 'string' ? this.clientToken : this.clientToken()
  }

  async validate(accessToken: string, signal?: AbortSignal) {
    const clientToken = this.getClientToken()
    return await request(this.api + '/validate', {
      method: 'POST',
      body: JSON.stringify({ accessToken, clientToken }),
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      headersTimeout: 10_000,
      bodyTimeout: 10_000,
      throwOnError: true,
      dispatcher: this.dispatcher,
      signal,
    }).then(() => true, () => false)
  }

  async invalidate(accessToken: string, signal?: AbortSignal) {
    const clientToken = this.getClientToken()
    return await request(this.api + '/invalidate', {
      method: 'POST',
      body: JSON.stringify({ accessToken, clientToken }),
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      throwOnError: true,
      dispatcher: this.dispatcher,
      signal,
    }).then(() => true, () => false)
  }

  async login({ username, password, requestUser }: { username: string; password: string; requestUser?: boolean }, signal?: AbortSignal) {
    const clientToken = this.getClientToken()
    const response = await request(this.api + '/authenticate', {
      method: 'POST',
      body: JSON.stringify({
        agent: { name: 'Minecraft', version: 1 },
        requestUser: typeof requestUser === 'boolean' ? requestUser : false,
        username,
        password,
        clientToken,
      }),
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      throwOnError: false,
      dispatcher: this.dispatcher,
      signal,
    })

    if (response.statusCode >= 400) {
      throw await response.body.json()
    }

    const authentication: Authentication = await response.body.json()
    return authentication
  }

  async refresh({ accessToken, requestUser }: { accessToken: string; requestUser?: boolean }, signal?: AbortSignal) {
    const clientToken = this.getClientToken()
    const response = await request(this.api + '/refresh', {
      method: 'POST',
      body: JSON.stringify({
        accessToken,
        clientToken,
        requestUser: typeof requestUser === 'boolean' ? requestUser : false,
      }),
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      throwOnError: true,
      dispatcher: this.dispatcher,
      signal,
    })

    const authentication: Authentication = await response.body.json()
    return authentication
  }
}

export class YggdrasilThirdPartyClient extends YggdrasilClient {
  constructor(
    private profileApi: string,
    private textureApi: string,
    api: string,
    clientToken: string | (() => string),
    dispatcher: Dispatcher,
  ) {
    super(api, clientToken, dispatcher)
  }

  async lookup(uuid: string, unsigned = true, signal?: AbortSignal) {
    // eslint-disable-next-line no-template-curly-in-string
    const response = await request(this.profileApi.replace('${uuid}', uuid), {
      method: 'GET',
      query: { unsigned },
      dispatcher: this.dispatcher,
      signal,
    })
    if (response.statusCode !== 200) {
      throw new YggdrasilError(await response.body.json())
    }
    const o = await response.body.json()
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
    type RequestOptions = Parameters<typeof request>[1]
    const requestOptions: RequestOptions = {
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
      },
      dispatcher: this.dispatcher,
      headersTimeout: 5_000,
      signal,
    }
    if (!options.texture) {
      // delete texture
      requestOptions.method = 'DELETE'
    } else if ('data' in options.texture) {
      requestOptions.method = 'PUT'
      // upload texture
      const form = new FormData()
      form.append('model', options.texture.metadata?.model || 'steve')
      form.append('file', options.texture.data, { contentType: 'image/png', filename: 'Steve.png' })
      requestOptions.headers = form.getHeaders(requestOptions.headers!)
      requestOptions.body = form.getBuffer()
    } else if ('url' in options.texture) {
      // set texture
      requestOptions.method = 'POST'
      requestOptions.query = {
        model: options.texture.metadata?.model || '',
        url: options.texture.url,
      }
    } else {
      throw new Error('Illegal Option Format!')
    }

    // eslint-disable-next-line no-template-curly-in-string
    const api = this.textureApi.replace('${uuid}', options.uuid).replace('${type}', options.type)
    const response = await request(api, requestOptions)
    if (response.statusCode === 401) {
      if (response.headers['content-type'] === 'application/json') {
        const body = await response.body.json()
        throw new YggdrasilError({
          error: body.error ?? 'Unauthorized',
          errorMessage: body.errorMessage ?? 'Unauthorized',
        })
      } else {
        const body = await response.body.text()
        throw new YggdrasilError({
          error: 'Unauthorized',
          errorMessage: 'Unauthorized: ' + body,
        })
      }
    }
    if (response.statusCode >= 400) {
      const body = await response.body.text()
      throw new YggdrasilError({
        error: 'SetSkinFailed',
        errorMessage: 'Fail to set skin ' + body,
      })
    }
  }
}
