import type { APIApplication, OAuth2Scopes } from 'discord-api-types/v10'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { Dispatcher, request } from 'undici'
import { ClientUser } from './structures/ClientUser'
import {
  CUSTOM_RPC_ERROR_CODE,
  RPC_ERROR_CODE,
  type CommandIncoming,
  type RPC_CMD,
  type RPC_EVT,
  type Transport,
  type TransportOptions,
} from './structures/Transport'
import { IPCTransport, type FormatFunction } from './transport/IPC'
import { RPCError } from './utils/RPCError'

export type AuthorizeOptions = {
  scopes: (OAuth2Scopes | `${OAuth2Scopes}`)[]
  redirect_uri?: string
  prompt?: 'consent' | 'none'
  useRPCToken?: boolean
}

export interface ClientOptions {
  /**
   * application id
   */
  clientId: string
  /**
   * application secret
   */
  clientSecret?: string
  /**
   * pipe id
   */
  pipeId?: number
  /**
   * transport configs
   */
  transport?: {
    /**
     * transport type
     */
    type?: 'ipc' | 'websocket' | { new (options: TransportOptions): Transport }
    /**
     * ipc transport's path list
     */
    pathList?: FormatFunction[]
  }

  dispatcher?: Dispatcher
}

export type ClientEvents = {
  /**
   * fired when the client is ready
   */
  ready: () => void
  /**
   * fired when the client is connected to local rpc server
   */
  connected: () => void
  /**
   * fired when the client is disconnected from the local rpc server
   */
  disconnected: () => void
  /**
   * fired when the client is have debug message
   */
  debug: (...data: any[]) => void
}

export class Client extends EventEmitter {
  /**
   * application id
   */
  clientId: string
  /**
   * application secret
   */
  clientSecret?: string

  /**
   * pipe id
   */
  pipeId?: number

  private accessToken?: string
  private refreshToken?: string
  private tokenType = 'Bearer'

  /**
   * transport instance
   */
  readonly transport: Transport

  /**
   * current user
   */
  user?: ClientUser
  /**
   * current application
   */
  application?: APIApplication

  /**
   * @hidden
   */
  cdnHost = 'https://cdn.discordapp.com'
  /**
   * @hidden
   */
  origin = 'https://localhost'

  dispatcher?: Dispatcher

  get isConnected() {
    return this.transport.isConnected
  }

  private refreshTimeout?: ReturnType<typeof setTimeout>
  private connectionPromise?: Promise<void>
  private _nonceMap = new Map<
    string,
    {
      resolve: (value?: any) => void
      reject: (reason?: any) => void
      error: RPCError
    }
  >()

  constructor(options: ClientOptions) {
    super()

    this.clientId = options.clientId
    this.clientSecret = options.clientSecret
    this.dispatcher = options.dispatcher

    this.pipeId = options.pipeId

    this.transport = new IPCTransport({
      client: this,
      pathList: options.transport?.pathList,
    })

    this.transport.on('message', (message) => {
      if (message.cmd === 'DISPATCH' && message.evt === 'READY') {
        if (message.data.user) this.user = new ClientUser(this, message.data.user)
        if (message.data.config && message.data.config.cdn_host) {
          this.cdnHost = `https://${message.data.config.cdn_host}`
        }
        this.emit('connected')
      } else {
        if (message.nonce && this._nonceMap.has(message.nonce)) {
          const nonceObj = this._nonceMap.get(message.nonce)!

          if (message.evt === 'ERROR') {
            nonceObj.error.code = message.data.code
            nonceObj.error.message = message.data.message
            nonceObj?.reject(nonceObj.error)
          } else nonceObj?.resolve(message)

          this._nonceMap.delete(message.nonce)
        }

        this.emit((message as any).evt, message.data)
      }
    })
  }

  // #region Request Handlers

  /**
   * @hidden
   */
  async fetch(
    method: Dispatcher.HttpMethod,
    path: string,
    req?: { data?: any; query?: any; headers?: any },
  ): Promise<any> {
    const url = new URL(`https://discord.com/api${path}`)
    const result = await request(url, {
      method,
      query: req?.query,
      body: req?.data ?? undefined,
      headers: {
        ...req?.headers,
        ...(this.accessToken ? { Authorization: `${this.tokenType} ${this.accessToken}` } : {}),
      },
    })

    return await result.body.json()
  }

  /**
   * @hidden
   */
  async request<A = any, D = any>(
    cmd: RPC_CMD,
    args?: any,
    evt?: RPC_EVT,
  ): Promise<CommandIncoming<A, D>> {
    const error = new RPCError(RPC_ERROR_CODE.RPC_UNKNOWN_ERROR)
    RPCError.captureStackTrace(error, this.request)

    return new Promise((resolve, reject) => {
      const nonce = randomUUID()

      this.transport.send({ cmd, args, evt, nonce })
      this._nonceMap.set(nonce, { resolve, reject, error })
    })
  }

