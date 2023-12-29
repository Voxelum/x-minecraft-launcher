import { LaunchOption as ResolvedLaunchOptions, ResolvedVersion } from '@xmcl/core'
import { LaunchOptions } from '@xmcl/runtime-api'

export interface LaunchMiddleware {
  name: string
  onBeforeLaunch(input: LaunchOptions, output: ResolvedLaunchOptions & { version: ResolvedVersion }, context: Record<string, any>): Promise<void>
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
  }, output: ResolvedLaunchOptions, context: Record<string, any>): void
}
