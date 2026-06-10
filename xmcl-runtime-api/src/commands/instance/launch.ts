import { z } from 'zod'
import { AuthlibInjectorServiceKey } from '../../services/AuthlibInjectorService'
import { BaseServiceKey } from '../../services/BaseService'
import { JavaServiceKey } from '../../services/JavaService'
import { LaunchServiceKey } from '../../services/LaunchService'
import { UserServiceKey } from '../../services/UserService'
import { VersionServiceKey } from '../../services/VersionService'
import { findMatchedVersion } from '../../entities/version'
import { generateLaunchOptionsWithGlobal } from '../../util/launch'
import { getAutoOrManuallJava, getAutoSelectedJava } from '../../util/java'
import { defineCommand } from '../registry'

function createOperationId() {
  const crypto = globalThis.crypto as Crypto | undefined
  if (crypto?.randomUUID) {
    return crypto.randomUUID()
  }
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Input schema for `instance.launch`. Mirrors the surface that both the
 * CLI direct-launch and the renderer launch composable need today.
 *
 * `modCount` is intentionally part of the input rather than computed inside
 * the handler: counting mod files requires file-system access, which would
 * pull a non-portable dependency into the otherwise pure command. Hosts
 * (backend / renderer) already have this number on hand and pass it in.
 */
export const LaunchInstanceInputSchema = z.object({
  /** Instance path or display name. Resolved by `ctx.resolveInstance`. */
  instance: z.string().min(1),
  /** User id or username. If omitted, falls back to `ctx.resolveUser()`. */
  user: z.string().optional(),
  /** Optional override for the side. Defaults to `'client'`. */
  side: z.enum(['client', 'server']).default('client'),
  /** Address of a server to auto-join after launch (client only). */
  server: z
    .object({
      host: z.string().min(1),
      port: z.number().int().min(1).max(65535).optional(),
    })
    .optional(),
  /** Number of mods present in the instance. Used by auto-memory assignment. */
  modCount: z.number().int().nonnegative().default(0),
  /** Skip launching, just produce the resolved options (debugging). */
  dry: z.boolean().default(false),
  /** Operation id for telemetry/log correlation. Defaults to a fresh uuid. */
  operationId: z.string().optional(),
})

export type LaunchInstanceInput = z.infer<typeof LaunchInstanceInputSchema>

/**
 * Result of `instance.launch`. The number is the spawned process id, or
 * `undefined` when `dry` is set or the launch was a no-op.
 */
export type LaunchInstanceResult = number | undefined

/**
 * Hybrid launch command. Produced launch options are computed via
 * `generateLaunchOptionsWithGlobal` so backend and renderer stay in lockstep.
 *
 * The handler does NOT touch the file system — every side effect goes
 * through the {@link CommandContext}.
 */
export const launchInstanceCommand = defineCommand({
  id: 'instance.launch',
  title: 'Launch Instance',
  description: 'Launch a Minecraft instance with the selected user.',
  category: 'instance',
  input: LaunchInstanceInputSchema,
  cli: {
    name: 'launch',
    positionals: ['instance'],
    flags: {
      user: { alias: 'u', description: 'User id or username' },
      side: { description: 'Launch side (client | server)' },
      dry: { type: 'boolean', description: 'Resolve options without launching' },
      modCount: { type: 'number', description: 'Override mod count for auto-memory assignment' },
    },
  },
  ui: {
    icon: 'play_arrow',
  },
  async handler(input, ctx): Promise<LaunchInstanceResult> {
    const operationId = input.operationId ?? createOperationId()

    const instance = await ctx.resolveInstance(input.instance)
    const user = await ctx.resolveUser(input.user)
    const refreshedUser = await ctx.call(UserServiceKey, 'refreshUser', user.id)

    // Resolve the matching local version for the instance.
    const localVersions = await ctx.call(VersionServiceKey, 'getLocalVersions')
    const versionHeader = findMatchedVersion(
      localVersions.local,
      instance.version,
      { ...instance.runtime },
    )
    if (!versionHeader) {
      throw new Error(`No local version matches instance '${instance.path}'`)
    }
    const resolvedVersion = await ctx.call(VersionServiceKey, 'resolveLocalVersion', versionHeader.id)

    // Resolve Java — auto-select then optionally override with the instance's pinned path.
    const javaState = await ctx.call(JavaServiceKey, 'getJavaState')
    const detected = getAutoSelectedJava(
      javaState.all,
      instance.runtime.minecraft,
      instance.runtime.forge,
      resolvedVersion,
    )
    const javaResult = await getAutoOrManuallJava(
      detected,
      (path) => ctx.call(JavaServiceKey, 'resolveJava', path),
      instance.java,
    )
    // Prefer the user-pinned Java only when it actually resolves. Otherwise
    // fall back to the auto-detected one — otherwise a stale pin (deleted /
    // moved JDK) would crash spawn with ENOENT instead of launching cleanly.
    const java = (javaResult.java?.valid ? javaResult.java : undefined) || javaResult.auto.java

    // Pull global settings (resolved once, read-only).
    const settings = await ctx.call(BaseServiceKey, 'getSettings')

    // Build the side-specific overrides.
    const overrides = input.server
      ? { server: { host: input.server.host, port: input.server.port } }
      : undefined

    const launchOptions = await generateLaunchOptionsWithGlobal(
      instance,
      refreshedUser,
      versionHeader.id,
      {
        token: '',
        operationId,
        side: input.side,
        overrides,
        dry: input.dry,
        javaPath: java?.path,
        globalEnv: settings.globalEnv,
        globalVmOptions: settings.globalVmOptions,
        globalMcOptions: settings.globalMcOptions,
        globalPrependCommand: settings.globalPrependCommand,
        globalAssignMemory: settings.globalAssignMemory,
        globalMinMemory: settings.globalMinMemory,
        globalMaxMemory: settings.globalMaxMemory,
        globalHideLauncher: settings.globalHideLauncher,
        globalShowLog: settings.globalShowLog,
        globalFastLaunch: settings.globalFastLaunch,
        globalDisableAuthlibInjector: settings.globalDisableAuthlibInjector,
        globalDisableElyByAuthlib: settings.globalDisableElyByAuthlib,
        globalPreExecuteCommand: settings.globalPreExecuteCommand,
        globalResolution: undefined,
        modCount: input.modCount,
        track: async (_, p) => p,
        getOrInstallAuthlibInjector: () =>
          ctx.call(AuthlibInjectorServiceKey, 'getOrInstallAuthlibInjector'),
      },
    )

    if (input.dry) {
      ctx.out.json({ ok: true, command: 'instance.launch', data: { dry: true, options: launchOptions } })
      return undefined
    }

    const pid = await ctx.call(LaunchServiceKey, 'launch', launchOptions)
    ctx.out.json({ ok: true, command: 'instance.launch', data: { pid } })
    return pid
  },
})
