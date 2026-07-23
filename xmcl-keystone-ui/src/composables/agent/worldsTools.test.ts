import { describe, expect, test } from 'vitest'
import { WORLDS_CLI_INSTRUCTIONS } from './worldsTools'

describe('world help domain', () => {
  test('documents world CLI and VFS operations', () => {
    expect(WORLDS_CLI_INSTRUCTIONS).toContain('bash world import')
    expect(WORLDS_CLI_INSTRUCTIONS).toContain('vfs_rm')
    expect(WORLDS_CLI_INSTRUCTIONS).toContain('help domain server')
  })
})
