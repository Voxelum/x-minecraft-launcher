import type { JavaVersion, ResolvedVersion } from '@xmcl/core';
import { Instance, Java, JavaRecord, JavaServiceKey, parseVersion } from '@xmcl/runtime-api';
import useSWRV from 'swrv';
import { Ref } from 'vue';
import { useService } from './service';

export enum JavaCompatibleState {
  Matched,
  MayIncompatible,
  VeryLikelyIncompatible,
}

interface BaseJavaIssue {
  /**
    * The java version requirement string
    */
  requirement: string
  /**
    * Best matched java path to select. (Only present if there is a suitable java)
    */
  recommendedVersion?: Java
  recommendedLevel?: JavaCompatibleState
  /**
    * Recommended to download java version automatically. (Please use this if there is no suitable java)
    */
  recommendedDownload?: JavaVersion
  /**
    * The selected game version.
    *
    * Might be empty if the current version is not downloaded.
    */
  version: string
  /**
    * Current minecraft
    */
  minecraft: string
  /**
    * Current forge
    */
  forge: string
}

interface IncompatibleJavaIssue extends BaseJavaIssue {
  /**
   * The current java info. Can either be user assigned, or be launcher computed
   */
  selectedJava: Java
}

/**
 * Only present if user assigned java path
 */
interface InvalidJavaIssue extends BaseJavaIssue {
  /**
   * The user assigned java path
   */
  selectedJavaPath: string
}

interface MissingJavaIssue extends BaseJavaIssue {

}

/**
 * Current java path is invalid. Like file not existed or java is broken.
 */
// export const InvalidJavaIssueKey: IssueKey<InvalidJavaIssue> = 'invalidJava'
/**
 * Current selected java might be incompatible with minecraft
 */
// export const IncompatibleJavaIssueKey: IssueKey<IncompatibleJavaIssue> = 'incompatibleJava'
/**
 * Cannot find proper java for fulfill the requirement
 */
// export const MissingJavaIssueKey: IssueKey<MissingJavaIssue> = 'missingJava'


export function useInstanceJava(instance: Ref<Instance>, version: Ref<ResolvedVersion>) {
  const { resolveJava, state } = useService(JavaServiceKey)

  const { data, mutate, isValidating, error } = useSWRV(`/instance/${instance.value.path}/java-version?version=${version.value.id}`, async () => {
    return await computeJava(state.all, resolveJava, instance.value, version.value)
  })

  const java = computed(() => data.value?.java)
  const recommendation = computed(() => data.value?.recomendation)

  watch(computed(() => state.all), () => {
    mutate()
  })

  return {
    java,
    recommendation,
    isValidating,
    error,
  }
}

interface VersionPreference {
  match: (v: Java) => boolean
  okay: (v: Java) => boolean
  requirement: string
}


function getSortedJava(allJava: JavaRecord[], { match, okay }: VersionPreference) {
  const records = [...allJava.filter(v => v.valid)]
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
  // bestMatched.sort((a, b) => isUnderPath(a.path) ? -1 : 1)
  // fine.sort((a, b) => isUnderPath(a.path) ? -1 : 1)
  if (bestMatched.length > 0) {
    return [bestMatched[0], JavaCompatibleState.Matched] as const
  }
  if (fine.length > 0) {
    return [fine[0], JavaCompatibleState.MayIncompatible] as const
  }
  return [bad[0], JavaCompatibleState.VeryLikelyIncompatible] as const
}

