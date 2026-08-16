import { describe, expect, it } from 'vitest'
import { getMarketFilePath } from './marketFilePath'

describe('getMarketFilePath', () => {
  it('sanitizes invalid characters in upstream filenames', () => {
    expect(getMarketFilePath('', 'Yet Another Bingo: Ultimate-2.12.1.mrpack')).toBe(
      'Yet Another Bingo_ Ultimate-2.12.1.mrpack',
    )
    expect(getMarketFilePath('mods', 'invalid\\/:*?"<>|.jar')).toBe(
      'mods/invalid_.jar',
    )
  })

  it('preserves a trusted market domain', () => {
    expect(getMarketFilePath('resourcepacks/nested', 'pack:name.zip')).toBe(
      'resourcepacks/nested/pack_name.zip',
    )
  })
})