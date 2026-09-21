import { getResolvedVersionHeader, type VersionHeader } from '@xmcl/runtime-api'
import { Version } from '@xmcl/core'
import { getMmcVersionFromManifest } from '@xmcl/instance'
import { expect, test } from 'vitest'
import { selectLocalVersion } from './versionSelection'

function version(id: string, forge = ''): VersionHeader {
  return {
    id,
    path: id,
    inheritances: [],
    minecraft: '1.20.1',
    forge,
    neoForged: '',
    fabric: '',
    optifine: '',
    quilt: '',
    labyMod: '',
    liteloader: '',
  }
}

test('prefers the selected local version when it still matches the runtime', () => {
  const versions = [version('first', '47.3.0'), version('selected', '47.3.0')]

  expect(selectLocalVersion(versions, { minecraft: '1.20.1', forge: '47.3.0' }, 'selected')?.id)
    .toBe('selected')
})

test('ignores a selected version that no longer matches the runtime', () => {
  const versions = [version('selected', '47.2.0'), version('matching', '47.3.0')]

  expect(selectLocalVersion(versions, { minecraft: '1.20.1', forge: '47.3.0' }, 'selected')?.id)
    .toBe('matching')
})

test('keeps the imported GTNH standalone version instead of repairing ordinary Forge', () => {
  const imported = getMmcVersionFromManifest({
    cfg: { name: 'GTNH', notes: '' },
    json: {
      formatVersion: 1,
      components: [
        { uid: 'net.minecraft', version: '1.7.10' },
        { uid: 'net.minecraftforge', version: '10.13.4.1614' },
      ],
    },
    patches: {
      'net.minecraft': {
        uid: 'net.minecraft',
        mainClass: 'com.gtnewhorizons.retrofuturabootstrap.Main',
        minecraftArguments: '--username ${auth_player_name}',
        compatibleJavaMajors: [17, 21, 23, 24, 25],
        libraries: [{ name: 'net.minecraftforge:forge:1.7.10-10.13.4.1614-1.7.10:universal' }],
      },
    },
  }, 'GTNH')
  const resolved = Version.resolve('minecraft', [
    Version.normalizeVersionJson(JSON.stringify(imported), 'minecraft'),
  ])
  const custom = getResolvedVersionHeader(resolved)
  const ordinary = { ...custom, id: '1.7.10-Forge10.13.4.1614-1.7.10' }
  expect(selectLocalVersion([ordinary, custom], {
    minecraft: '1.7.10', forge: '10.13.4.1614',
  }, 'GTNH')?.id).toBe('GTNH')
})