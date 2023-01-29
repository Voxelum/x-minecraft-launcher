import { createHash } from 'crypto'
import CachePolicy from 'http-cache-semantics'
import { Readable } from 'stream'
import { Agent, Dispatcher, errors, FormData } from 'undici'
import { URL } from 'url'
import { DispatchHandler } from './dispatcher'
import { buildHeaders } from './utils'
import { setTimeout } from 'timers/promises'
import { channel } from 'diagnostics_channel'

export interface StorageAdapter {
  get(key: string): Promise<any>
  put(key: string, obj: any, ttl?: number): Promise<void>
}

export interface CacheStorage {
  get(opts: Agent.DispatchOptions): Promise<CachedRequest | undefined>
  put(opts: Agent.DispatchOptions, req: CachedRequest): Promise<void>
}

export const kCacheKey = Symbol('cache')

export type WithCache<T> = T & { [kCacheKey]: CachedRequest }

export function assertErrorWithCache<T = unknown>(e: T): asserts e is WithCache<T> {
  if (typeof e === 'object' && !!e && kCacheKey in e && (e as any)[kCacheKey] instanceof CachedRequest) {
    return
  }
  throw e
}

/**
 * The cached request object.
 *
 * Contains the cache policy (methods, headers, url), body and trailers
 */
export class CachedRequest {
  constructor(readonly policy: CachePolicy, private body: Buffer, private trailer: string[]) {
  }

  static fromJSON([policy, data, trailer]: any) {
    return new CachedRequest(CachePolicy.fromObject(policy), Buffer.from(data, 'base64'), trailer)
  }

  isExpired(opts: Agent.DispatchOptions): boolean {
    const expired = !this.policy.satisfiesWithoutRevalidation({
      headers: buildHeaders(opts.headers || {}),
      method: opts.method,
      url: new URL(opts.path, opts.origin).toString(),
    })

    return expired
  }

  getStatusCode(): number {
    return (this.policy as any)._status
  }

  getHeaders(): string[] {
    return Object.entries(this.policy.responseHeaders()).map(v => [v[0], v[1] instanceof Array ? v[1].join(',') : v[1] ?? '']).reduce((a, b) => [...a, ...b], [] as string[])
  }

  getBody(): Buffer {
    return this.body
  }

  getBodyJson<T>(): T | undefined {
    if (this.body.length !== 0) {
      return JSON.parse(this.body.toString())
    }
  }

  getTrailers(): string[] {
    return this.trailer
  }

  toJSON() {
    return [this.policy.toObject(), this.body.toString('base64'), this.trailer]
  }
}

const cacheHeaderChannel = channel('undici:request:cache:headers')
const cacheCompleteChannel = channel('undici:request:cache:complete')
const cacheErrorChannel = channel('undici:request:cache:error')
const cacheTimeoutChannel = channel('undici:request:cache:timeout')

/**
 * The cache handler for undici
 */
export class CacheHandler extends DispatchHandler {
  private buffers: Buffer[] = []
  /**
   * Whether should we skip the data, error, complete as we will use cache
   */
  private skip = false

  private totalTimeout: AbortController
  private waitingHeader = true

  constructor(handler: Dispatcher.DispatchHandlers,
    private options: Dispatcher.DispatchOptions,
    private cacheStorage: CacheStorage,
    private dispatcher: Dispatcher,
    /**
     * policy from cached request
     */
    private headers: string[] | undefined,
    /**
     * policy from cached request
     */
    private policy: CachePolicy | undefined,
    /**
     * data from cached request
     */
    private body: Buffer | undefined,
    /**
     * trailers from cached request
     */
    private trailers: string[] | undefined,
    /**
     * If this request is reset to HEAD request to see if the cache is invalidated
     */
    private preflight: boolean,
  ) {
    super(handler)
    this.totalTimeout = new AbortController()
    setTimeout(15_000, undefined, this.totalTimeout).then(() => this.onTimeout(), () => { /* aborted */ })
  }

