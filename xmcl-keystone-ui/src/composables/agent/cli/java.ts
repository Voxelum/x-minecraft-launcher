import type { CliContext } from './context'
import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const JAVA_USAGE = 'java install [--major-version <number>] [--component <name>] [--zulu]'

export function createJavaCommand(cli: CliContext): VirtualCliCommand {
  return {
    name: 'java',
    usage: JAVA_USAGE,
    description: 'Install the Java runtime required by the current instance, or an explicitly requested runtime.',
    help: [
      '`java install` installs the runtime reported by `diagnose java`. If that requirement is unavailable, it falls back to Java 8 / `jre-legacy`.',
      '`--major-version <number>` overrides the Java major version.',
      '`--component <name>` overrides the Mojang runtime component, such as `jre-legacy` or `java-runtime-gamma`.',
      '`--zulu` forces the Zulu distribution instead of trying the official Mojang runtime first.',
      'When overriding one target field, the other field still defaults to the instance requirement, then Java 8 / `jre-legacy`.',
    ],
    execute: async (argv) => {
      if (argv[0] !== 'install') return usageError(JAVA_USAGE, 'Unknown Java operation.')
      let majorVersion: number | undefined
      let component: string | undefined
      let forceZulu = false
      for (let index = 1; index < argv.length; index++) {
        const option = argv[index]
        if (option === '--major-version') {
          if (majorVersion !== undefined) return usageError(JAVA_USAGE, 'Repeated --major-version option.')
          const value = argv[++index]
          const parsed = Number(value)
          if (!value || !Number.isSafeInteger(parsed) || parsed <= 0) return usageError(JAVA_USAGE, '--major-version must be a positive integer.')
          majorVersion = parsed
        } else if (option === '--component') {
          if (component !== undefined) return usageError(JAVA_USAGE, 'Repeated --component option.')
          component = argv[++index]
          if (!component || component.startsWith('-')) return usageError(JAVA_USAGE, '--component requires a value.')
        } else if (option === '--zulu') {
          if (forceZulu) return usageError(JAVA_USAGE, 'Repeated --zulu option.')
          forceZulu = true
        } else {
          return usageError(JAVA_USAGE, `Unknown Java install option: ${option}`)
        }
      }
      return cli.ctx.installJava({ majorVersion, component, forceZulu })
    },
  }
}
