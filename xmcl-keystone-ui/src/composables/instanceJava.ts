import type { JavaVersion } from '@xmcl/core'
import { Instance, Java, JavaRecord, JavaServiceKey, parseVersion } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { InstanceResolveVersion } from './instanceVersion'
import { useRefreshable } from './refreshable'
import { useService } from './service'

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

export const kInstanceJava: InjectionKey<ReturnType<typeof useInstanceJava>> = Symbol('InstanceJava')

export interface InstanceJavaStatus extends AutoDetectedJava {
  instance: string
  /**
   * The selected java path of the instance
   */
  javaPath: string | undefined
  /**
   * Only present when user has manually selected java
   */
  compatible?: JavaCompatibleState

  preferredJava?: JavaRecord
}

export function useInstanceJava(instance: Ref<Instance>, version: Ref<InstanceResolveVersion | undefined>, all: Ref<JavaRecord[]>) {
  const { resolveJava } = useService(JavaServiceKey)

  const data: Ref<InstanceJavaStatus | undefined> = ref(undefined)
  const { refresh: mutate, refreshing: isValidating, error } = useRefreshable(async () => {
    const _version = version.value
    const inst = instance.value
    const _all = all.value

    const path = inst.path
    const javaPath = inst.java
    const minecraft = inst.runtime.minecraft
    const forge = inst.runtime.forge
    data.value = undefined
    if (version.value && version.value.instance !== path) {
      return
    }
    const result = await getInstanceJavaStatus(_version, inst)
    if (version.value !== _version ||
      instance.value.java !== javaPath ||
      instance.value.runtime.minecraft !== minecraft ||
      instance.value.runtime.forge !== forge ||
      all.value !== _all) {
      return
    }
    data.value = result
  })

  function getComputedJava(instance: Instance, version: InstanceResolveVersion | undefined) {
    return getAutoSelectedJava(
      all.value,
      instance.runtime.minecraft,
      instance.runtime.forge,
      version,
    )
  }

  async function getInstanceJavaStatus(version: InstanceResolveVersion | undefined, inst: Instance) {
    const javaPath = inst.java
    const instPath = inst.path
    const detected = getComputedJava(inst, version)
    const result = await getAutoOrManuallJava(detected, resolveJava, javaPath)
    const status: InstanceJavaStatus = {
      instance: instPath,
      javaPath,
      ...result.auto,
      java: result.java || result.auto.java,
      compatible: result.quality,
      preferredJava: result.auto.java,
    }
    return status
  }

  const java = computed(() => data.value?.java)

  watch([all, version, computed(() => instance.value.java), computed(() => instance.value.runtime)], () => {
    mutate()
  }, { deep: true })

  return {
    java,
    status: data,
    isValidating,
    getInstanceJavaStatus,
    getComputedJava,
    error,
  }
}

interface VersionPreference {
  match: (v: Java) => boolean
  okay: (v: Java) => boolean
  requirement: string
}

function selectJavaByPreference(allJava: JavaRecord[], { match, okay }: VersionPreference) {
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

function getVersionPreference(
  minecraft: string,
  forge: string | undefined,
  selectedVersion?: InstanceResolveVersion,
) {
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
    if (forge) {
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

  return {
    javaVersion,
    versionPref,
  }
}

function getAutoSelectedJava(
  all: JavaRecord[],
  minecraft: string,
  forge: string | undefined,
  selectedVersion?: InstanceResolveVersion,
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

async function getAutoOrManuallJava(
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
        valid: true,
      } as JavaRecord,
      quality: resultQuality,
    }
  }

  return {
    auto: criteria,
  }
}
