import { Java } from '../entities/java.schema'
import { JavaRecord } from '../entities/java'
import type { JavaVersion, ResolvedVersion } from '@xmcl/core'
import { parseVersion } from './mavenVersion'

export enum JavaCompatibleState {
  Matched,
  MayIncompatible,
  VeryLikelyIncompatible,
}

export interface AutoDetectedJava {
  /**
   * The prerference of the java version
   */
  preference: VersionPreference
  /**
   * The auto detected java version
   */
  javaVersion: JavaVersion
  /**
   * The java will be used
   */
  java: JavaRecord | undefined
  /**
   * No any java found
   */
  noJava?: boolean
  /**
   * The version is not installed, so result might be inaccurate
   */
  noVersion?: boolean
}

export interface VersionPreference {
  match: (v: Java) => boolean
  okay: (v: Java) => boolean
  requirement: string
}

export function selectJavaByPreference(allJava: JavaRecord[], { match, okay }: VersionPreference) {
  const records = allJava.filter(v => v.valid)
  // const root = this.getPath('jre')
  // const isUnderPath = (p: string) => !relative(root, p).startsWith('..')
  const bestMatched: JavaRecord[] = []
  const fine: JavaRecord[] = []
  const bad: JavaRecord[] = []
  for (const j of records) {
    if (match(j)) {
      bestMatched.push(j)
    } else if (okay(j)) {
      fine.push(j)
    } else {
      bad.push(j)
    }
  }
  if (bestMatched.length > 0) {
    if (bestMatched.length > 1) {
      // Deprioritize OpenJ9 — HotSpot is the de-facto compatibility baseline.
      bestMatched.sort((a, b) => {
        const ao = a.path.toLowerCase().includes('openj9')
        const bo = b.path.toLowerCase().includes('openj9')
        return ao === bo ? 0 : ao ? 1 : -1
      })
    }
    return [bestMatched[0], JavaCompatibleState.Matched] as const
  }
  if (fine.length > 0) {
    return [fine[0], JavaCompatibleState.MayIncompatible] as const
  }
  return [bad[0], JavaCompatibleState.VeryLikelyIncompatible] as const
}

type InstanceResolvedVersion<T extends object> = T | (ResolvedVersion & T)

export function getVersionPreference<T extends object>(
  minecraft: string,
  forge: string | undefined,
  selectedVersion?: InstanceResolvedVersion<T>,
) {
  // Java 16 is the first JDK with the modular cleanup Minecraft 1.17+ was
  // designed against, and the JVM has been broadly forward-compatible from
  // that point on (Mojang's own bootstrap accepts any newer LTS). Treat any
  // requirement >= 16 as forward-compatible so that, e.g., Java 25 is a
  // perfect match for a Java 21 *or* Java 17 requirement instead of being
  // rejected as "no compatible Java found". Java 8 stays strict because
  // legacy MC depends on Java 8 internals removed in 9+.
  const JAVA_FORWARD_COMPAT_THRESHOLD = 16

  let javaVersion = selectedVersion && 'javaVersion' in selectedVersion ? selectedVersion?.javaVersion : undefined
  const resolvedMcVersion = parseVersion(minecraft)
  const minecraftMinor = resolvedMcVersion.minorVersion!

  const getBuilderNumber = (v: string) => {
    const [, build] = v.split('_')
    const buildNumber = Number(build)
    return buildNumber
  }

  let preferredMatchedVersion: undefined | ((j: Java) => boolean)

  if (javaVersion) {
    const v = javaVersion
    // For older versions, require exact match to avoid compatibility issues
    preferredMatchedVersion = v.majorVersion >= JAVA_FORWARD_COMPAT_THRESHOLD
      ? (j) => j.majorVersion >= v.majorVersion
      : (j) => j.majorVersion === v.majorVersion
  }

  // Helper to format requirement string based on Java version
  const getRequirement = (version: number) => {
    return version >= JAVA_FORWARD_COMPAT_THRESHOLD ? `>=${version}` : `=${version}`
  }

  let versionPref: VersionPreference
  // instance version is not installed
  if (minecraftMinor < 13) {
    // need java 8 for version below 1.13; tolerate 9–11 as a close-enough
    // alternative when no Java 8 is installed.
    versionPref = {
      match: preferredMatchedVersion || ((j) => j.majorVersion === 8),
      okay: j => j.majorVersion >= 8 && j.majorVersion <= 11,
      requirement: javaVersion ? getRequirement(javaVersion.majorVersion) : '=8',
    }
    if (!javaVersion) {
      javaVersion = {
        component: 'jre-legacy',
        majorVersion: 8,
      }
    }
  } else if (minecraftMinor >= 13 && minecraftMinor < 17) {
    // if (forge) {
    //   // use java 8 if forge as forge only compatible with jre8
    //   versionPref = {
    //     match: (j) => j.majorVersion === 8 && getBuilderNumber(j.version) < 321,
    //     okay: (j) => j.majorVersion === 8,
    //     requirement: '<8_321',
    //   }
    //   if (!javaVersion) {
    //     javaVersion = {
    //       component: 'jre-legacy',
    //       majorVersion: 8,
    //     }
    //   }
    // } else {
    versionPref = {
      match: preferredMatchedVersion || (j => j.majorVersion >= 8 && j.majorVersion <= 16),
      okay: _ => true,
      requirement: javaVersion ? getRequirement(javaVersion.majorVersion) : '>=8,<=16',
    }
    if (!javaVersion) {
      javaVersion = {
        component: 'jre-legacy',
        majorVersion: 8,
      }
    }
    // }
  } else {
    // new mc use new java
    versionPref = {
      match: preferredMatchedVersion || (j => j.majorVersion >= 16),
      okay: _ => true,
      requirement: javaVersion ? getRequirement(javaVersion.majorVersion) : '>=16',
    }
    if (!javaVersion) {
      javaVersion = {
        component: 'java-runtime-alpha',
        majorVersion: 16,
      }
    }
  }

  return {
    javaVersion,
    versionPref,
  }
}

