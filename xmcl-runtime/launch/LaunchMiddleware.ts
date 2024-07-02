import { LaunchOption as ResolvedLaunchOptions, ResolvedVersion, MinecraftServerOptions } from '@xmcl/core'
import { LaunchOptions } from '@xmcl/runtime-api'

export interface LaunchMiddleware {
  name: string
  onBeforeLaunch(input: LaunchOptions, version: ResolvedVersion, output: ResolvedLaunchOptions | MinecraftServerOptions, context: Record<string, any>): Promise<void>
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
  }, version: ResolvedVersion, output: ResolvedLaunchOptions | MinecraftServerOptions, context: Record<string, any>): void
}
