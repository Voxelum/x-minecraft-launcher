/** Optional community content must never prevent the original description rendering. */
export function createCommunityTranslator(
  request: typeof fetch = fetch,
  report: (error: Error) => void = (error) => console.warn(error),
) {
  const pending = new Map<string, Promise<string>>()
  const failures = new Map<string, number>()
  const cooldown = 60_000
  return function translate(endpoint: string, provider: 'modrinth' | 'curseforge', id: string | number, language: string): Promise<string> {
    const key = JSON.stringify([endpoint, provider, id.toString(), language])
    const now = Date.now()
    for (const [key, until] of failures) if (until <= now) failures.delete(key)
    if (failures.has(key)) return Promise.resolve('')
    const existing = pending.get(key)
    if (existing) return existing
    const result = new Promise<string>((resolve) => {
      setTimeout(async () => {
        let status: number | undefined
        try {
          const url = new URL('/translation', endpoint)
          url.searchParams.set('type', provider)
          url.searchParams.set('id', id.toString())
          const response = await request(url, {
            headers: { 'Accept-Language': language },
            cache: 'force-cache',
            signal: AbortSignal.timeout(10_000),
          })
          status = response.status
          if (!response.ok) throw new Error('HTTP')
          resolve(await response.text())
        } catch {
          // Do not retain URL, project ID, response bodies or native fetch errors.
          if (failures.size >= 256) failures.delete(failures.keys().next().value!)
          failures.set(key, Date.now() + cooldown)
          try {
            report(Object.assign(new Error(`Community translation unavailable (${provider}, ${status ?? 'network'})`), {
              name: 'CommunityTranslationError', provider, status,
            }))
          } catch {
            // Diagnostics are best-effort; do not throw again through a fallback logger.
          } finally {
            resolve('')
          }
        }
      }, 250)
    })
    pending.set(key, result)
    void result.then(() => pending.delete(key))
    return result
  }
}
