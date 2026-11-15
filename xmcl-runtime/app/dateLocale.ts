export function getSystemDateLocale(environment: NodeJS.ProcessEnv = process.env) {
  const configuredLocale = environment.LC_ALL || environment.LC_TIME || environment.LANG
  if (!configuredLocale) return undefined

  const locale = configuredLocale.split(/[.@]/, 1)[0].replace(/_/g, '-')
  if (!locale || locale === 'C' || locale === 'POSIX') return undefined

  try {
    return Intl.getCanonicalLocales(locale)[0]
  } catch (error) {
    if (error instanceof RangeError) return undefined
    throw error
  }
}
