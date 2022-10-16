import { access, chmod, constants } from 'fs-extra'
import { isSystemError } from '../util/error'
import { ENOENT_ERROR, EPERM_ERROR } from '../util/fs'
import { isNonnull } from '../util/object'

export enum JavaValidation {
  Okay,
  NotExisted,
  NoPermission,
}

export async function validateJavaPath(javaPath: string): Promise<JavaValidation> {
  try {
    await access(javaPath, constants.X_OK)
    return JavaValidation.Okay
  } catch (e) {
    if (isSystemError(e)) {
      if (e.code === ENOENT_ERROR) {
        return JavaValidation.NotExisted
      } else if (e.code === EPERM_ERROR || e.code === 'EACCES') {
        try {
          await chmod(javaPath, 0o765)
          return JavaValidation.Okay
        } catch {
          return JavaValidation.NoPermission
        }
      }
    }
    throw e
  }
}

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

export function parseTsingHuaAdoptOpenJDKFileList(fileList: string[], os: 'linux' | 'windows' | 'unknown' | 'mac', arch: '32' | '64'): TsingHuaJreTarget | undefined {
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

export function parseTsingHuaAdpotOpenJDKHotspotArchive(pageText: string, baseUrl: string): TsingHuaJreTarget | undefined {
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

export function getTsingHuaAdpotOponJDKPageUrl(os: 'linux' | 'windows' | 'unknown' | 'mac', arch: '32' | '64', java: '8' | '9' | '11' | '12' | '13' | '14' | '15' | '16') {
  return `https://mirrors.tuna.tsinghua.edu.cn/AdoptOpenJDK/${java}/jre/x${arch}/${os}/`
}
