import { describe, test, expect } from 'vitest'
import { z } from 'zod'
import {
  camelToKebab,
  formatCommandHelp,
  formatHelp,
  kebabToCamel,
  parseCli,
} from './cli'
import { CommandRegistry, defineCommand } from './registry'

function makeRegistry() {
  const reg = new CommandRegistry()
  reg.register(defineCommand({
    id: 'instance.launch',
    title: 'Launch instance',
    category: 'instance',
    input: z.object({
      instance: z.string(),
      user: z.string().optional(),
      modCount: z.number().optional(),
      dry: z.boolean().optional(),
    }),
    cli: {
      name: 'launch',
      positionals: ['instance'],
      flags: {
        user: { alias: 'u', description: 'User id' },
        modCount: { type: 'number', description: 'Mod count' },
        dry: { type: 'boolean', description: 'Resolve only' },
      },
    },
    async handler() { return undefined },
  }))
  reg.register(defineCommand({
    id: 'user.list',
    title: 'List users',
    category: 'user',
    input: z.object({}),
    cli: { name: 'user list' },
    async handler() { return undefined },
  }))
  return reg
}

describe('kebab/camel helpers', () => {
  test('round-trips simple identifiers', () => {
    expect(kebabToCamel('mod-count')).toBe('modCount')
    expect(camelToKebab('modCount')).toBe('mod-count')
    expect(kebabToCamel(camelToKebab('userId'))).toBe('userId')
  })
})

describe('parseCli — globals + dispatch', () => {
  test('returns none when no command found', () => {
    const r = parseCli(['/path/to/exe'], makeRegistry())
    expect(r.kind).toBe('none')
  })

  test('--help with no command returns help', () => {
    const r = parseCli(['--help'], makeRegistry())
    expect(r.kind).toBe('help')
  })

  test('--version returns version', () => {
    const r = parseCli(['--version'], makeRegistry())
    expect(r.kind).toBe('version')
  })

  test('-h after a command returns help-command', () => {
    const r = parseCli(['launch', '-h'], makeRegistry())
    expect(r).toMatchObject({ kind: 'help-command', commandId: 'instance.launch' })
  })

  test('global --json toggles globals', () => {
    const r = parseCli(['--json', 'launch', '/inst/foo'], makeRegistry())
    expect(r.kind).toBe('command')
    expect(r.globals.json).toBe(true)
  })

  test('--root with value', () => {
    const r = parseCli(['--root', '/data/xmcl', 'launch', '/inst/foo'], makeRegistry())
    expect(r.globals.root).toBe('/data/xmcl')
  })

  test('--root=value', () => {
    const r = parseCli(['--root=/x', 'launch', '/inst/foo'], makeRegistry())
    expect(r.globals.root).toBe('/x')
  })

  test('--root without value is an error', () => {
    const r = parseCli(['--root'], makeRegistry())
    expect(r).toMatchObject({ kind: 'error', message: expect.stringContaining('--root') })
  })

  test('skips electron-noise leading args until a command name is recognised', () => {
    const r = parseCli(['/usr/bin/xmcl', '--gpu-blacklist=', 'launch', '/inst/foo'], makeRegistry())
    expect(r).toMatchObject({ kind: 'command', commandId: 'instance.launch' })
  })
})

describe('parseCli — positionals + flags', () => {
  test('captures positional and required flag', () => {
    const r = parseCli(['launch', '/inst/foo', '--user', 'u1'], makeRegistry())
    expect(r).toMatchObject({
      kind: 'command',
      commandId: 'instance.launch',
      input: { instance: '/inst/foo', user: 'u1' },
    })
  })

  test('alias flag', () => {
    const r = parseCli(['launch', '/inst/foo', '-u', 'u1'], makeRegistry())
    expect(r.kind).toBe('command')
    expect((r as any).input).toMatchObject({ instance: '/inst/foo', user: 'u1' })
  })

  test('--flag=value form', () => {
    const r = parseCli(['launch', '/inst/foo', '--user=u1'], makeRegistry())
    expect((r as any).input).toMatchObject({ user: 'u1' })
  })

  test('boolean flag presence', () => {
    const r = parseCli(['launch', '/inst/foo', '--dry'], makeRegistry())
    expect((r as any).input).toMatchObject({ dry: true })
  })

  test('--no-<flag> negates boolean', () => {
    const r = parseCli(['launch', '/inst/foo', '--no-dry'], makeRegistry())
    expect((r as any).input).toMatchObject({ dry: false })
  })

  test('number flag is coerced', () => {
    const r = parseCli(['launch', '/inst/foo', '--mod-count', '5'], makeRegistry())
    expect((r as any).input).toMatchObject({ modCount: 5 })
  })

  test('kebab-case flag names map to camelCase fields', () => {
    const r = parseCli(['launch', '/inst/foo', '--mod-count', '7'], makeRegistry())
    expect((r as any).input.modCount).toBe(7)
  })

  test('errors when required value missing', () => {
    const r = parseCli(['launch', '/inst/foo', '--user'], makeRegistry())
    expect(r).toMatchObject({ kind: 'error', message: expect.stringContaining('--user') })
  })

  test('errors on unexpected positional', () => {
    const r = parseCli(['launch', '/inst/foo', 'extra'], makeRegistry())
    expect(r).toMatchObject({ kind: 'error', message: expect.stringContaining("Unexpected") })
  })

  test('errors on unknown alias', () => {
    const r = parseCli(['launch', '/inst/foo', '-z', 'bar'], makeRegistry())
    expect(r).toMatchObject({ kind: 'error', message: expect.stringContaining('-z') })
  })

  test('errors on unknown long flag', () => {
    const r = parseCli(['launch', '/inst/foo', '--game-version', '1.21.1'], makeRegistry())
    expect(r).toMatchObject({ kind: 'error', message: 'Unknown flag --game-version' })
  })

  test('multi-word command name (user list)', () => {
    // For now `user list` would require separate matching logic; verify
    // single-word fallback continues to work.
    const r = parseCli(['user list'], makeRegistry())
    expect(r).toMatchObject({ kind: 'command', commandId: 'user.list', input: {} })
  })
})

describe('formatHelp / formatCommandHelp', () => {
  test('top-level help mentions command', () => {
    const txt = formatHelp(makeRegistry(), { programName: 'xmcl' })
    expect(txt).toContain('xmcl')
    expect(txt).toContain('launch')
  })

  test('command help shows positionals + flags', () => {
    const reg = makeRegistry()
    const cmd = reg.get('instance.launch')!
    const txt = formatCommandHelp(cmd, { programName: 'xmcl' })
    expect(txt).toContain('<instance>')
    expect(txt).toContain('--user')
    expect(txt).toContain('--mod-count')
    expect(txt).toContain('--dry')
  })
})
