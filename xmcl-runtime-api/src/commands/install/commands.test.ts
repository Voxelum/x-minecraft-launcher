import { describe, expect, test, vi } from 'vitest'
import { parseCli } from '../cli'
import { CommandRegistry } from '../registry'
import type { CommandContext, CommandMode, TaskHandle } from '../types'
import { installModCommand } from './commands'

function makeContext(mode: CommandMode) {
  const log = vi.fn()
  const taskHandle: TaskHandle = {
    update: vi.fn(),
    child: () => taskHandle,
  }
  const ctx: CommandContext = {
    mode,
    signal: new AbortController().signal,
    call: vi.fn((_key: unknown, method: string) => Promise.resolve(
      method === 'resolveFromMarket' ? [{ path: 'mods/example.jar' }] : undefined,
    )) as CommandContext['call'],
    state: vi.fn() as CommandContext['state'],
    resolveInstance: vi.fn(async () => ({ path: '/instance' })) as unknown as CommandContext['resolveInstance'],
    resolveUser: vi.fn() as CommandContext['resolveUser'],
    pickInstance: vi.fn() as CommandContext['pickInstance'],
    pickUser: vi.fn() as CommandContext['pickUser'],
    prompt: vi.fn() as CommandContext['prompt'],
    confirm: vi.fn() as CommandContext['confirm'],
    select: vi.fn() as CommandContext['select'],
    task: vi.fn(async (_name, run) => run(taskHandle)) as CommandContext['task'],
    out: { log, json: vi.fn(), table: vi.fn() },
  }
  return { ctx, log }
}

describe('staged install output', () => {
  test('documents the exact provider ref syntax in command help metadata', () => {
    expect(installModCommand.description).toContain('modrinth:<project>@<version>')
    expect(installModCommand.description).toContain('curseforge:<projectId>/<fileId>')
    expect(installModCommand.input.parse({ instance: '/instance', ref: 'modrinth:example@version' }).dependencies).toBe(true)
  })

  test('parses the dependency opt-out while leaving the ref for schema normalization', () => {
    const registry = new CommandRegistry()
    registry.register(installModCommand)

    expect(parseCli(['install-mod', 'modrinth:example@version', '--no-dependencies'], registry)).toMatchObject({
      kind: 'command',
      commandId: 'mod.install',
      input: {
        ref: 'modrinth:example@version',
        dependencies: false,
      },
    })
  })

  test('keeps dependency resolution as renderer adapter policy', async () => {
    const { ctx } = makeContext('renderer')

    await installModCommand.handler({
      instance: '/instance',
      ref: { source: 'modrinth', project: 'example', version: 'version' },
      dependencies: false,
    }, ctx)

    expect(ctx.call).toHaveBeenCalledWith('InstanceModsService', 'resolveFromMarket', expect.any(Object))
  })

  test.each([
    ['renderer', 0],
    ['cli', 1],
    ['protocol', 1],
  ] as const)('%s mode emits %i text log entries', async (mode, expectedLogs) => {
    const { ctx, log } = makeContext(mode)

    await installModCommand.handler({
      instance: '/instance',
      ref: { source: 'modrinth', project: 'example', version: 'version' },
      dependencies: true,
    }, ctx)

    expect(log).toHaveBeenCalledTimes(expectedLogs)
  })
})
