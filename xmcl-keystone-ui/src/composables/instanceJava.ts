import type { JavaVersion, ResolvedVersion } from '@xmcl/core'
import { Instance, Java, JavaRecord, JavaServiceKey, parseVersion } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'
import { InstanceResolveVersion, UnresolvedVersion } from './instanceVersion'

export enum JavaCompatibleState {
  Matched,
  MayIncompatible,
  VeryLikelyIncompatible,
}

export interface JavaRecommendation {
  reason: 'missing' | 'incompatible' | 'invalid'
  selectedJava?: Java
  selectedJavaPath?: string
  recommendedDownload?: JavaVersion
  recommendedVersion?: Java
  recommendedLevel?: JavaCompatibleState
  version: string
  minecraft: string
  forge: string
  requirement: string
}

export const kInstanceJava: InjectionKey<ReturnType<typeof useInstanceJava>> = Symbol('InstanceJava')

export function useInstanceJava(instance: Ref<Instance>, version: Ref<InstanceResolveVersion | undefined>, all: Ref<JavaRecord[]>) {
  const { resolveJava } = useService(JavaServiceKey)

  const { data, mutate, isValidating, error } = useSWRV(() => instance.value.path && `/instance/${instance.value.path}/java-version?version=${version.value && 'id' in version.value ? version.value.id : undefined}`, async () => {
    return await computeJava(all.value, resolveJava, instance.value, version.value)
  })

  const java = computed(() => data.value?.java)
  const recommendation = computed(() => data.value?.recomendation)

  watch([all, version, computed(() => instance.value.java)], () => {
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

async function computeJava(all: JavaRecord[], resolveJava: (path: string) => Promise<Java | undefined>, instance: Instance, selectedVersion?: InstanceResolveVersion) {
  const { minecraft, forge } = instance.runtime
  const javaPath = instance.java
  let javaVersion = selectedVersion && 'javaVersion' in selectedVersion ? selectedVersion?.javaVersion : undefined
  const versionId = selectedVersion && 'id' in selectedVersion ? selectedVersion.id : undefined
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
        reason: 'missing',
        recommendedDownload: javaVersion,
        requirement: versionPref.requirement,
        version: versionId || '',
        minecraft,
        forge: forge ?? '',
      } as JavaRecommendation,
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
          reason: 'invalid',
          selectedJavaPath: javaPath,
          recommendedDownload: javaVersion,
          recommendedVersion: computedJava,
          recommendedLevel: resultQuality,
          requirement: versionPref.requirement,
          version: versionId || '',
          minecraft,
          forge: forge ?? '',
        } as JavaRecommendation,
        java: {
          valid: false,
          path: javaPath,
          version: '',
          majorVersion: -1,
        } as JavaRecord,
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

  return resultQuality !== JavaCompatibleState.Matched
    ? {
      // Incompatible
      recomendation: {
        reason: 'incompatible',
        selectedJava: resultJava,
        recommendedDownload: javaVersion,
        recommendedVersion: computedJava,
        recommendedLevel: computedQuality,
        version: versionId || '',
        minecraft,
        forge: instance.runtime.forge || '',
        requirement: versionPref.requirement,
      } as JavaRecommendation,
      java: {
        ...resultJava,
        valid: true,
      } as JavaRecord,
    }
    : {
      recomendation: undefined,
      java: {
        ...resultJava,
        valid: true,
      } as JavaRecord,
    }
}
