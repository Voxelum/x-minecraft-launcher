export function normalizeArray<T>(arr: T | T[] = []): T[] {
  return arr instanceof Array ? arr : [arr]
}
/**
 * Join two urls
 */
export function joinUrl(a: string, b: string) {
  if (a.endsWith('/') && b.startsWith('/')) {
    return a + b.substring(1)
  }
  if (!a.endsWith('/') && !b.startsWith('/')) {
    return a + '/' + b
  }
  return a + b
}

/**
 * Shared install options
 */
export interface InstallOptions {
  /**
   * When you want to install a version over another one.
   *
   * Like, you want to install liteloader over a forge version.
   * You should fill this with that forge version id.
   */
  inheritsFrom?: string

  /**
   * Override the newly installed version id.
   *
   * If this is absent, the installed version id will be either generated or provided by installer.
   */
  versionId?: string
}

export function errorToString(e: any): string | undefined {
  if (e instanceof Error) {
    return e.stack ? e.stack : e.message
  }
  return e?.toString()
}

export interface FetchOptions {
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
  signal?: AbortSignal | undefined
}

export function doFetch(o: FetchOptions | undefined, url: string, init?: RequestInit) {
  if (init) {
    init.signal = o?.signal
  } else {
    init = { signal: o?.signal }
  }
  return o?.fetch ? o.fetch(url, init) : fetch(url, init)
}

export function resolveDownloadUrls<T>(
  original: string,
  version: T,
  option?: string | string[] | ((version: T) => string | string[]),
) {
  const result = [] as string[]
  if (typeof option === 'function') {
    result.unshift(...normalizeArray(option(version)))
  } else {
    result.unshift(...normalizeArray(option))
  }
  if (result.indexOf(original) === -1) {
    result.push(original)
  }
  return result
}

export interface WithDiagnose {
  diagnose?: boolean
}

export function runWithDiagnose<T>(
  diagnose: () => Promise<T>,
  fix: (e: any) => Promise<void>,
  options: WithDiagnose,
): Promise<T> {
  return diagnose().catch(async (e) => {
    if (options.diagnose) {
      throw e
    }
    await fix(e)
    return diagnose()
  })
}

export function runWithDiagnoseOnce(
  diagnose: () => Promise<void>,
  fix: (e: any) => Promise<void>,
  options: WithDiagnose,
): Promise<void> {
  return diagnose().catch(async (e) => {
    if (options.diagnose) {
      throw e
    }
    await fix(e)
  })
}
