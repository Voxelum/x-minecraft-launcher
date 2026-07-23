export type CliHandler = (argv: string[], signal?: AbortSignal) => Promise<unknown>

export interface VirtualCliCommand {
  readonly name: string
  readonly usage: string
  readonly description: string
  readonly help?: readonly string[]
  readonly execute: CliHandler
}

export function usageError(usage: string, detail?: string) {
  return { error: `${detail ? `${detail}\n` : ''}Usage: ${usage}` }
}
