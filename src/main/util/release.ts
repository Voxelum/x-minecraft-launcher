/* eslint-disable camelcase */
import got from 'got'

export interface Release {
  title: string
  /**
     * The new version
     */
  version: string
  /**
     * The asar download url
     */
  downloadUrl: string
  /**
     * The update body text
     */
  body: string

  size?: number

  downloadCount?: number
}

export interface ReleaseFetcher {
  listReleases(): Promise<Release[]>
  getLatestRelease(): Promise<Release>
}

/**
 * Shared release definition between github and gitee
 */
interface ReleaseJson {
  name: string
  tag_name: string
  prerelease: boolean
  body: string
  assets: Array<{
    browser_download_url: string
    name: string
    /**
         * no size for gitee
         */
    size?: number
    /**
         * no download_count for gitee
         */
    download_count?: number
  }>
}

function convertRelease(r: ReleaseJson): Release {
  const asarAsset = r.assets.find((a) => a.name === 'app.asar')
  if (!asarAsset) {
    throw new Error()
  }
  return {
    title: r.name,
    version: r.tag_name,
    body: r.body,
    downloadUrl: asarAsset.browser_download_url,
    downloadCount: asarAsset.download_count,
    size: asarAsset.size,
  }
}

export class GithubReleaseFetcher implements ReleaseFetcher {
  constructor(readonly owner: string, readonly repo: string) { }

  async getLatestRelease() {
    const r: ReleaseJson = await got(`https://api.github.com/repos/${this.owner}/${this.repo}/releases/latest`).json()
    return convertRelease(r)
  }

  async listReleases() {
    const r: ReleaseJson[] = await got(`https://api.github.com/repos/${this.owner}/${this.repo}/releases`).json()
    return r.map(convertRelease)
  }
}

export class GiteeReleaseFetcher implements ReleaseFetcher {
  constructor(readonly owner: string, readonly repo: string) { }

  async getLatestRelease() {
    const r: ReleaseJson = await got(`https://gitee.com/api/v5/repos/${this.owner}/${this.repo}/releases/latest`).json()
    return convertRelease(r)
  }

  async listReleases() {
    const r: ReleaseJson[] = await got(`https://gitee.com/api/v5/repos/${this.owner}/${this.repo}/releases`).json()
    return r.map(convertRelease)
  }
}
