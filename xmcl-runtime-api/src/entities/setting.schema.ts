import { z } from 'zod'

/**
 * API set configuration.
 */
export const ApiSetSchema = z.object({
  name: z.string(),
  url: z.string(),
})

/**
 * Global resolution settings.
 */
export const GlobalResolutionSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  fullscreen: z.boolean().optional(),
})

/**
 * Launcher settings schema.
 * Zod schema for runtime validation with defaults.
 */
export const SettingSchema = z.object({
  /** The display language of the launcher */
  locale: z.string().default(''),
  /** Should launcher auto download new update */
  autoDownload: z.boolean().default(false),
  /** Should launcher auto install new update after app quit */
  autoInstallOnAppQuit: z.boolean().default(false),
  /** Should launcher show the pre-release */
  allowPrerelease: z.boolean().default(false),
  /** The download API set preferences */
  apiSetsPreference: z.enum(['mojang', 'bmcl', '']).default(''),
  /** The supported unofficial api sets */
  apiSets: z.array(ApiSetSchema).default([]),
  /** Allow turn server in p2p */
  allowTurn: z.boolean().default(false),
  /** The http proxy address */
  httpProxy: z.string().default(''),
  /** Is proxy setting enabled */
  httpProxyEnabled: z.boolean().default(false),
  /** The launcher theme */
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  /** Maximum number of sockets to allow per host */
  maxSockets: z.number().default(64),
  /** Maximum number of sockets allowed for requesting API */
  maxAPISockets: z.number().optional().default(16),
  /** Replace natives setting */
  replaceNatives: z.union([z.literal('all'), z.literal('legacy-only'), z.literal(false)]).default('legacy-only'),
  /** Global minimum memory */
  globalMinMemory: z.number().default(0),
  /** Global maximum memory */
  globalMaxMemory: z.number().default(0),
  /** Global assign memory setting */
  globalAssignMemory: z.union([z.boolean(), z.literal('auto')]).default(false),
  /** Global VM options */
  globalVmOptions: z.array(z.string()).default([]),
  /** Global Minecraft options */
  globalMcOptions: z.array(z.string()).default([]),
  /** Global fast launch setting */
  globalFastLaunch: z.boolean().default(false),
  /** Global hide launcher setting */
  globalHideLauncher: z.boolean().default(true),
  /** Global show log setting */
  globalShowLog: z.boolean().default(false),
  /** Global disable authlib injector */
  globalDisableAuthlibInjector: z.boolean().default(false),
  /** Global disable Ely.by authlib */
  globalDisableElyByAuthlib: z.boolean().default(false),
  /** Global prepend command */
  globalPrependCommand: z.string().default(''),
  /** Global pre-execute command */
  globalPreExecuteCommand: z.string().default(''),
  /** The launch environment variables */
  globalEnv: z.record(z.string(), z.string()).default({}),
  /** Discord presence setting */
  discordPresence: z.boolean().default(true),
  /** Developer mode setting */
  developerMode: z.boolean().default(false),
  /** Disable telemetry setting */
  disableTelemetry: z.boolean().default(false),
  /** Linux titlebar setting */
  linuxTitlebar: z.boolean().default(false),
  /** Enable dedicated GPU optimization */
  enableDedicatedGPUOptimization: z.boolean().default(true),
  /** Window translucency effect */
  windowTranslucent: z.boolean().default(false),
  /** Global resolution settings for Minecraft */
  globalResolution: GlobalResolutionSchema.default({}),
})

export type SettingSchema = z.infer<typeof SettingSchema>
