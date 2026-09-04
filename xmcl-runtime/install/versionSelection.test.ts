import type { VersionHeader } from '@xmcl/runtime-api'
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