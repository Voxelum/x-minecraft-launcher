import { describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { makeAgentContext } from '../testContext'
import type { CliContext } from './context'
import { createServerCommand } from './server'

describe('server CLI', () => {
  test('installs the current instance server', async () => {
    const installServer = vi.fn().mockResolvedValue({ ok: true, version: '1.20.1-fabric' })
    const command = createServerCommand({ ctx: makeAgentContext({ installServer }) } as CliContext)
    expect(await command.execute(['install'])).toEqual({ ok: true, version: '1.20.1-fabric' })
    expect(installServer).toHaveBeenCalledTimes(1)
  })

  test('accepts or revokes EULA through explicit actions', async () => {
    const setServerEula = vi.fn().mockResolvedValue({ ok: true })
    const command = createServerCommand({ ctx: makeAgentContext({ setServerEula }) } as CliContext)
    await command.execute(['eula', 'accept'])
    await command.execute(['eula', 'revoke'])
    expect(setServerEula).toHaveBeenNthCalledWith(1, true)
    expect(setServerEula).toHaveBeenNthCalledWith(2, false)
  })

  test('resolves virtual mod paths and defaults to server-compatible mods', async () => {
    const deployServerMods = vi.fn().mockResolvedValue({ ok: true })
    const command = createServerCommand({ ctx: makeAgentContext({
      deployServerMods,
      mods: ref([{ path: '/inst/mods/sodium.jar', fileName: 'sodium.jar', modId: 'sodium' }]) as any,
    }) } as CliContext)
    await command.execute(['deploy-mods', 'mods/sodium.jar'])
    expect(deployServerMods).toHaveBeenLastCalledWith(['/inst/mods/sodium.jar'])
    await command.execute(['deploy-mods'])
    expect(deployServerMods).toHaveBeenLastCalledWith(undefined)
  })

  test('guards operations when no instance is selected', async () => {
    const installServer = vi.fn()
    const command = createServerCommand({ ctx: makeAgentContext({ installServer, instance: ref({ path: '', runtime: {} }) as any }) } as CliContext)
    expect(await command.execute(['install'])).toEqual({ error: 'no instance selected' })
    expect(installServer).not.toHaveBeenCalled()
  })
})