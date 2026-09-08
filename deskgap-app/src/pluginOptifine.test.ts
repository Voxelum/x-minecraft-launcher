import { kGFW } from '@xmcl/runtime/infra/gfw'
import { kOptifineInstaller } from '@xmcl/runtime/install/optifine'
import { kSettings } from '@xmcl/runtime/settings/settings'
import { describe, expect, it } from 'vitest'
import { pluginOptifine } from './pluginOptifine'

const version = { mcversion: '1.8', type: 'HD_U', patch: 'L5' }

async function createInstaller(apiSetsPreference: string, environment: 'cn' | 'global') {
  const registrations = new Map<unknown, unknown>()
  const values = new Map<unknown, unknown>([
    [kGFW, { signal: Promise.resolve(environment) }],
    [kSettings, { apiSetsPreference }],
  ])
  const app = {
    registry: {
      get: async (key: unknown) => values.get(key),
      register: (key: unknown, value: unknown) => registrations.set(key, value),
    },
  }
  await pluginOptifine(app as any, {} as any)
  return registrations.get(kOptifineInstaller) as (value: typeof version) => Promise<string>
}

describe('pluginOptifine', () => {
  it('registers a normalized BMCL download URL inside the mirror environment', async () => {
    const install = await createInstaller('', 'cn')
    await expect(install(version)).resolves.toBe(
      'https://bmclapi2.bangbang93.com/optifine/1.8.0/HD_U/L5',
    )
  })

  it('rejects BMCL downloads when the official API source is forced', async () => {
    const install = await createInstaller('mojang', 'cn')
    await expect(install(version)).rejects.toMatchObject({ name: 'OptifineNoMirrorError' })
  })
})