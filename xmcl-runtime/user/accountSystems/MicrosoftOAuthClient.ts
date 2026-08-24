import { AccountInfo, DeviceCodeResponse, INativeBrokerPlugin } from '@azure/msal-common'
import { AuthenticationResult, LogLevel, PublicClientApplication } from '@azure/msal-node'
import { AnyError } from '@xmcl/utils'
import { randomUUID } from 'crypto'
import { copyFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { MicrosoftAuthTelemetryEvent } from '~/app'
import { SecretStorage } from '~/app/SecretStorage'
import { Logger } from '~/infra'
import { createPlugin } from '../credentialPlugin'
import { isNetworkError, isUserCanceledError } from './MicrosoftAuthErrors'
import { createNetworkClient } from './OAuthNetworkClient'

export const MICROSOFT_GRAPH_USER_READ_SCOPE = 'User.Read'
export const MICROSOFT_XBOX_LAUNCHER_SCOPES = [
  'XboxLive.signin',
  'XboxLive.offline_access',
  'offline_access',
]

let nativeBrokerRuntimePrepared = false
let nativeBrokerPlugin: INativeBrokerPlugin | undefined
let nativeBrokerPluginInitialized = false
let nativeBrokerPluginPromise: Promise<INativeBrokerPlugin | undefined> | undefined

interface MsalDiagnostic {
  status?: string
  errorCode?: string
}

interface Authentication {
  result: AuthenticationResult
  extra?: AuthenticationResult
}

interface SilentAuthentication {
  account?: AccountInfo
  authentication?: Authentication
}

interface AuthenticateOptions {
  signal?: AbortSignal
  useDeviceCode?: boolean
  code?: string
  slientOnly?: boolean
  extraScopes?: string[]
  directRedirectToLauncher?: boolean
  useNativeBroker?: boolean
}

type TrackAuthentication = (
  name: MicrosoftAuthTelemetryEvent['name'],
  properties: Record<string, string | number | boolean>,
  measurements?: Record<string, number>,
) => void

function parseMsalDiagnostic(message: string): MsalDiagnostic {
  return {
    status: /StatusInternal::([^,\s]+)/.exec(message)?.[1],
    errorCode: /Error Code ([0-9]+)/.exec(message)?.[1],
  }
}

function getSafeErrorProperties(error: unknown) {
  const result: Record<string, string | number | boolean> = {}
  const toSafeCode = (value: unknown) => {
    const text = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
    return /^[a-z0-9_.-]{1,128}$/i.test(text) ? text : undefined
  }
  const errorName = error instanceof Error ? toSafeCode(error.name) : undefined
  if (errorName) {
    result.errorName = errorName
  }
  const candidate = error as { errorCode?: unknown; subError?: unknown } | undefined
  const errorCode = toSafeCode(candidate?.errorCode)
  if (errorCode) {
    result.errorCode = errorCode
  }
  const subError = toSafeCode(candidate?.subError)
  if (subError) {
    result.subError = subError
  }
  return result
}

export class MicrosoftOAuthClient {
  constructor(
    private fetch: typeof global.fetch,
    private logger: Logger,
    readonly clientId: string,
    private getCode: (url: string, redirectUri: string, signal?: AbortSignal, authAttemptId?: string) => Promise<string>,
    private getRedirectUrl: (preferLocalHost: boolean) => Promise<string>,
    private deviceCodeCallback: (deviceCodeResponse: DeviceCodeResponse) => void,
    private storage: SecretStorage,
    private getWindowHandle?: () => Buffer | undefined,
    private emitTelemetry?: (event: MicrosoftAuthTelemetryEvent) => void,
  ) {
  }

  private async getNativeBrokerPlugin() {
    if (process.platform !== 'win32') {
      return undefined
    }
    if (nativeBrokerPluginInitialized) {
      return nativeBrokerPlugin
    }
    if (nativeBrokerPluginPromise) {
      return nativeBrokerPluginPromise
    }
    const operation = (async () => {
      try {
        this.prepareNativeBrokerRuntime()
        const { NativeBrokerPlugin } = await import('@azure/msal-node-extensions')
        const plugin = new NativeBrokerPlugin()
        return plugin.isBrokerAvailable ? plugin : undefined
      } catch (e) {
        this.logger.warn('Unable to load the Windows native broker plugin')
        this.logger.warn(e)
        return undefined
      }
    })()
    nativeBrokerPluginPromise = operation
    try {
      nativeBrokerPlugin = await operation
      nativeBrokerPluginInitialized = true
      return nativeBrokerPlugin
    } finally {
      if (nativeBrokerPluginPromise === operation) {
        nativeBrokerPluginPromise = undefined
      }
    }
  }

  private prepareNativeBrokerRuntime() {
    if (nativeBrokerRuntimePrepared) return

    const arch = process.arch === 'ia32' ? 'ia32' : 'x64'
    const target = join(tmpdir(), 'xmcl-msal-node-runtime', String(process.pid), arch)
    mkdirSync(target, { recursive: true })
    const targetNode = join(target, 'msal-node-runtime.node')
    copyFileSync(join(__dirname, `msal-node-runtime-${arch}.node`), targetNode)
    copyFileSync(join(__dirname, `msalruntime-${arch}.dll`), join(target, 'msalruntime.dll'))
    process.env.XMCL_MSAL_NODE_RUNTIME_PATH = targetNode
    nativeBrokerRuntimePrepared = true
  }

  protected async getOAuthApp(
    signal?: AbortSignal,
    nativeBrokerPlugin?: INativeBrokerPlugin,
    onDiagnostic?: (diagnostic: MsalDiagnostic) => void,
  ) {
    return new PublicClientApplication({
      auth: {
        authority: 'https://login.microsoftonline.com/consumers/',
        clientId: this.clientId,
      },
      broker: nativeBrokerPlugin ? { nativeBrokerPlugin } : undefined,
      cache: {
        cachePlugin: createPlugin('xmcl-oauth', this.logger, this.storage),
      },
      system: {
        loggerOptions: {
          logLevel: LogLevel.Error,
          loggerCallback: (level, message) => {
            if (level === LogLevel.Error) {
              const diagnostic = parseMsalDiagnostic(message)
              onDiagnostic?.(diagnostic)
              const status = diagnostic.status ? `: ${diagnostic.status}` : ''
              const errorCode = diagnostic.errorCode ? ` (${diagnostic.errorCode})` : ''
              this.logger.warn(`Microsoft authentication diagnostic${status}${errorCode}`)
            }
          },
        },
        networkClient: createNetworkClient(this.fetch, signal),
      },
    })
  }

  private async acquireSilently(
    app: PublicClientApplication,
    username: string,
    scopes: string[],
    extraScopes: string[] | undefined,
  ): Promise<SilentAuthentication> {
    const accounts = await app.getAllAccounts().catch((error) => {
      this.logger.warn(`Microsoft account lookup failed: ${JSON.stringify(getSafeErrorProperties(error))}`)
      return []
    })
    const account = accounts.find(value => value.username.toLowerCase() === username.toLowerCase())
    if (!account) {
      this.logger.warn(`Microsoft silent token acquisition missed: no matching account (accountCount=${accounts.length}).`)
      return {}
    }

    const result = await app.acquireTokenSilent({
      scopes,
      account,
      forceRefresh: false,
    }).catch((error) => {
      this.logger.warn(`Microsoft silent token acquisition missed: ${JSON.stringify(getSafeErrorProperties(error))}`)
      return null
    })
    if (!result) return { account }

    const extra = extraScopes
      ? await app.acquireTokenSilent({ scopes: extraScopes, account }).catch((error) => {
        this.logger.warn(`Microsoft silent extra-scope acquisition missed: ${JSON.stringify(getSafeErrorProperties(error))}`)
        return undefined
      }) ?? undefined
      : undefined
    return { account, authentication: { result, extra } }
  }

  private async acquireInteractively(
    app: PublicClientApplication,
    nativeBrokerPlugin: INativeBrokerPlugin | undefined,
    brokerDiagnostic: MsalDiagnostic,
    account: AccountInfo | undefined,
    username: string,
    scopes: string[],
    options: AuthenticateOptions,
    windowHandle: Buffer | undefined,
    authAttemptId: string,
    track: TrackAuthentication,
  ): Promise<Authentication & { routeUsed: string; fallbackUsed: boolean }> {
    let result: AuthenticationResult | null = null
    let routeUsed = 'device_code'
    let fallbackUsed = false

    if (options.useDeviceCode) {
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          app.acquireTokenByDeviceCode({
            scopes,
            deviceCodeCallback: this.deviceCodeCallback,
            cancel: true,
          })
        })
      }
      result = await app.acquireTokenByDeviceCode({
        scopes,
        deviceCodeCallback: this.deviceCodeCallback,
      })
    } else {
      if (nativeBrokerPlugin) {
        routeUsed = 'wam'
        const brokerStartedAt = Date.now()
        try {
          result = await app.acquireTokenInteractive({
            scopes,
            extraScopesToConsent: options.extraScopes,
            account,
            loginHint: username || undefined,
            prompt: 'select_account',
            openBrowser: async () => {},
            windowHandle,
          })
          if (account && result.account?.homeAccountId !== account.homeAccountId) {
            track('microsoft-auth-broker-result', {
              outcome: 'account_mismatch',
              fallbackReason: 'different_account',
              ...(brokerDiagnostic.status ? { msalStatus: brokerDiagnostic.status } : {}),
              ...(brokerDiagnostic.errorCode ? { msalInternalErrorCode: brokerDiagnostic.errorCode } : {}),
            }, { durationMs: Date.now() - brokerStartedAt })
            this.logger.warn('Microsoft broker returned a different account; falling back to WebView.')
            result = null
          } else {
            track('microsoft-auth-broker-result', {
              outcome: 'success',
              ...(brokerDiagnostic.status ? { msalStatus: brokerDiagnostic.status } : {}),
              ...(brokerDiagnostic.errorCode ? { msalInternalErrorCode: brokerDiagnostic.errorCode } : {}),
            }, { durationMs: Date.now() - brokerStartedAt })
          }
        } catch (error) {
          const canceled = isUserCanceledError(error)
          track('microsoft-auth-broker-result', {
            outcome: canceled ? 'user_cancelled' : 'error',
            ...getSafeErrorProperties(error),
            ...(brokerDiagnostic.status ? { msalStatus: brokerDiagnostic.status } : {}),
            ...(brokerDiagnostic.errorCode ? { msalInternalErrorCode: brokerDiagnostic.errorCode } : {}),
          }, { durationMs: Date.now() - brokerStartedAt })
          if (canceled) throw error
          this.logger.warn('Microsoft broker authentication failed; falling back to WebView.')
        }
      }

      if (!result) {
        routeUsed = options.code ? 'authorization_code' : 'webview'
        fallbackUsed = Boolean(nativeBrokerPlugin)
        const redirectUri = await this.getRedirectUrl(options.directRedirectToLauncher ?? false)
        let code = options.code
        if (!code) {
          const url = await app.getAuthCodeUrl({
            redirectUri,
            scopes,
            extraScopesToConsent: options.extraScopes,
            loginHint: username,
            prompt: 'select_account',
          })
          code = await this.getCode(url, redirectUri, options.signal, authAttemptId)
        }
        result = await app.acquireTokenByCode({ code, scopes, redirectUri })
      }
    }

    if (!result) {
      throw new AnyError('MicrosoftOAuthEmptyResult', 'Microsoft authentication returned no result.')
    }
    if (account && result.account?.homeAccountId !== account.homeAccountId) {
      throw new AnyError(
        'MicrosoftOAuthAccountMismatch',
        `Microsoft authentication returned a different account than ${username}.`,
      )
    }
    let extra: AuthenticationResult | undefined
    if (options.extraScopes && result.account) {
      extra = await app.acquireTokenSilent({
        account: result.account,
        scopes: options.extraScopes,
      }).catch((error) => {
        this.logger.warn(`Microsoft silent extra-scope acquisition missed: ${JSON.stringify(getSafeErrorProperties(error))}`)
        return undefined
      }) ?? undefined
    }
    return { result, extra, routeUsed, fallbackUsed }
  }

  async authenticate(username: string, scopes: string[], options: AuthenticateOptions = {}) {
    const telemetry = {
      attemptId: randomUUID(),
      startedAt: Date.now(),
      routeUsed: 'silent',
      fallbackUsed: false,
      cachedAccount: false,
      completed: false,
    }
    const track: TrackAuthentication = (name, properties, measurements) => {
      this.emitTelemetry?.({
        name,
        properties: {
          authAttemptId: telemetry.attemptId,
          ...properties,
        },
        measurements,
      })
    }
    const complete = (outcome: string, error?: unknown) => {
      if (telemetry.completed) return
      telemetry.completed = true
      track('microsoft-auth-complete', {
        outcome,
        routeUsed: telemetry.routeUsed,
        fallbackUsed: telemetry.fallbackUsed,
        cachedAccount: telemetry.cachedAccount,
        ...getSafeErrorProperties(error),
      }, {
        durationMs: Date.now() - telemetry.startedAt,
      })
    }

    try {
      const nativeBrokerPlugin = options.useNativeBroker
        ? await this.getNativeBrokerPlugin()
        : undefined
      const windowHandle = nativeBrokerPlugin && !options.slientOnly ? this.getWindowHandle?.() : undefined
      track('microsoft-auth-start', {
        preferredFlow: options.slientOnly ? 'silent' : options.useDeviceCode ? 'device_code' : options.useNativeBroker ? 'wam' : 'webview',
        brokerRequested: Boolean(options.useNativeBroker),
        brokerAvailable: Boolean(nativeBrokerPlugin),
        windowHandleAvailable: Boolean(windowHandle),
        existingAccount: Boolean(username),
      })

      let brokerDiagnostic: MsalDiagnostic = {}
      const app = await this.getOAuthApp(
        options.signal,
        options.useDeviceCode ? undefined : nativeBrokerPlugin,
        diagnostic => { brokerDiagnostic = diagnostic },
      )
      let account: AccountInfo | undefined
      const allowSilentReuse = options.slientOnly || !options.useDeviceCode
      if (username && !options.code && allowSilentReuse) {
        const silent = await this.acquireSilently(
          app,
          username,
          scopes,
          options.extraScopes,
        )
        account = silent.account
        telemetry.cachedAccount = Boolean(account)
        telemetry.routeUsed = nativeBrokerPlugin && account?.nativeAccountId ? 'wam' : 'silent'
        if (silent.authentication) {
          complete('success')
          return silent.authentication
        }
      }

      if (options.slientOnly) {
        throw new AnyError('MicrosoftOAuthSlientFailed', 'Fail to acquire Microsoft token silently.')
      }

      telemetry.routeUsed = options.useDeviceCode
        ? 'device_code'
        : nativeBrokerPlugin
          ? 'wam'
          : options.code
            ? 'authorization_code'
            : 'webview'
      const authentication = await this.acquireInteractively(
        app,
        nativeBrokerPlugin,
        brokerDiagnostic,
        account,
        username,
        scopes,
        options,
        windowHandle,
        telemetry.attemptId,
        track,
      )
      telemetry.routeUsed = authentication.routeUsed
      telemetry.fallbackUsed = authentication.fallbackUsed

      complete('success')
      return {
        result: authentication.result,
        extra: authentication.extra,
      }
    } catch (e) {
      complete(
        options.signal?.aborted
          ? 'aborted'
          : (e as Error | undefined)?.name === 'MicrosoftOAuthSlientFailed'
            ? 'silent_miss'
          : isUserCanceledError(e)
            ? 'user_cancelled'
            : isNetworkError(e)
              ? 'network_error'
              : 'error',
        e,
      )
      throw e
    }
  }
}
