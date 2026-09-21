import { describe, expect, it, vi } from 'vitest'
import { findDeskGapRelease } from './updateFeed'

const repository = 'Voxelum/x-minecraft-launcher'
function githubRelease(version = '0.70.0', prerelease = false) {
  const tag = `v${version}`
  const name = `xmcl-deskgap-${version}-win32-x64.exe`
  return {
    tag_name: tag,
    prerelease,
    draft: false,
    assets: [{
      name,
      size: 100,
      browser_download_url: `https://github.com/${repository}/releases/download/${tag}/${name}`,
    }],
  }
}

describe('DeskGap GitHub release discovery', () => {
  it('selects a standard release with the Windows EXE and the highest stable semver', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([
      { tag_name: 'v99.0.0', assets: [{ name: 'xmcl.appx' }] },
      { tag_name: 'deskgap-v99.0.0' },
      githubRelease('0.71.0-beta.1', true),
      githubRelease('0.68.0'),
      githubRelease(),
      { ...githubRelease('0.99.0'), draft: true },
    ]))
    expect(await findDeskGapRelease(fetcher, repository, false)).toMatchObject({ version: '0.70.0' })
  })

  it('includes stable releases when opting into prereleases', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([
      githubRelease('0.71.0-beta.1', true), githubRelease('0.71.0'),
    ]))
    expect(await findDeskGapRelease(fetcher, repository, true)).toMatchObject({ version: '0.71.0' })
  })

  it('excludes prerelease semver even when GitHub prerelease metadata is false', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([githubRelease('0.71.0-beta.1')]))
    expect(await findDeskGapRelease(fetcher, repository, false)).toBeUndefined()
  })

  it('continues through older standard releases without a DeskGap EXE', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(Array.from({ length: 100 }, () => ({ tag_name: 'v0.70.0', assets: [] }))))
      .mockResolvedValueOnce(Response.json([githubRelease()]))
    expect(await findDeskGapRelease(fetcher, repository, false)).toMatchObject({ version: '0.70.0' })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it.each([403, 429, 500])('surfaces HTTP %s rather than reporting up to date', async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }))
    await expect(findDeskGapRelease(fetcher, repository, false)).rejects.toThrow(`HTTP ${status}`)
  })

  it('rejects an executable asset pointing at another repository', async () => {
    const release = githubRelease()
    release.assets[0].browser_download_url = 'https://github.com/other/project/releases/download/v0.70.0/app.exe'
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([release]))
    await expect(findDeskGapRelease(fetcher, repository, false)).rejects.toThrow('invalid DeskGap executable')
  })

  it('rejects an invalid repository before issuing requests', async () => {
    const fetcher = vi.fn<typeof fetch>()
    await expect(findDeskGapRelease(fetcher, 'owner/repo?redirect=evil', false)).rejects.toThrow('owner/repository')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('ignores noncanonical tags rather than treating semver aliases as regular releases', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([
      { ...githubRelease('0.99.0'), tag_name: 'vv0.99.0' },
      { ...githubRelease('0.99.0'), tag_name: 'v=0.99.0' },
      githubRelease(),
    ]))
    expect(await findDeskGapRelease(fetcher, repository, false)).toMatchObject({ version: '0.70.0' })
  })
})