  onTimeout() {
    if (this.headers && this.body) {
      cacheTimeoutChannel.publish({ options: this.options, recovered: true })
      this.handler.onHeaders?.(200, this.headers, () => { })
      this.handler.onData?.(this.body)
      this.handler.onComplete?.(this.trailers || [])
    } else {
      cacheTimeoutChannel.publish({ options: this.options, recovered: false })
      this.handler.onError?.(new Error('Timeout'))
    }
  }

  onHeaders(statusCode: number, headers: string[] | null, resume: () => void): boolean {
    this.totalTimeout.abort()
    if (this.policy) {
      const respHeaders = buildHeaders(headers?.map(v => v.toString()) ?? [])
      const reqHeaders = buildHeaders(this.options.headers || [])

      const { policy, modified } = this.policy.revalidatedPolicy({
        headers: reqHeaders,
        // Replace method to GET to be consist cache method if this is a preflight
        method: this.preflight ? 'GET' : this.options.method,
        url: new URL(this.options.path, this.options.origin).toString(),
      }, {
        status: statusCode,
        headers: respHeaders,
      })

      this.skip = !modified
      this.policy = policy

      if (!modified) {
        // 304 not modified, can use cached body
        const result = super.onHeaders(statusCode, headers, resume)

        cacheHeaderChannel.publish({ options: this.options, modified, body: !!this.body, headers, precached: true })

        if (this.body) { super.onData(this.body) }
        super.onComplete(this.trailers || null)

        this.cacheStorage.put(this.options, new CachedRequest(policy, this.body || Buffer.from([]), this.trailers || []))
        this.policy = undefined
        this.body = undefined
        this.trailers = undefined

        resume()

        return result
      }

      if (this.preflight) {
        // Do not call super on header as we will retry using GET
        return false
      }

      cacheHeaderChannel.publish({ options: this.options, modified, body: !!this.body, headers, precached: true })

      return super.onHeaders(statusCode, headers, resume)
    }

    if (statusCode === 405 && this.preflight) {
      // Do not support HEAD request, need to skip this request and use GET
      return false
    }

    // Setup cache
    this.policy = new CachePolicy({
      headers: buildHeaders(this.options.headers || []),
      method: this.options.method,
      url: new URL(this.options.path, this.options.origin).toString(),
    }, {
      status: statusCode,
      headers: buildHeaders(headers?.map(v => v.toString()) ?? []),
    })

    cacheHeaderChannel.publish({ options: this.options, modified: true, body: !!this.body, headers, precached: false })

    return super.onHeaders(statusCode, headers, resume)
  }

  onData(chunk: Buffer): boolean {
    if (this.skip || this.preflight) {
      // Ignore data if this is preflight or we decide to use cache
      return true
    }

    if (this.policy?.storable()) {
      this.buffers.push(chunk)
    }

    return super.onData(chunk)
  }

  onError(err: Error): void {
    if (this.skip) {
      cacheErrorChannel.publish({ options: this.options, error: err, skip: this.skip })
      return
    }

    if (this.policy) {
      if (err instanceof errors.HeadersTimeoutError) {
        cacheErrorChannel.publish({ options: this.options, error: err, skip: false, retry: true, storable: true })
        const cache = new CachedRequest(this.policy, this.body || Buffer.from([]), this.trailers || [])
        super.onHeaders(cache.getStatusCode(), cache.getHeaders(), () => { })
        if (this.body) { super.onData(this.body) }
        super.onComplete(this.trailers || [])
      } else {
        cacheErrorChannel.publish({ options: this.options, error: err, skip: false, retry: false, storable: true })
        Object.assign(err, {
          [kCacheKey]: new CachedRequest(this.policy, this.body || Buffer.from([]), this.trailers || []),
        })
        super.onError(err)
      }
    } else {
      cacheErrorChannel.publish({ options: this.options, error: err, skip: false, retry: false, storable: false })
      super.onError(err)
    }

    this.trailers = undefined
    this.body = undefined
    this.buffers = []
    this.policy = undefined
  }

