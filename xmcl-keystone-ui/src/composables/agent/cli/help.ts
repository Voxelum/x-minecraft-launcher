import type { VirtualCliCommand } from './types'
import { usageError } from './types'

export const HELP_USAGE = 'help [command] | help domains | help domain <name>'

export interface HelpDomain {
  description: string
  instructions: readonly string[]
}

export function createHelpCommand(commands: () => Iterable<VirtualCliCommand>, domains: Record<string, HelpDomain>): VirtualCliCommand {
  return {
    name: 'help',
    usage: HELP_USAGE,
    description: 'List virtual CLI commands or show detailed help for one command.',
    help: [
      '`help` lists all available commands and workflow domains.',
      '`help <command>` shows its exact syntax and behavioral notes.',
      '`help domains` lists workflow domains; `help domain <name>` shows one domain workflow.',
    ],
    execute: async (argv) => {
      const available = [...commands()]
      if (!argv.length) {
        return {
          commands: available.map(({ name, usage, description }) => ({ name, usage, description })),
          domains: Object.entries(domains).map(([name, { description }]) => ({ name, description })),
          note: 'Run `help <command>` for command details or `help domain <name>` for a workflow.',
        }
      }
      if (argv.length === 1 && argv[0] === 'domains') {
        return { domains: Object.entries(domains).map(([name, { description }]) => ({ name, description })) }
      }
      if (argv[0] === 'domain') {
        if (argv.length !== 2) return usageError(HELP_USAGE, 'help domain requires one domain name.')
        const domain = domains[argv[1]]
        if (!domain) return { error: `unknown help domain: ${argv[1]}\nUsage: ${HELP_USAGE}` }
        return { name: argv[1], description: domain.description, instructions: domain.instructions }
      }
      if (argv.length !== 1) return usageError(HELP_USAGE, 'help command lookup accepts one command name.')
      const command = available.find(({ name }) => name === argv[0])
      if (!command) return { error: `unknown virtual CLI command: ${argv[0]}\nUsage: ${HELP_USAGE}` }
      return {
        name: command.name,
        usage: command.usage,
        description: command.description,
        details: command.help?.length ? command.help : undefined,
      }
    },
  }
}