async function computeJava(all: JavaRecord[], resolveJava: (path: string) => Promise<Java | undefined>, instance: Instance, selectedVersion: ResolvedVersion) {
  const { minecraft, forge } = instance.runtime
  const javaPath = instance.java
  let javaVersion = selectedVersion?.javaVersion
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
    // if it assign version officially, we need to
    preferredMatchedVersion = (j) => j.majorVersion === v.majorVersion
  }
  let versionPref: VersionPreference
  // instance version is not installed
  if (minecraftMinor < 13) {
    // need java 8 for version below 1.13
    versionPref = {
      match: preferredMatchedVersion || ((j) => j.majorVersion === 8),
      okay: j => j.majorVersion < 8 || j.majorVersion < 11,
      requirement: javaVersion ? `=${javaVersion.majorVersion.toString()}` : '=8',
    }
    if (!javaVersion) {
      javaVersion = {
        component: 'jre-legacy',
        majorVersion: 8,
      }
    }
  } else if (minecraftMinor >= 13 && minecraftMinor < 17) {
    if (instance.runtime.forge) {
      // use java 8 if forge as forge only compatible with jre8
      versionPref = {
        match: (j) => j.majorVersion === 8 && getBuilderNumber(j.version) < 321,
        okay: (j) => j.majorVersion === 8,
        requirement: '<8_321',
      }
      if (!javaVersion) {
        javaVersion = {
          component: 'jre-legacy',
          majorVersion: 8,
        }
      }
    } else {
      // use greater java if no forge
      versionPref = {
        match: preferredMatchedVersion || (j => j.majorVersion >= 8 && j.majorVersion <= 16),
        okay: _ => true,
        requirement: javaVersion ? `=${javaVersion.majorVersion.toString()}` : '>=8,<=16',
      }
      if (!javaVersion) {
        javaVersion = {
          component: 'jre-legacy',
          majorVersion: 8,
        }
      }
    }
  } else {
    // new mc use new java
    versionPref = {
      match: preferredMatchedVersion || (j => j.majorVersion >= 16),
      okay: _ => true,
      requirement: javaVersion ? `=${javaVersion.majorVersion.toString()}` : '>=16',
    }
    if (!javaVersion) {
      javaVersion = {
        component: 'java-runtime-alpha',
        majorVersion: 16,
      }
    }
  }

  if (all.length === 0) {
    // No java installed
    return {
      recomendation: {
        recommendedDownload: javaVersion,
        requirement: versionPref.requirement,
        version: selectedVersion?.id || '',
        minecraft,
        forge: forge ?? '',
      },
      java: undefined,
    }
  }

  const [computedJava, computedQuality] = getSortedJava(all, versionPref)
  let resultJava: Java = computedJava
  let resultQuality = computedQuality

  const userAssigned = javaPath && javaPath !== ''
  if (userAssigned) {
    // User assigned java path, revalidate it
    const record = await resolveJava(javaPath)

    if (!record) {
      // Invalid java
      return {
        recomendation: {
          selectedJavaPath: javaPath,
          recommendedDownload: javaVersion,
          recommendedVersion: computedJava,
          recommendedLevel: resultQuality,
          requirement: versionPref.requirement,
          version: selectedVersion?.id || '',
          minecraft,
          forge: forge ?? '',
        },
        java: {
          valid: false,
          path: javaPath,
          version: '',
          majorVersion: -1,
        }
      }
    }

    // check if this version matched
    if (versionPref.match(record)) {
      resultQuality = JavaCompatibleState.Matched
    } else if (versionPref.okay(record)) {
      resultQuality = JavaCompatibleState.MayIncompatible
    } else {
      resultQuality = JavaCompatibleState.VeryLikelyIncompatible
    }
    resultJava = record
  }

  return {
    recomendation: resultQuality !== JavaCompatibleState.Matched ? {
      recomendation: {
        selectedJava: resultJava,
        recommendedDownload: javaVersion,
        recommendedVersion: computedJava,
        recommendedLevel: computedQuality,
        version: selectedVersion?.id || '',
        minecraft,
        forge: instance.runtime.forge || '',
        requirement: versionPref.requirement,
      },
      java: {
        ...resultJava,
        valid: true,
      },
    } : undefined,
    java: {
      ...resultJava,
      valid: true,
    }
  }
}