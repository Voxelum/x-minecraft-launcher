export interface SystemError extends Error {
  /**
   * Please see `constants.errno` in `os` module
   */
  errno: number | string
  code: string
  syscall?: string
  path?: string
}

export function isSystemError(e: any): e is SystemError {
  if (typeof e.errno === 'number' && typeof e.code === 'string' && e instanceof Error) {
    return true
  }
  return false
}