  // #endregion

  // #region Authorization handlers

  private async authenticate(): Promise<void> {
    const { application, user } = (
      await this.request('AUTHENTICATE', { access_token: this.accessToken ?? '' })
    ).data
    this.application = application
    this.user = new ClientUser(this, user)
    this.emit('ready')
  }

  private async refreshAccessToken(): Promise<void> {
    this.emit('debug', 'CLIENT | Refreshing access token!')

    this.hanleAccessTokenResponse(
      (
        await this.fetch('POST', '/oauth2/token', {
          query: {
            client_id: this.clientId,
            client_secret: this.clientSecret ?? '',
            grant_type: 'refresh_token',
            refresh_token: this.refreshToken ?? '',
          },
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
        })
      ).data,
    )
  }

  private hanleAccessTokenResponse(data: any): void {
    if (
      !('access_token' in data) ||
      !('refresh_token' in data) ||
      !('expires_in' in data) ||
      !('token_type' in data)
    ) {
      throw new TypeError(`Invalid access token response!\nData: ${JSON.stringify(data, null, 2)}`)
    }

    this.accessToken = data.access_token
    this.refreshToken = data.refresh_token
    this.tokenType = data.token_type

    this.refreshTimeout = setTimeout(() => this.refreshAccessToken(), data.expires_in)
  }

  private async authorize(options: AuthorizeOptions): Promise<void> {
    let rpcToken

    if (options.useRPCToken) {
      rpcToken = (
        await this.fetch('POST', '/oauth2/token/rpc', {
          data: new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret ?? '',
          }),
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
        })
      ).data.rpc_token
    }

    const { code } = (
      await this.request('AUTHORIZE', {
        scopes: options.scopes,
        client_id: this.clientId,
        rpc_token: options.useRPCToken ? rpcToken : undefined,
        redirect_uri: options.redirect_uri ?? undefined,
        prompt: options.prompt ?? 'consent',
      })
    ).data

    this.hanleAccessTokenResponse(
      (
        await this.fetch('POST', '/oauth2/token', {
          data: new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret ?? '',
            redirect_uri: options.redirect_uri ?? '',
            grant_type: 'authorization_code',
            code,
          }),
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
        })
      ).data,
    )
  }

  // #endregion

  /**
   * Used to subscribe to events. `evt` of the payload should be set to the event being subscribed to. `args` of the payload should be set to the args needed for the event.
   * @param event event name now subscribed to
   * @param args args for the event
   * @returns an object to unsubscribe from the event
   */
  async subscribe(
    event: Exclude<RPC_EVT, 'READY' | 'ERROR'>,
    args?: any,
  ): Promise<{ unsubscribe: () => void }> {
    await this.request('SUBSCRIBE', args, event)
    return {
      /**
       * Unsubscribes from the event
       */
      unsubscribe: () => this.request('UNSUBSCRIBE', args, event),
    }
  }

  /// ////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * connect to the local rpc server
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) return this.connectionPromise

    const error = new RPCError(RPC_ERROR_CODE.RPC_UNKNOWN_ERROR)
    RPCError.captureStackTrace(error, this.connect)

    this.connectionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.connectionPromise = undefined

        error.code = CUSTOM_RPC_ERROR_CODE.RPC_CONNECTION_TIMEOUT
        error.message = 'Connection timed out'

        reject(error)
      }, 10e3)
      timeout.unref()

      this.once('connected', () => {
        this.connectionPromise = undefined

        this.transport.once('close', (reason) => {
          this._nonceMap.forEach((promise) => {
            promise.error.code =
              typeof reason === 'object' ? reason!.code : CUSTOM_RPC_ERROR_CODE.RPC_CONNECTION_ENDED
            promise.error.message =
              typeof reason === 'object' ? reason!.message : (reason ?? 'Connection ended')
            promise.reject(promise.error)
          })

          this.emit('disconnected')
        })

        clearTimeout(timeout)
        resolve()
      })

      this.transport.connect().then(resolve, reject)
    })

    return this.connectionPromise
  }

  /**
   * will try to authorize if a scope is specified, else it's the same as `connect()`
   * @param options options for the authorization
   */
  async login(options?: AuthorizeOptions): Promise<void> {
    await this.connect()

    if (!options || !options.scopes) {
      this.emit('ready')
      return
    }

    await this.authorize(options)
    await this.authenticate()
  }

  /**
   * disconnects from the local rpc server
   */
  async destroy(): Promise<void> {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
      this.refreshTimeout = undefined
      this.refreshToken = undefined
    }

    await this.transport.close()
  }
}