  onComplete(trailers: string[] | null): void {
    if (this.skip) {
      // Ignore completed if cache hit
      cacheCompleteChannel.publish({ options: this.options, skip: true })
      return
    }

    if (this.preflight) {
      // either we hit 304 or 405. We need do another GET request
      this.preflight = false
      this.dispatcher.dispatch({ ...this.options, method: 'GET' }, this)

      return
    }

    if (this.policy?.storable()) {
      this.cacheStorage.put(this.options, new CachedRequest(this.policy, Buffer.concat(this.buffers), trailers || []))
      cacheCompleteChannel.publish({ options: this.options, skip: false, storeable: true })

      this.buffers = []
      this.policy = undefined
      this.body = undefined
      this.trailers = undefined
    } else {
      cacheCompleteChannel.publish({ options: this.options, skip: false, storeable: false })
    }

    super.onComplete(trailers)
  }
}

export class JsonCacheStorage implements CacheStorage {
  constructor(private adapter: StorageAdapter) { }

  async get(opts: Agent.DispatchOptions): Promise<CachedRequest | undefined> {
    const key = await this.getKey(opts)
    if (key) {
      return this.adapter.get(key).then(CachedRequest.fromJSON, () => undefined)
    }
  }

  async put(opts: Agent.DispatchOptions, req: CachedRequest): Promise<void> {
    const key = await this.getKey(opts)
    if (key) {
      await this.adapter.put(key, req.toJSON(), req.policy.timeToLive())
    }
  }

  protected async getKey(opts: Agent.DispatchOptions) {
    let key = `${opts.method}:${new URL(opts.path + opts.query ?? '', opts.origin).toString()}`
    if (opts.body && (opts.method === 'POST' || opts.method === 'PATCH' || opts.method === 'PUT')) {
      if (opts.body instanceof Readable) {
        // Do not support cache for readable
        return
      } else if (opts.body instanceof FormData) {
        const hash = createHash('md5')
        for (const [k, v] of opts.body) {
          if (typeof v === 'string') {
            hash.update(k).update(v)
          } else {
            hash.update(k).update(Buffer.from(await v.arrayBuffer()))
          }
        }
        key += `:${hash.digest('base64')}`
      } else {
        key += `:${createHash('md5').update(opts.body).digest('base64')}`
      }
    }
    return key
  }
}

export class CacheDispatcher extends Dispatcher {
  constructor(private dispatcher: Dispatcher, private cache: CacheStorage) {
    super()
    this.close = dispatcher.close.bind(dispatcher)
    this.destroy = dispatcher.destroy.bind(dispatcher)
  }

  dispatch(opts: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandlers): boolean {
    const dispatch = (cachedRequest?: CachedRequest) => {
      const preflight = false
      return this.dispatcher.dispatch(
        {
          ...opts,
          method: preflight ? 'HEAD' : opts.method,
        },
        new CacheHandler(handler, opts, this.cache, this.dispatcher, cachedRequest?.getHeaders(), cachedRequest?.policy, cachedRequest?.getBody(), cachedRequest?.getTrailers(), preflight),
      )
    }

    if (opts.cacheStrategy === 'network-only') {
      return this.dispatcher.dispatch(opts, handler)
    }

    this.cache.get(opts).then((cachedRequest) => {
      if (!cachedRequest) {
        dispatch()
        return
      }

      if (!cachedRequest.isExpired(opts)) {
        // Not expired, use cache directly
        handler.onHeaders?.(cachedRequest.getStatusCode(), cachedRequest.getHeaders(), () => { })
        handler.onData?.(cachedRequest.getBody())
        handler.onComplete?.(cachedRequest.getTrailers())
        // console.log(`[CACHE] ${opts.method} ${opts.origin}${opts.path} -> not expired! use cache without request!`)
        return
      }

      console.log(`[CACHE] ${opts.method} ${opts.origin}${opts.path} -> expired, try to request with headers ${JSON.stringify(opts.headers)}`)
      // Send revalidate request
      opts.headers = cachedRequest.policy.revalidationHeaders({ headers: buildHeaders(opts.headers ?? {}), url: opts.origin + opts.path, method: opts.method })
      dispatch(cachedRequest)
    }, () => {
      dispatch()
    })

    return false
  }
}
