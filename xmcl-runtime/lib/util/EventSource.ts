import EventEmitter from 'events'
import { Client, Dispatcher, request } from 'undici'

const httpsOptions = [
  'pfx', 'key', 'passphrase', 'cert', 'ca', 'ciphers',
  'rejectUnauthorized', 'secureProtocol', 'servername', 'checkServerIdentity',
]

const bom = [239, 187, 191]
const colon = 58
const space = 32
const lineFeed = 10
const carriageReturn = 13
// Beyond 256KB we could not observe any gain in performance
const maxBufferAheadAllocation = 1024 * 256
// Headers matching the pattern should be removed when redirecting to different origin
const reUnsafeHeader = /^(cookie|authorization)$/i

function hasBom(buf: Buffer) {
  return bom.every(function (charCode, index) {
    return buf[index] === charCode
  })
}

export class EventSource extends EventEmitter {
  static CONNECTING = 0 as const
  static OPEN = 1 as const
  static CLOSED = 2 as const

  private readyState: 0 | 1 | 2 = 0
  private reconnectInterval = 1000
  private connectionInProgress = false
  private controller: AbortController | undefined
  private client: Client
  /**
    * Creates a new EventSource object
    *
    * @param {String} url the URL to which to connect
    * @param {Object} [eventSourceInitDict] extra init params. See README for details.
    * @api public
    **/
  constructor(readonly url: string, eventSourceInitDict?: { headers?: Record<string, string> | undefined }) {
    super()
    const headers = eventSourceInitDict?.headers
    let hasNewOrigin = false

    this.client = new Client(new URL(url).origin, { bodyTimeout: 0, headersTimeout: 0, keepAliveTimeout: 4e6 })

    this.client.on('connectionError', () => {
      onConnectionClosed()
    }).on('disconnect', () => {
      onConnectionClosed()
    })

    const onConnectionClosed = (message?: any) => {
      if (this.readyState === EventSource.CLOSED) return
      this.readyState = EventSource.CONNECTING
      this.emit('error', new Event('error', { message: message }))

      // The url may have been changed by a temporary redirect. If that's the case,
      // revert it now, and flag that we are no longer pointing to a new origin
      if (reconnectUrl) {
        url = reconnectUrl
        reconnectUrl = null
        hasNewOrigin = false
      }
      setTimeout(() => {
        if (this.readyState !== EventSource.CONNECTING || this.connectionInProgress) {
          return
        }
        this.connectionInProgress = true
        connect()
      }, this.reconnectInterval)
    }

    let lastEventId = ''
    if (headers && headers['Last-Event-ID']) {
      lastEventId = headers['Last-Event-ID']
      delete headers['Last-Event-ID']
    }

    let discardTrailingNewline = false
    let data = ''
    let eventName = ''

    let reconnectUrl: string | null = null

    const connect = () => {
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache', Accept: 'text/event-stream' }
      if (lastEventId) headers['Last-Event-ID'] = lastEventId
      if (headers) {
        const reqHeaders = hasNewOrigin ? removeUnsafeHeaders(headers) : headers
        for (const i in reqHeaders) {
          const header = reqHeaders[i]
          if (header) {
            headers[i] = header
          }
        }
      }

      request(url, {
        headers,
        dispatcher: this.client,
      }).then(res => {
        this.connectionInProgress = false
        // Handle HTTP errors
        if (res.statusCode === 500 || res.statusCode === 502 || res.statusCode === 503 || res.statusCode === 504) {
          this.emit('error', new Event('error', { status: res.statusCode, message: ''/* res.statusMessage */ }))
          onConnectionClosed()
          return
        }

        // Handle HTTP redirects
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          const location = res.headers.location
          if (!location) {
            // Server sent redirect response without Location header.
            this.emit('error', new Event('error', { status: res.statusCode, message: ''/* res.statusMessage */ }))
            return
          }
          const prevOrigin = new URL(url).origin
          const nextOrigin = new URL(location).origin
          hasNewOrigin = prevOrigin !== nextOrigin
          if (res.statusCode === 307) reconnectUrl = url
          url = location
          process.nextTick(connect)
          return
        }

        if (res.statusCode !== 200) {
          this.emit('error', new Event('error', { status: res.statusCode, message: ''/* res.statusMessage */ }))
          return this.close()
        }

        this.readyState = EventSource.OPEN
        res.body.on('close', function () {
          res.body.removeAllListeners('close')
          res.body.removeAllListeners('end')
          onConnectionClosed()
        })

        res.body.on('end', function () {
          res.body.removeAllListeners('close')
          res.body.removeAllListeners('end')
          onConnectionClosed()
        })
        this.emit('open', new Event('open'))

        // text/event-stream parser adapted from webkit's
        // Source/WebCore/page/EventSource.cpp
        let buf: Buffer | undefined
        let newBuffer
        let startingPos = 0
        let startingFieldLength = -1
        let newBufferSize = 0
        let bytesUsed = 0

        res.body.on('data', (chunk: Buffer) => {
          if (!buf) {
            buf = chunk
            if (hasBom(buf)) {
              buf = buf.slice(bom.length)
            }
            bytesUsed = buf.length
          } else {
            if (chunk.length > buf.length - bytesUsed) {
              newBufferSize = (buf.length * 2) + chunk.length
              if (newBufferSize > maxBufferAheadAllocation) {
                newBufferSize = buf.length + chunk.length + maxBufferAheadAllocation
              }
              newBuffer = Buffer.alloc(newBufferSize)
              buf.copy(newBuffer, 0, 0, bytesUsed)
              buf = newBuffer
            }
            chunk.copy(buf, bytesUsed)
            bytesUsed += chunk.length
          }

          let pos = 0
          const length = bytesUsed

          while (pos < length) {
            if (discardTrailingNewline) {
              if (buf[pos] === lineFeed) {
                ++pos
              }
              discardTrailingNewline = false
            }

            let lineLength = -1
            let fieldLength = startingFieldLength

            for (let i = startingPos; lineLength < 0 && i < length; ++i) {
              const c = buf[i]
              if (c === colon) {
                if (fieldLength < 0) {
                  fieldLength = i - pos
                }
              } else if (c === carriageReturn) {
                discardTrailingNewline = true
                lineLength = i - pos
              } else if (c === lineFeed) {
                lineLength = i - pos
              }
            }

            if (lineLength < 0) {
              startingPos = length - pos
              startingFieldLength = fieldLength
              break
            } else {
              startingPos = 0
              startingFieldLength = -1
            }

            parseEventStreamLine(buf, pos, fieldLength, lineLength)

            pos += lineLength + 1
          }

          if (pos === length) {
            buf = undefined
            bytesUsed = 0
          } else if (pos > 0) {
            buf = buf.slice(pos, bytesUsed)
            bytesUsed = buf.length
          }
        })
      }, (err) => {
        this.connectionInProgress = false
        onConnectionClosed(err.message)
      })
    }

