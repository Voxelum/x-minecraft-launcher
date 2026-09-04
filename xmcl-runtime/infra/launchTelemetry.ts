export interface MinecraftStartTelemetryInput {
  side?: 'client' | 'server'
  minecraft?: string
  forge?: string
  fabricLoader?: string
  server?: unknown
  preExecuteCommand?: string
}

export function getMinecraftStartTelemetry(input: MinecraftStartTelemetryInput) {
  const loader = input.forge
    ? 'forge'
    : input.fabricLoader
      ? 'fabric'
      : 'vanilla'
  return {
    side: input.side ?? 'client',
    minecraft: input.minecraft ?? 'unknown',
    loader,
    hasServerTarget: Boolean(input.server),
    hasPreExecuteCommand: Boolean(input.preExecuteCommand),
  }
}

export interface MinecraftExitTelemetryInput {
  code?: number
  signal?: string
  crashReport?: string
}

export function getMinecraftExitTelemetry(input: MinecraftExitTelemetryInput) {
  const hasCrashReport = Boolean(input.crashReport)
  const normalExit = input.code === 0 && !hasCrashReport
  return {
    outcome: normalExit ? 'normal' : hasCrashReport ? 'crash' : 'failed',
    exitCode: input.code ?? -1,
    signal: input.signal ?? 'none',
    hasCrashReport,
  }
}
