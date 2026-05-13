/**
 * Rewrites every `http://launcher/...` URL the renderer hands to the
 * browser so it lands on the Wails AssetServer instead of going out
 * to the network.
 *
 * Background: the legacy Electron host registered `http://launcher/`
 * via `protocol.handle('http')`. Wails v3 alpha.89 only routes
 * `http://wails.localhost/...` requests through the user-supplied
 * AssetServer middleware (see `webview_window_windows.go`'s host
 * check), so requests to `http://launcher/...` would hit DNS and
 * 404. Rather than touch every Vue file that constructs these URLs,
 * we monkey-patch the four sinks that take a string and feed it to
 * the WebView:
 *
 *   - `HTMLImageElement.prototype.src` setter
 *   - `HTMLSourceElement.prototype.src` / `srcset` setters
 *   - `HTMLMediaElement.prototype.src` setter (`<audio>` / `<video>`)
 *   - `Element.prototype.setAttribute('src' | 'srcset' | 'href', …)`
 *   - global `fetch` + `XMLHttpRequest.open` (catches programmatic
 *     loads e.g. AppCachedImage)
 *
 * Additionally, cross-origin `fetch` / `XHR` calls to plain
 * `http(s)://...` URLs are rewritten to land on the AssetServer's
 * `/proxy?url=<encoded>` endpoint so the browser's CORS checks
 * resolve. The legacy Electron build performed every such fetch
 * through the main process's network stack, which had no SOP — Wails
 * v3 runs the WebView on a real origin (`http://wails.localhost`) so
 * cross-origin GETs to e.g. `bmclapi2.bangbang93.com` now fail with
 * the predictable "blocked by CORS policy" error. The proxy hands
 * the request off to the Go HTTP client and returns the response
 * with wildcard CORS headers.
 *
 * The patch is idempotent and a no-op when not running under Wails.
 */

const LEGACY_PREFIX = 'http://launcher/'
const WAILS_PREFIX = 'http://wails.localhost/'

// Hosts that already serve content from `wails.localhost` (the
// AssetServer + dev server proxy origin). Requests to these never
// need the CORS proxy.
function isLocalOrigin(u: URL): boolean {
  const host = u.hostname.toLowerCase()
  if (host === 'wails.localhost') return true
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
  // The renderer also receives `data:`, `blob:`, `file:` URLs; those
  // were filtered out by the caller before we reach this point.
  return false
}

// proxify wraps `url` in `http://wails.localhost/proxy?url=<encoded>`.
// Only applies to http/https external URLs.
function proxify(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url, WAILS_PREFIX)
  } catch {
    return url
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url
  if (isLocalOrigin(parsed)) return url
  // Already proxied? Don't double-wrap.
  if (parsed.pathname === '/proxy' && parsed.searchParams.has('url')) return url
  return WAILS_PREFIX + 'proxy?url=' + encodeURIComponent(parsed.toString())
}

function rewrite(url: unknown): string {
  if (typeof url !== 'string') return url as string
  if (url.startsWith(LEGACY_PREFIX)) {
    return WAILS_PREFIX + url.slice(LEGACY_PREFIX.length)
  }
  return url
}

function patchProperty(proto: object, name: string) {
  const desc = Object.getOwnPropertyDescriptor(proto, name)
  if (!desc || !desc.set || !desc.get) return
  const origSet = desc.set
  Object.defineProperty(proto, name, {
    configurable: true,
    enumerable: desc.enumerable,
    get: desc.get,
    set(value: unknown) {
      origSet.call(this, rewrite(value))
    },
  })
}

let installed = false

export function installMediaUrlShim() {
  if (installed) return
  installed = true

  // <img>, <source>, <audio>, <video>, <link> all expose `src` (or
  // `href`) as own-prototype properties. Patch the setter so reactive
  // bindings transparently land on the rewritten URL.
  if (typeof HTMLImageElement !== 'undefined') {
    patchProperty(HTMLImageElement.prototype, 'src')
    patchProperty(HTMLImageElement.prototype, 'srcset')
  }
  if (typeof HTMLSourceElement !== 'undefined') {
    patchProperty(HTMLSourceElement.prototype, 'src')
    patchProperty(HTMLSourceElement.prototype, 'srcset')
  }
  if (typeof HTMLMediaElement !== 'undefined') {
    patchProperty(HTMLMediaElement.prototype, 'src')
  }
  if (typeof HTMLLinkElement !== 'undefined') {
    patchProperty(HTMLLinkElement.prototype, 'href')
  }
  if (typeof HTMLAnchorElement !== 'undefined') {
    // Don't patch <a href> — the user clicking a link should keep the
    // original target. The launcher only renders launcher://-style
    // anchors via shell.openExternal.
  }

  // Some libraries set the attribute via setAttribute('src', …)
  // rather than the property — patch that too.
  if (typeof Element !== 'undefined') {
    const origSetAttribute = Element.prototype.setAttribute
    Element.prototype.setAttribute = function setAttribute(name: string, value: string) {
      if (name === 'src' || name === 'srcset' || name === 'href' || name === 'poster') {
        value = rewrite(value)
      }
      return origSetAttribute.call(this, name, value)
    }
  }

  // Catch programmatic fetch / XHR (e.g. AppCachedImage probes).
  if (typeof globalThis.fetch === 'function') {
    const origFetch = globalThis.fetch.bind(globalThis)
    globalThis.fetch = ((input: any, init?: RequestInit) => {
      // Step 1: legacy `http://launcher/` → `http://wails.localhost/`.
      // Step 2: cross-origin call → CORS proxy. Every method (GET /
      // POST / etc.) gets proxied because:
      //   - browser CORS blocks responses from external hosts that
      //     don't return permissive `Access-Control-*` headers; and
      //   - the Go-side proxy is the only place the CurseForge
      //     `x-api-key` (loaded from .env) gets injected.
      if (typeof input === 'string') {
        let url = rewrite(input)
        url = proxify(url)
        return origFetch(url, init)
      }
      if (input instanceof Request) {
        let url = rewrite(input.url)
        url = proxify(url)
        if (url !== input.url) {
          return origFetch(new Request(url, input), init)
        }
      }
      return origFetch(input, init)
    }) as typeof fetch
  }
  if (typeof XMLHttpRequest !== 'undefined') {
    const proto = XMLHttpRequest.prototype as any
    const origOpen = proto.open
    proto.open = function open(method: string, url: string, ...rest: any[]) {
      let next = rewrite(url)
      next = proxify(next)
      return origOpen.call(this, method, next, ...rest)
    }
  }
}