    connect()

    const parseEventStreamLine = (buf: Buffer, pos: number, fieldLength: number, lineLength: number) => {
      if (lineLength === 0) {
        if (data.length > 0) {
          const type = eventName || 'message'
          this.emit(type, new MessageEvent(type, {
            data: data.slice(0, -1), // remove trailing newline
            lastEventId: lastEventId,
            origin: new URL(url).origin,
          }))
          data = ''
        }
        eventName = ''
      } else if (fieldLength > 0) {
        const noValue = fieldLength < 0
        let step = 0
        const field = buf.slice(pos, pos + (noValue ? lineLength : fieldLength)).toString()

        if (noValue) {
          step = lineLength
        } else if (buf[pos + fieldLength + 1] !== space) {
          step = fieldLength + 1
        } else {
          step = fieldLength + 2
        }
        pos += step

        const valueLength = lineLength - step
        const value = buf.slice(pos, pos + valueLength).toString()

        if (field === 'data') {
          data += value + '\n'
        } else if (field === 'event') {
          eventName = value
        } else if (field === 'id') {
          lastEventId = value
        } else if (field === 'retry') {
          const retry = parseInt(value, 10)
          if (!Number.isNaN(retry)) {
            this.reconnectInterval = retry
          }
        }
      }
    }
  }

  /**
   * Closes the connection, if one is made, and sets the readyState attribute to 2 (closed)
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventSource/close
   * @api public
   */
  close () {
    if (this.readyState === EventSource.CLOSED) return
    this.readyState = EventSource.CLOSED
    this.controller?.abort()
  }

  /**
   * Emulates the W3C Browser based WebSocket interface using addEventListener.
   *
   * @param {String} type A string representing the event type to listen out for
   * @param {Function} listener callback
   * @see https://developer.mozilla.org/en/DOM/element.addEventListener
   * @see http://dev.w3.org/html5/websockets/#the-websocket-interface
   * @api public
   */
  addEventListener(type: string, listener: Function) {
    if (typeof listener === 'function') {
      // store a reference so we can return the original function again
      // @ts-ignore
      listener._listener = listener
      // @ts-ignore
      this.on(type, listener)
    }
  }

  /**
   * Emulates the W3C Browser based WebSocket interface using dispatchEvent.
   *
   * @param {Event} event An event to be dispatched
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent
   * @api public
   */
  dispatchEvent(event: Event) {
    if (!event.type) {
      throw new Error('UNSPECIFIED_EVENT_TYPE_ERR')
    }
    // if event is instance of an CustomEvent (or has 'details' property),
    // send the detail object as the payload for the event
    // @ts-ignore
    this.emit(event.type, event.detail)
  }

  /**
   * Emulates the W3C Browser based WebSocket interface using removeEventListener.
   *
   * @param {String} type A string representing the event type to remove
   * @param {Function} listener callback
   * @see https://developer.mozilla.org/en/DOM/element.removeEventListener
   * @see http://dev.w3.org/html5/websockets/#the-websocket-interface
   * @api public
   */
  removeEventListener(type: string, listener: Function) {
    if (typeof listener === 'function') {
      // @ts-ignore
      listener._listener = undefined
      // @ts-ignore
      this.removeListener(type, listener)
    }
  }

  get onmessage(): (ev: MessageEvent) => void {
    const listener = this.listeners('message')[0]
    // @ts-ignore
    return listener ? (listener._listener ? listener._listener : listener) : undefined
  }

  set onmessage(listener: (ev: MessageEvent) => void) {
    this.removeAllListeners('message')
    this.addEventListener('message', listener)
  }

  get onopen(): (ev: Event) => void {
    const listener = this.listeners('open')[0]
    // @ts-ignore
    return listener ? (listener._listener ? listener._listener : listener) : undefined
  }

  set onopen(listener: (ev: Event) => void) {
    this.removeAllListeners('open')
    this.addEventListener('open', listener)
  }

  get onerror(): (ev: Event) => void {
    const listener = this.listeners('error')[0]
    // @ts-ignore
    return listener ? (listener._listener ? listener._listener : listener) : undefined
  }

  set onerror(listener: (ev: Event) => void) {
    this.removeAllListeners('error')
    this.addEventListener('error', listener)
  }
}

