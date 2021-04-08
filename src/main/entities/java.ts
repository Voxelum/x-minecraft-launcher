import { isNonnull } from '/@shared/util/assert'

export interface TsingHuaJreTarget {
  fileName: string
  /**
     * Url to download
     */
  url: string
  /**
     * The sha256 url of the download
     */
  sha256Url?: string
}

export function parseTsingHuaAdoptOpenJDKFileList (fileList: string[], os: 'linux' | 'windows' | 'unknown' | 'mac', arch: '32' | '64'): TsingHuaJreTarget | undefined {
  const list = fileList.map(l => l.split('/').slice(5))
  const zipFile = list.find(l => l[0] === 'jre' &&
        l[1] === `x${arch}` &&
        l[2] === os &&
        (l[3].endsWith('.zip') || l[3].endsWith('.tar.gz')))
  if (zipFile) {
    const sha256File = list.find(l => l[3] === `${zipFile[3]}.sha256.txt`)
    return {
      fileName: zipFile[zipFile.length - 1],
      url: `https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/${zipFile.join('/')}`,
      sha256Url: sha256File ? `https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/${sha256File?.join('/')}` : undefined,
    }
  }
  return undefined
}

export function parseTsingHuaAdpotOpenJDKHotspotArchive (pageText: string, baseUrl: string): TsingHuaJreTarget | undefined {
  const exp = /<a href="([a-zA-Z0-9-._]+)" title="([a-zA-Z0-9-._]+)">/g
  const result = pageText.match(exp)

  const targets = result?.map((r) => new RegExp(exp).exec(r))
    .filter(isNonnull)
    .map((a) => a[1]) ?? []

  const target = targets.find((target) => (target.indexOf('hotspot') !== -1 && target.endsWith('.zip')) || target.endsWith('.tar.gz'))
  if (target) {
    return {
      fileName: target,
      url: `${baseUrl}${target}`,
    }
  }

  return undefined
}

export function getTsingHuaAdpotOponJDKPageUrl (os: 'linux' | 'windows' | 'unknown' | 'mac', arch: '32' | '64') {
  return `https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/8/jre/x${arch}/${os}/`
}
