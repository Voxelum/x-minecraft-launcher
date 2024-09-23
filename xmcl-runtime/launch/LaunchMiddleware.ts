import { LaunchOption as ResolvedLaunchOptions, ResolvedVersion, ServerOptions } from '@xmcl/core'
import { LaunchOptions, ResolvedServerVersion } from '@xmcl/runtime-api'

export interface ServerRunContext {
  side: 'server'
  version: ResolvedServerVersion
  options: ServerOptions
}

export interface ClientRunContext {
  side: 'client'
  version: ResolvedVersion
  options: ResolvedLaunchOptions
}

export interface LaunchMiddleware {
  name: string
  onBeforeLaunch(input: LaunchOptions, payload: ServerRunContext | ClientRunContext, context: Record<string, any>): Promise<void>
  onAfterLaunch?(result: {
    /**
     * The code of the process exit. This is the nodejs child process "exit" event arg.
     */
    code: number
    /**
     * The signal of the process exit. This is the nodejs child process "exit" event arg.
     */
    signal: string
    /**
     * The crash report content
     */
    crashReport: string
    /**
     * The location of the crash report
     */
    crashReportLocation: string
  }, payload: ServerRunContext | ClientRunContext, context: Record<string, any>): void
}
