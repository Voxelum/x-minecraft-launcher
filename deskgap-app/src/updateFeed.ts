import { prerelease, rcompare, valid } from 'semver'

export interface DeskGapRelease {
  version: string
  name: string
  url: string
  size: number
  body: string
  date: string
}

export function validateRepository(repository: string) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('DeskGap update repository must be owner/repository')
  }
  return repository
}

function releaseFromJSON(value: unknown, repository: string, allowPrerelease: boolean): DeskGapRelease | undefined {
  if (!value || typeof value !== 'object') throw new Error('Invalid GitHub release response')
  const release = value as Record<string, unknown>
  if (release.draft === true || typeof release.tag_name !== 'string' || !release.tag_name.startsWith('v')) return
  const version = valid(release.tag_name.slice(1))
  if (!version || release.tag_name !== `v${version}`) return
  if (!allowPrerelease && (release.prerelease === true || prerelease(version))) return
  if (!Array.isArray(release.assets)) throw new Error('GitHub release is missing its assets')
  const name = `xmcl-deskgap-${version}-win32-x64.exe`
  const expectedURL = `https://github.com/${repository}/releases/download/${release.tag_name}/${name}`
  const executable = release.assets.find((asset: unknown) => asset && typeof asset === 'object' &&
    'name' in asset && asset.name === name)
  // Earlier standard releases may contain only Electron builds.
  if (!executable) return
  if (typeof executable !== 'object' || !('browser_download_url' in executable) ||
    executable.browser_download_url !== expectedURL || !('size' in executable) ||
    typeof executable.size !== 'number' || !Number.isSafeInteger(executable.size) || executable.size <= 0) {
    throw new Error(`Release ${release.tag_name} has an invalid DeskGap executable asset`)
  }
  return {
    version, name, url: expectedURL, size: executable.size,
    body: typeof release.body === 'string' ? release.body : '',
    date: typeof release.published_at === 'string' ? release.published_at : '',
  }
}

export async function findDeskGapRelease(
  fetcher: typeof fetch,
  repository: string,
  allowPrerelease: boolean,
  signal?: AbortSignal,
): Promise<DeskGapRelease | undefined> {
  validateRepository(repository)
  const candidates: DeskGapRelease[] = []
  // Bound discovery explicitly rather than silently selecting an older version from a partial page.
  for (let page = 1; page <= 10; page++) {
    const response = await fetcher(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal,
    })
    if (!response.ok) throw new Error(`DeskGap release discovery failed with HTTP ${response.status}`)
    const releases: unknown = await response.json()
    if (!Array.isArray(releases)) throw new Error('Invalid GitHub release list')
    for (const release of releases) {
      const candidate = releaseFromJSON(release, repository, allowPrerelease)
      if (candidate) candidates.push(candidate)
    }
    if (releases.length < 100) return candidates.sort((a, b) => rcompare(a.version, b.version))[0]
  }
  throw new Error('DeskGap release discovery exceeded 1000 releases; refusing an incomplete update feed')
}