export function getAutoSelectedJava<T extends object>(
  all: JavaRecord[],
  minecraft: string,
  forge: string | undefined,
  selectedVersion?: InstanceResolvedVersion<T>,
): AutoDetectedJava {
  const { javaVersion, versionPref } = getVersionPreference(minecraft, forge, selectedVersion)

  if (all.length === 0) {
    // No java installed
    return {
      preference: versionPref,
      javaVersion,
      java: undefined,
      noJava: true,
      noVersion: !selectedVersion,
    }
  }

  const [computedJava, computedQuality] = selectJavaByPreference(all, versionPref)

  return computedQuality !== JavaCompatibleState.Matched
    ? {
      preference: versionPref,
      javaVersion,
      java: undefined,
      noVersion: !selectedVersion,
    }
    : {
      preference: versionPref,
      javaVersion,
      noVersion: !selectedVersion,
      java: {
        ...computedJava,
        valid: true,
      } as JavaRecord,
    }
}

export async function getAutoOrManuallJava(
  criteria: AutoDetectedJava,
  resolveJava: (path: string) => Promise<Java | undefined>,
  javaPath: string | undefined,
) {
  if (criteria.noJava) {
    // No java installed
    return {
      auto: criteria,
    }
  }

  const userAssigned = javaPath && javaPath !== ''
  if (userAssigned) {
    // User assigned java path, revalidate it
    const record = await resolveJava(javaPath)

    if (!record) {
      // Invalid java
      return {
        auto: criteria,
        java: {
          valid: false,
          path: javaPath,
          version: '',
          majorVersion: -1,
        } as JavaRecord,
      }
    }

    // Trust the resolver's verdict: if it tells us the record is invalid
    // (stale cache entry pointing at a deleted JDK, etc.), preserve that.
    // Lying with `valid: true` here causes launch to spawn a missing
    // executable instead of falling back to the auto-detected Java.
    const resolvedValid = (record as Partial<JavaRecord>).valid !== false

    let resultQuality: JavaCompatibleState
    // check if this version matched
    if (criteria.preference.match(record)) {
      resultQuality = JavaCompatibleState.Matched
    } else if (criteria.preference.okay(record)) {
      resultQuality = JavaCompatibleState.MayIncompatible
    } else {
      resultQuality = JavaCompatibleState.VeryLikelyIncompatible
    }

    return {
      auto: criteria,
      java: {
        ...record,
        valid: resolvedValid,
      } as JavaRecord,
      quality: resultQuality,
    }
  }

  return {
    auto: criteria,
  }
}
