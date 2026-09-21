import type { JavaVersion } from './version'

const JAVA_COMPONENTS: Record<number, string> = {
  8: 'jre-legacy',
  16: 'java-runtime-alpha',
  17: 'java-runtime-gamma',
  21: 'java-runtime-delta',
  25: 'java-runtime-epsilon',
}

/**
 * Choose a downloadable runtime without relaxing a pack's explicit Java allowlist.
 * An empty component means the required major must be installed manually.
 */
export function getCompatibleJavaVersion(majors: number[], preferred?: JavaVersion): JavaVersion {
  if (!Array.isArray(majors) || majors.length === 0 ||
    majors.some(major => !Number.isSafeInteger(major) || major <= 0)) {
    throw new TypeError('compatibleJavaMajors must be a non-empty array of positive integers')
  }
  if (preferred?.component && majors.includes(preferred.majorVersion)) return preferred

  const sorted = [...majors].sort((a, b) => a - b)
  const majorVersion = sorted.find(major => JAVA_COMPONENTS[major]) ?? sorted[0]
  return { majorVersion, component: JAVA_COMPONENTS[majorVersion] ?? '' }
}
