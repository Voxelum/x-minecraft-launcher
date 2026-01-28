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
 * Uses .catch() to fallback to default values when individual fields are invalid.
 */
export const SettingSchema = z.object({
  /** The display language of the launcher */
  locale: z.string().catch(''),
  /** Should launcher auto download new update */
  autoDownload: z.boolean().catch(false),
  /** Should launcher auto install new update after app quit */
  autoInstallOnAppQuit: z.boolean().catch(false),
  /** Should launcher show the pre-release */
  allowPrerelease: z.boolean().catch(false),
  /** The download API set preferences */
  apiSetsPreference: z.enum(['mojang', 'bmcl', '']).catch(''),
  /** The supported unofficial api sets */
  apiSets: z.array(ApiSetSchema).catch([]),
  /** Allow turn server in p2p */
  allowTurn: z.boolean().catch(false),
  /** The http proxy address */
  httpProxy: z.string().catch(''),
  /** Is proxy setting enabled */
  httpProxyEnabled: z.boolean().catch(false),
  /** The launcher theme */
  theme: z.enum(['dark', 'light', 'system']).catch('dark'),
  /** Maximum number of sockets to allow per host */
  maxSockets: z.number().catch(64),
  /** Maximum number of sockets allowed for requesting API */
  maxAPISockets: z.number().catch(16),
  /** Replace natives setting */
  replaceNatives: z.union([z.literal('all'), z.literal('legacy-only'), z.literal(false)]).catch('legacy-only'),
  /** Global minimum memory */
  globalMinMemory: z.number().catch(0),
  /** Global maximum memory */
  globalMaxMemory: z.number().catch(0),
  /** Global assign memory setting */
  globalAssignMemory: z.union([z.boolean(), z.literal('auto')]).catch(false),
  /** Global VM options */
  globalVmOptions: z.array(z.string()).catch([]),
  /** Global Minecraft options */
  globalMcOptions: z.array(z.string()).catch([]),
  /** Global fast launch setting */
  globalFastLaunch: z.boolean().catch(false),
  /** Global hide launcher setting */
  globalHideLauncher: z.boolean().catch(true),
  /** Global show log setting */
  globalShowLog: z.boolean().catch(false),
  /** Global disable authlib injector */
  globalDisableAuthlibInjector: z.boolean().catch(false),
  /** Global disable Ely.by authlib */
  globalDisableElyByAuthlib: z.boolean().catch(false),
  /** Global prepend command */
  globalPrependCommand: z.string().catch(''),
  /** Global pre-execute command */
  globalPreExecuteCommand: z.string().catch(''),
  /** The launch environment variables */
  globalEnv: z.record(z.string(), z.string()).catch({}),
  /** Discord presence setting */
  discordPresence: z.boolean().catch(true),
  /** Developer mode setting */
  developerMode: z.boolean().catch(false),
  /** Disable telemetry setting */
  disableTelemetry: z.boolean().catch(false),
  /** Linux titlebar setting */
  linuxTitlebar: z.boolean().catch(false),
  /** Enable dedicated GPU optimization */
  enableDedicatedGPUOptimization: z.boolean().catch(true),
  /** Window translucency effect */
  windowTranslucent: z.boolean().catch(false),
  /** Global resolution settings for Minecraft */
  globalResolution: GlobalResolutionSchema.catch({}),
})

export type SettingSchema = z.infer<typeof SettingSchema>
