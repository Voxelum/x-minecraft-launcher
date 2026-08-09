import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('undici', () => ({
  request: vi.fn(),
}))

import { request } from 'undici'
import { fetchBedrockVersionList } from './versionList'

function createResponse(body: string, statusCode = 200, location?: string) {
  return {
    statusCode,
    headers: location ? { location } : {},
    body: {
      text: vi.fn().mockResolvedValue(body),
      dump: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe('fetchBedrockVersionList', () => {
  const mockedRequest = vi.mocked(request)

  afterEach(() => {
    mockedRequest.mockReset()
  })

  test('preserves legacy tuple sources and sorts versions newest-first', async () => {
    mockedRequest.mockResolvedValueOnce(createResponse(JSON.stringify([
      ['1.20.0.1', 'guid-release-old', 0],
      ['1.21.0.3', 'guid-preview-new', 2],
      ['1.21.0.3', 'guid-release-new', 0],
    ])) as any)

    const versions = await fetchBedrockVersionList(false)

    expect(versions).toEqual([
      { version: '1.21.0.3', updateIdentity: 'guid-release-new', type: 'release' },
      { version: '1.21.0.3', updateIdentity: 'guid-preview-new', type: 'preview' },
      { version: '1.20.0.1', updateIdentity: 'guid-release-old', type: 'release' },
    ])
    expect(mockedRequest).toHaveBeenCalledWith('https://mrarm.io/r/w10-vdb', {
      method: 'GET',
      headers: undefined,
    })
  })

  test('uses the MCAPPX source with the required developer user-agent and parses metadata locators', async () => {
    mockedRequest
      .mockResolvedValueOnce(createResponse('', 503) as any)
      .mockResolvedValueOnce(createResponse(JSON.stringify({
        CreationTime: '2026-07-29T00:00:00Z',
        'From_mcappx.com': {
          '1.21.80.20': {
            Type: 'Preview',
            Variations: [
              { Arch: 'x64', MetaData: ['guid-preview-old', 'guid-preview-new'] },
            ],
          },
          '1.21.70.03': {
            Type: 'Release',
            Variations: [
              { Arch: 'arm64', MetaData: ['guid-arm64'] },
              { Arch: 'x64', MetaData: ['https://cdn.mcappx.com/bedrock/1.21.70.03.appx'] },
            ],
          },
        },
      })) as any)

    const versions = await fetchBedrockVersionList(false)

    expect(versions).toEqual([
      { version: '1.21.80.20', updateIdentity: 'guid-preview-new', type: 'preview' },
      { version: '1.21.70.03', updateIdentity: 'https://cdn.mcappx.com/bedrock/1.21.70.03.appx', type: 'release' },
    ])
    expect(mockedRequest).toHaveBeenNthCalledWith(1, 'https://mrarm.io/r/w10-vdb', {
      method: 'GET',
      headers: undefined,
    })
    expect(mockedRequest).toHaveBeenNthCalledWith(2, 'https://data.mcappx.com/v2/bedrock.json', {
      method: 'GET',
      headers: { 'user-agent': 'mcappx_developer' },
    })
  })
})
