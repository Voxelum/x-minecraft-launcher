import { describe, expect, test, vi } from 'vitest'
import { assertAgentCommandSyntax, createAgentRuntimeCommands, type AgentCommandOperations } from './commandDefinitions'

function operations(): AgentCommandOperations {
  return {
    searchModrinth: vi.fn(async input => input),
    getModrinthVersions: vi.fn(async input => input),
    searchCurseforge: vi.fn(async input => input),
    getCurseforgeFiles: vi.fn(async input => input),
    listLoaderVersions: vi.fn(async input => input),
    installLoader: vi.fn(async input => input),
  }
}

describe('Agent runtime commands', () => {
  test('parses Modrinth search options', async () => {
    const ops = operations()
    const command = createAgentRuntimeCommands(ops).find(value => value.name === 'market')!
    await command.execute(['modrinth', 'search', "mo'd", '--game-version', '1.21.1', '--loader', 'fabric'])
    expect(ops.searchModrinth).toHaveBeenCalledWith({
      query: "mo'd",
      type: undefined,
      gameVersion: '1.21.1',
      loader: 'fabric',
      limit: 10,
    }, undefined)
  })

  test('installs a recommended loader when no version is provided', async () => {
    const ops = operations()
    const command = createAgentRuntimeCommands(ops).find(value => value.name === 'loader')!
    await command.execute(['install', 'forge'])
    expect(ops.installLoader).toHaveBeenCalledWith({ loader: 'forge', version: undefined }, undefined)
  })

  test('rejects shell control operators', () => {
    expect(() => assertAgentCommandSyntax(['install-mod', 'x', '&&', 'echo'])).toThrow('one XMCL command')
    expect(() => assertAgentCommandSyntax(['instance', 'list'])).not.toThrow()
  })
})
