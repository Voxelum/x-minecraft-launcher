import { ApplicationInsights } from '@microsoft/applicationinsights-web'
import { APP_INSIGHT_KEY } from '@xmcl/runtime-api'
import { i18n } from './i18n'

const appInsights = new ApplicationInsights({
  config: {
    connectionString: APP_INSIGHT_KEY,
    disableCookiesUsage: true,
    disableFetchTracking: true,
    disableAjaxTracking: true,
  },
})
appInsights.loadAppInsights()

const vuetifyDetachedOverlayMessage =
  "Failed to execute 'getComputedStyle' on 'Window': parameter 1 is not of type 'Element'."

export function isIgnorableRendererExceptionMessage(message: string) {
  return message.includes(vuetifyDetachedOverlayMessage)
}

// Add telemetry initializer to filter exceptions and enrich the ones we
// want to investigate with renderer-side context.
//
// See issue #1427: the previous version wrote `exception.locale = ...`
// directly to `envelope.data`, but the App Insights JS SDK promotes
// custom dimensions through `envelope.baseData.properties`, so the
// locale never reached `customDimensions` and the App Insights query
// `extend locale = tostring(customDimensions.locale)` came back empty
// for all 8 869 matching events / 902 users in a 14d window.
// Note on envelope shape (verified against
// @microsoft/applicationinsights-web 3.1.1 d.ts):
//
//   ITelemetryItem {
//     baseType?: 'ExceptionData' | ...
//     baseData?: IExceptionData  // <-- the actual exception payload
//     data?:     ICustomProperties  // <-- arbitrary user props, NOT the
//                                   //     exception payload
//   }
//   IExceptionData.exceptions: IExceptionDetails[]
//   IExceptionDetails: { typeName, message, stack, parsedStack, ... }
//
// All previous code in this file read `envelope.data.message`, which is
// always undefined for ExceptionData envelopes — meaning **every
// renderer suppression and the vue-i18n enrichment have been dead code
// since 0.56.5**. Confirmed in production: 0.56.7 telemetry shows the
// `isFixedPosition` Vuetify message still flowing through (458 users /
// 944 events in 7d) and `customDimensions` for the vue-i18n compile
// error contains only `{ typeName: 'SyntaxError' }` — no `locale`,
// `route`, or `snippet`. The shape fix here reactivates the entire
// suppression layer with no other behavioural changes.
appInsights.addTelemetryInitializer((envelope) => {
  if (envelope.baseType !== 'ExceptionData') return true
  const baseData = envelope.baseData as
    | { exceptions?: Array<{ typeName?: string; message?: string }> ; properties?: Record<string, any> }
    | undefined
  const detail = baseData?.exceptions?.[0]
  const message = detail?.message
  if (!message) return true

  if (message.includes('ResizeObserver loop')) {
    return false
  }
  if (message.includes('onMounted is called when there')) {
    return false
  }
  if (message.includes('Failed to fetch')) {
    return false
  }
  // Renderer-side fetch / SWR cancellations propagate when the user
  // navigates away while a Modrinth/Curse list is loading. Same
  // class as the runtime-side AbortError suppression in
  // ErrorDiagnose (issue #1453 batch).
  if (message === 'The operation was aborted' ||
      message === 'This operation was aborted' ||
      message.startsWith('AbortError')) {
    return false
  }
  // `getSWRV` throws this when a caller passes a model whose key
  // ref resolved to undefined (e.g. modpack panel mounted before
  // its instance ref is ready). The promise rejection already
  // re-renders the panel with the empty state -- no need to ship
  // a per-mount exception.
  if (message === 'Key is required') {
    return false
  }
  // Vuetify VChip `isFixedPosition` reads `getComputedStyle` on a
  // ref that can become null between mount and the next tick. The
  // resolved stack lives entirely in `VChip-*.js` (no app code), so
  // there is no patch we can apply -- only suppress here until the
  // upstream Vuetify fix lands. Issue #1426. With the envelope-shape
  // fix this finally takes effect.
  if (isIgnorableRendererExceptionMessage(message)) {
    return false
  }
  // vue-i18n message-compiler error. Production messages come back
  // as plain `SyntaxError: 24` (no JSON wrapper). Enrich with the
  // active locale, route, and the offending source snippet so the
  // next pass can locate the broken translation without leaking
  // user data.
  if (/^SyntaxError:\s*(?:\{\s*"code"\s*:\s*)?24\b/.test(message)) {
    const properties = (baseData!.properties = baseData!.properties ?? {})
    try {
      properties.locale = (i18n.global.locale as any).value
    } catch {}
    try {
      // The renderer uses createWebHashHistory, so the active route
      // lives in window.location.hash (e.g. "#/mod/foo"). Capturing
      // it lets us narrow the broken translation key to a single
      // screen in the next release.
      properties.route = typeof window !== 'undefined' ? window.location.hash : ''
    } catch {}
    try {
      const original: any = detail as any
      // vue-i18n attaches the offending source string to the error
      // (CompileErrorCodes 24 = unterminated string literal). Take
      // the first 80 chars only -- enough to identify the broken
      // ICU placeholder, short enough to stay below
      // customDimensions' 8 KB cap and to avoid spilling user
      // input from format-arguments.
      const src = original.location?.source ?? original.source ?? original.codeFrame
      if (typeof src === 'string') {
        properties.snippet = src.slice(0, 80)
      }
      if (typeof original.code === 'number' || typeof original.code === 'string') {
        properties.compileCode = String(original.code)
      }
    } catch {}
  }
  return true
})


export { appInsights }
