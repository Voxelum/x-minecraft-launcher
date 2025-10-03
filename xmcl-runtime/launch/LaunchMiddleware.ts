import { LaunchOption as ResolvedLaunchOptions, ResolvedVersion, ServerOptions, ResolvedServerVersion } from '@xmcl/core'
import { LaunchOptions } from '@xmcl/runtime-api'

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

export interface LaunchMetadata {
  /**
   * Whether Ely.by authlib was replaced
   */
  elyByAuthlibReplaced?: boolean
  /**
   * Whether the Ely.by authlib version is an exact match for the Minecraft version
   */
  elyByAuthlibExact?: boolean
  /**
   * The Minecraft version when Ely.by authlib was used
   */
  elyByMinecraftVersion?: string
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
    /**
     * The error log content
     */
    errorLog: string
  }, input: LaunchOptions, payload: ServerRunContext | ClientRunContext, context: Record<string, any>): void
}