// ['open', 'error', 'message'].forEach(function (method) {
//   Object.defineProperty(EventSource.prototype, 'on' + method, {
//     /**
//      * Returns the current listener
//      *
//      * @return {Mixed} the set function or undefined
//      * @api private
//      */
//     get: function get() {
//       const listener = this.listeners(method)[0]
//       return listener ? (listener._listener ? listener._listener : listener) : undefined
//     },

//     /**
//      * Start listening for events
//      *
//      * @param {Function} listener the listener
//      * @return {Mixed} the set function or undefined
//      * @api private
//      */
//     set: function set(listener) {
//       this.removeAllListeners(method)
//       this.addEventListener(method, listener)
//     },
//   })
// })

/**
 * W3C Event
 *
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#interface-Event
 * @api private
 */
class Event {
  constructor(readonly type: string, optionalProperties?: { [x: string]: any; message?: any; status?: any; hasOwnProperty?: any } | undefined) {
    if (optionalProperties) {
      for (const f in optionalProperties) {
        // eslint-disable-next-line no-prototype-builtins
        if (optionalProperties.hasOwnProperty(f)) {
          Object.defineProperty(this, f, { writable: false, value: optionalProperties[f], enumerable: true })
        }
      }
    }
  }
}
/**
 * W3C MessageEvent
 *
 * @see http://www.w3.org/TR/webmessaging/#event-definitions
 * @api private
 */
class MessageEvent {
  public data: any
  constructor(type: string, eventInitDict: { [x: string]: any; data?: string; lastEventId?: string; origin?: string; hasOwnProperty?: any }) {
    Object.defineProperty(this, 'type', { writable: false, value: type, enumerable: true })
    for (const f in eventInitDict) {
      // eslint-disable-next-line no-prototype-builtins
      if (eventInitDict.hasOwnProperty(f)) {
        Object.defineProperty(this, f, { writable: false, value: eventInitDict[f], enumerable: true })
      }
    }
  }
}

/**
 * Returns a new object of headers that does not include any authorization and cookie headers
 *
 * @param {Object} headers An object of headers ({[headerName]: headerValue})
 * @return {Object} a new object of headers
 * @api private
 */
function removeUnsafeHeaders(headers: { [x: string]: any }) {
  const safe = {} as Record<string, any>
  for (const key in headers) {
    if (reUnsafeHeader.test(key)) {
      continue
    }

    safe[key] = headers[key]
  }

  return safe
}
