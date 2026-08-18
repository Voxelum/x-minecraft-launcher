import { describe, expect, it } from 'vitest'
import { resolveOptifineDownloadSource } from './optifineSource'

describe('resolveOptifineDownloadSource', () => {
  const preview = { mcversion: '1.21.1', type: 'HD_U_J1', patch: 'pre9' }

  it('uses BMCL when mirror override is enabled', () => {
    expect(resolveOptifineDownloadSource(preview, true)).toEqual({
      type: 'mirror',
      url: 'https://bmclapi2.bangbang93.com/optifine/1.21.1/HD_U_J1/pre9',
    })
  })

  it('uses the official preview filename when mirror override is disabled', () => {
    expect(resolveOptifineDownloadSource(preview, false)).toEqual({
      type: 'official',
      fileName: 'preview_OptiFine_1.21.1_HD_U_J1_pre9.jar',
    })
  })

  it('normalizes legacy BMCL Minecraft versions', () => {
    expect(resolveOptifineDownloadSource({ mcversion: '1.8', type: 'HD_U', patch: 'L5' }, true)).toMatchObject({
      url: 'https://bmclapi2.bangbang93.com/optifine/1.8.0/HD_U/L5',
    })
  })
})