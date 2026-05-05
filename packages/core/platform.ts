import * as os from 'os'

/**
 * The platform information related to current operating system.
 */
export interface Platform {
  /**
   * The system name of the platform. This name is majorly used for download.
   */
  name: 'osx' | 'linux' | 'windows' | 'unknown'
  /**
   * The version of the os. It should be the value of `os.release()`.
   */
  version: string
  /**
   * The direct output of `os.arch()`. Should look like x86 or x64.
   */
  arch: 'x86' | 'x64' | string
}

/**
 * Get Minecraft style platform info. (Majorly used to enable/disable native dependencies)
 */
export function getPlatform(): Platform {
  const arch = os.arch()
  const version = os.release()
  switch (os.platform()) {
    case 'darwin':
      return { name: 'osx', version, arch }
    case 'linux':
      return { name: 'linux', version, arch }
    case 'win32':
      return { name: 'windows', version, arch }
    default:
      return { name: 'unknown', version, arch }
  }
}
