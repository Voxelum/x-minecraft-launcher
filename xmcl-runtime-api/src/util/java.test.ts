import { describe, test, expect } from 'vitest'
import {
  getAutoOrManuallJava,
  getAutoSelectedJava,
  getVersionPreference,
  selectJavaByPreference,
  JavaCompatibleState,
} from './java'
import type { JavaRecord } from '../entities/java'

function rec(over: Partial<JavaRecord>): JavaRecord {
  return {
    path: '/j',
    version: '1.0',
    majorVersion: 8,
    valid: true,
    ...over,
  }
}

describe('getVersionPreference - okay predicate for MC < 1.13', () => {
  test('Java 8 is the matched (best) version', () => {
    const { versionPref } = getVersionPreference('1.12.2', undefined)
    expect(versionPref.match(rec({ majorVersion: 8 }))).toBe(true)
  })

  test('Java 7 is not okay (cannot run modern MC)', () => {
    // BUG #3: current `okay: j => j.majorVersion < 8 || j.majorVersion < 11`
    // mistakenly accepts Java 7.
    const { versionPref } = getVersionPreference('1.12.2', undefined)
    expect(versionPref.match(rec({ majorVersion: 7 }))).toBe(false)
    expect(versionPref.okay(rec({ majorVersion: 7 }))).toBe(false)
  })

  test('Java 6 is not okay', () => {
    const { versionPref } = getVersionPreference('1.7.10', undefined)
    expect(versionPref.okay(rec({ majorVersion: 6 }))).toBe(false)
  })

  test('Java 11 is okay (close-enough alternative when Java 8 absent)', () => {
    const { versionPref } = getVersionPreference('1.12.2', undefined)
    expect(versionPref.okay(rec({ majorVersion: 11 }))).toBe(true)
  })

  test('Java 17 is not okay for legacy MC (would require explicit user override)', () => {
    const { versionPref } = getVersionPreference('1.12.2', undefined)
    expect(versionPref.okay(rec({ majorVersion: 17 }))).toBe(false)
  })
})

describe('selectJavaByPreference - OpenJ9 deprioritization', () => {
  test('HotSpot is preferred over OpenJ9 when both match (regardless of input order)', () => {
    // BUG #5: original sort comparator uses `indexOf(...)` as a boolean and is
    // inverted (returns -1 when not found, which is truthy). Picks depend on
    // insertion order, not on the JVM family.
    const { versionPref } = getVersionPreference('1.21', undefined)
    const hotspot = rec({ majorVersion: 21, path: '/opt/temurin-21/bin/java' })
    const openj9 = rec({ majorVersion: 21, path: '/opt/openj9-21/bin/java' })

    const [pickedA] = selectJavaByPreference([hotspot, openj9], versionPref)
    expect(pickedA.path).toBe(hotspot.path)

    const [pickedB] = selectJavaByPreference([openj9, hotspot], versionPref)
    expect(pickedB.path).toBe(hotspot.path)
  })

  test('OpenJ9 is still selected when it is the only matched option', () => {
    const { versionPref } = getVersionPreference('1.21', undefined)
    const openj9 = rec({ majorVersion: 21, path: '/opt/openj9-21/bin/java' })
    const [picked] = selectJavaByPreference([openj9], versionPref)
    expect(picked.path).toBe(openj9.path)
  })
})

describe('selectJavaByPreference - global preferred path', () => {
  test('preferred path wins over other matched javas', () => {
    const { versionPref } = getVersionPreference('1.21', undefined)
    const a = rec({ majorVersion: 21, path: '/opt/temurin-21/bin/java' })
    const b = rec({ majorVersion: 21, path: '/opt/graal-21/bin/java' })
    const [picked] = selectJavaByPreference([a, b], versionPref, b.path)
    expect(picked.path).toBe(b.path)
  })

  test('preferred path is ignored when it is not compatible (fallback to auto)', () => {
    // MC 1.7.10 needs Java 8; a preferred Java 21 is not a match, so the
    // matched Java 8 must be chosen instead.
    const { versionPref } = getVersionPreference('1.7.10', undefined)
    const java8 = rec({ majorVersion: 8, path: '/opt/java8/bin/java' })
    const preferred21 = rec({ majorVersion: 21, path: '/opt/java21/bin/java' })
    const [picked, quality] = selectJavaByPreference([java8, preferred21], versionPref, preferred21.path)
    expect(picked.path).toBe(java8.path)
    expect(quality).toBe(JavaCompatibleState.Matched)
  })

  test('getAutoSelectedJava honors preferred path when compatible', () => {
    const a = rec({ majorVersion: 21, path: '/opt/temurin-21/bin/java' })
    const b = rec({ majorVersion: 21, path: '/opt/graal-21/bin/java' })
    const result = getAutoSelectedJava([a, b], '1.21.1', undefined, undefined, b.path)
    expect(result.java?.path).toBe(b.path)
  })

  test('getAutoSelectedJava falls back to auto when preferred is incompatible', () => {
    // Preferred Java 8 is incompatible with MC 1.21 (needs >=16); auto picks 21.
    const java21 = rec({ majorVersion: 21, path: '/opt/java21/bin/java' })
    const preferred8 = rec({ majorVersion: 8, path: '/opt/java8/bin/java' })
    const result = getAutoSelectedJava([java21, preferred8], '1.21.1', undefined, undefined, preferred8.path)
    expect(result.java?.path).toBe(java21.path)
  })
})

describe('getAutoOrManuallJava - stale / invalid pinned path', () => {
  test('invalid pinned java surfaces as { valid: false } and never as a fake valid record', async () => {
    // BUG #1: even when the underlying resolveJava reports an invalid record
    // (e.g. the JavaService cache entry pointing at a since-deleted path),
    // the helper used to spread `{ ...record, valid: true }`, silently
    // erasing the invalidity signal that the launch path relies on.
    const auto = rec({ majorVersion: 21, path: '/auto/java' })
    const criteria = getAutoSelectedJava([auto], '1.21.1', undefined)

    const result = await getAutoOrManuallJava(
      criteria,
      async () => ({
        // Resolver returns a record but flags it invalid (stale cache).
        path: '/pinned/stale/java',
        version: '21',
        majorVersion: 21,
        valid: false,
      } as any),
      '/pinned/stale/java',
    )

    expect(result.java?.valid).toBe(false)
  })

  test('unresolvable pinned path returns { valid: false } (already covered, kept as regression guard)', async () => {
    const auto = rec({ majorVersion: 21, path: '/auto/java' })
    const criteria = getAutoSelectedJava([auto], '1.21.1', undefined)

    const result = await getAutoOrManuallJava(
      criteria,
      async () => undefined,
      '/deleted/java',
    )

    expect(result.java?.valid).toBe(false)
    expect(result.java?.path).toBe('/deleted/java')
  })

  test('callers using the valid-aware fallback get the working auto java when pin is broken', async () => {
    // This documents the contract launch.ts must honor: prefer pinned only
    // when it is actually valid; otherwise fall back to auto.
    const autoJava = rec({ majorVersion: 21, path: '/auto/java' })
    const criteria = getAutoSelectedJava([autoJava], '1.21.1', undefined)
    const result = await getAutoOrManuallJava(
      criteria,
      async () => undefined,
      '/deleted/java',
    )

    const picked = (result.java?.valid ? result.java : undefined) || result.auto.java
    expect(picked?.path).toBe(autoJava.path)
    expect(picked?.valid).toBe(true)
  })
})

describe('getVersionPreference - forward compatibility from Java 16', () => {
  // Historical bug: the forward-compat threshold was Java 21, so a Java 25
  // install was rejected as "no compatible Java" when a version asked for
  // Java 17 or 16 — even though those JDKs accept any newer LTS in practice.
  test('Java 25 satisfies a Java 21 requirement', () => {
    const { versionPref } = getVersionPreference('1.20.5', undefined, {
      javaVersion: { component: 'java-runtime-delta', majorVersion: 21 },
    } as any)
    expect(versionPref.match(rec({ majorVersion: 25 }))).toBe(true)
  })

  test('Java 25 satisfies a Java 17 requirement', () => {
    const { versionPref } = getVersionPreference('1.20.1', undefined, {
      javaVersion: { component: 'java-runtime-gamma', majorVersion: 17 },
    } as any)
    expect(versionPref.match(rec({ majorVersion: 25 }))).toBe(true)
  })

  test('Java 21 satisfies a Java 16 requirement', () => {
    const { versionPref } = getVersionPreference('1.17.1', undefined, {
      javaVersion: { component: 'java-runtime-alpha', majorVersion: 16 },
    } as any)
    expect(versionPref.match(rec({ majorVersion: 21 }))).toBe(true)
  })

  test('Java 8 requirement is still strict (no forward-compat for legacy MC)', () => {
    // MC 1.8 / 1.12 etc. rely on Java 8 internals removed in 9+; auto-mode
    // must keep refusing newer JDKs as a perfect match.
    const { versionPref } = getVersionPreference('1.12.2', undefined, {
      javaVersion: { component: 'jre-legacy', majorVersion: 8 },
    } as any)
    expect(versionPref.match(rec({ majorVersion: 8 }))).toBe(true)
    expect(versionPref.match(rec({ majorVersion: 17 }))).toBe(false)
    expect(versionPref.match(rec({ majorVersion: 25 }))).toBe(false)
  })

  test('getAutoSelectedJava picks Java 25 when requirement is Java 17', () => {
    // End-to-end: confirms the relaxed `match` actually flows through the
    // auto-selector so the picker UI shows Java 25 instead of "no compatible
    // Java found / will install".
    const java25 = rec({ majorVersion: 25, path: '/opt/jdk-25/bin/java' })
    const result = getAutoSelectedJava([java25], '1.20.1', undefined, {
      javaVersion: { component: 'java-runtime-gamma', majorVersion: 17 },
    } as any)
    expect(result.java?.path).toBe(java25.path)
  })
})

describe('getVersionPreference - version buckets (auto mode, no explicit javaVersion)', () => {
  test('legacy MC (<1.13) requires Java 8, tolerates 9–11, rejects newer', () => {
    const { versionPref, javaVersion } = getVersionPreference('1.12.2', undefined)
    expect(versionPref.requirement).toBe('=8')
    expect(javaVersion).toEqual({ component: 'jre-legacy', majorVersion: 8 })
    // match
    expect(versionPref.match(rec({ majorVersion: 8 }))).toBe(true)
    expect(versionPref.match(rec({ majorVersion: 11 }))).toBe(false)
    // okay
    expect(versionPref.okay(rec({ majorVersion: 9 }))).toBe(true)
    expect(versionPref.okay(rec({ majorVersion: 11 }))).toBe(true)
    expect(versionPref.okay(rec({ majorVersion: 12 }))).toBe(false)
    expect(versionPref.okay(rec({ majorVersion: 17 }))).toBe(false)
  })

  test('mid MC (1.13–1.16) matches Java 8–16 and tolerates anything else', () => {
    const { versionPref, javaVersion } = getVersionPreference('1.16.5', undefined)
    expect(versionPref.requirement).toBe('>=8,<=16')
    expect(javaVersion).toEqual({ component: 'jre-legacy', majorVersion: 8 })
    expect(versionPref.match(rec({ majorVersion: 8 }))).toBe(true)
    expect(versionPref.match(rec({ majorVersion: 16 }))).toBe(true)
    expect(versionPref.match(rec({ majorVersion: 17 }))).toBe(false)
    // okay is permissive here — anything is a usable fallback
    expect(versionPref.okay(rec({ majorVersion: 21 }))).toBe(true)
    expect(versionPref.okay(rec({ majorVersion: 7 }))).toBe(true)
  })

  test('modern MC (1.17+) matches Java >=16 and tolerates anything', () => {
    const { versionPref, javaVersion } = getVersionPreference('1.21.1', undefined)
    expect(versionPref.requirement).toBe('>=16')
    expect(javaVersion).toEqual({ component: 'java-runtime-alpha', majorVersion: 16 })
    expect(versionPref.match(rec({ majorVersion: 16 }))).toBe(true)
    expect(versionPref.match(rec({ majorVersion: 21 }))).toBe(true)
    expect(versionPref.match(rec({ majorVersion: 8 }))).toBe(false)
    expect(versionPref.okay(rec({ majorVersion: 8 }))).toBe(true)
  })

  test('the 1.13 lower boundary uses the mid bucket, 1.12 uses legacy', () => {
    expect(getVersionPreference('1.13', undefined).versionPref.requirement).toBe('>=8,<=16')
    expect(getVersionPreference('1.12.2', undefined).versionPref.requirement).toBe('=8')
  })

  test('the 1.17 lower boundary uses the modern bucket', () => {
    expect(getVersionPreference('1.17', undefined).versionPref.requirement).toBe('>=16')
    expect(getVersionPreference('1.16.5', undefined).versionPref.requirement).toBe('>=8,<=16')
  })
})

describe('getVersionPreference - explicit javaVersion overrides the bucket default', () => {
  test('a modern requirement (>=16) is forward-compatible', () => {
    const { versionPref, javaVersion } = getVersionPreference('1.20.1', undefined, {
      javaVersion: { component: 'java-runtime-gamma', majorVersion: 17 },
    } as any)
    expect(versionPref.requirement).toBe('>=17')
    // the explicit javaVersion is passed through untouched
    expect(javaVersion).toEqual({ component: 'java-runtime-gamma', majorVersion: 17 })
    expect(versionPref.match(rec({ majorVersion: 17 }))).toBe(true)
    expect(versionPref.match(rec({ majorVersion: 21 }))).toBe(true)
    expect(versionPref.match(rec({ majorVersion: 16 }))).toBe(false)
  })

  test('a legacy requirement (<16) stays an exact match', () => {
    const { versionPref } = getVersionPreference('1.12.2', undefined, {
      javaVersion: { component: 'jre-legacy', majorVersion: 8 },
    } as any)
    expect(versionPref.requirement).toBe('=8')
    expect(versionPref.match(rec({ majorVersion: 8 }))).toBe(true)
    expect(versionPref.match(rec({ majorVersion: 9 }))).toBe(false)
    expect(versionPref.match(rec({ majorVersion: 11 }))).toBe(false)
  })
})

describe('selectJavaByPreference - bucket priority and filtering', () => {
  test('a matched java always beats a merely-okay one', () => {
    const { versionPref } = getVersionPreference('1.16.5', undefined)
    const okayOnly = rec({ majorVersion: 21, path: '/okay' }) // >16 => okay, not match
    const matched = rec({ majorVersion: 16, path: '/matched' })
    const [picked, quality] = selectJavaByPreference([okayOnly, matched], versionPref)
    expect(picked.path).toBe(matched.path)
    expect(quality).toBe(JavaCompatibleState.Matched)
  })

  test('falls back to an okay java when nothing matches', () => {
    const { versionPref } = getVersionPreference('1.12.2', undefined)
    const okayOnly = rec({ majorVersion: 11, path: '/okay' }) // 8..11 => okay
    const [picked, quality] = selectJavaByPreference([okayOnly], versionPref)
    expect(picked.path).toBe(okayOnly.path)
    expect(quality).toBe(JavaCompatibleState.MayIncompatible)
  })

  test('falls back to a bad java as the last resort', () => {
    const { versionPref } = getVersionPreference('1.12.2', undefined)
    const bad = rec({ majorVersion: 21, path: '/bad' }) // neither match nor okay
    const [picked, quality] = selectJavaByPreference([bad], versionPref)
    expect(picked.path).toBe(bad.path)
    expect(quality).toBe(JavaCompatibleState.VeryLikelyIncompatible)
  })

  test('invalid java records are ignored during selection', () => {
    const { versionPref } = getVersionPreference('1.21.1', undefined)
    const invalidMatch = rec({ majorVersion: 21, path: '/invalid', valid: false })
    const validMatch = rec({ majorVersion: 17, path: '/valid' })
    const [picked] = selectJavaByPreference([invalidMatch, validMatch], versionPref)
    expect(picked.path).toBe(validMatch.path)
  })

  test('a preferred path that is only "okay" (not a match) is NOT forced', () => {
    // Preference is only honored from the matched bucket; when no java
    // matches we take the regular okay fallback regardless of the pin.
    const { versionPref } = getVersionPreference('1.12.2', undefined)
    const okayA = rec({ majorVersion: 9, path: '/a' })
    const okayPreferred = rec({ majorVersion: 11, path: '/preferred' })
    const [picked, quality] = selectJavaByPreference([okayA, okayPreferred], versionPref, okayPreferred.path)
    expect(picked.path).toBe(okayA.path)
    expect(quality).toBe(JavaCompatibleState.MayIncompatible)
  })

  test('a preferred path that does not exist is ignored (normal selection)', () => {
    const { versionPref } = getVersionPreference('1.21.1', undefined)
    const a = rec({ majorVersion: 17, path: '/a' })
    const b = rec({ majorVersion: 21, path: '/b' })
    const [picked] = selectJavaByPreference([a, b], versionPref, '/does/not/exist')
    // first matched wins (no OpenJ9 in either => input order preserved)
    expect(picked.path).toBe(a.path)
  })
})

describe('getAutoSelectedJava - auto detection states', () => {
  test('reports noJava when nothing is installed', () => {
    const result = getAutoSelectedJava([], '1.21.1', undefined)
    expect(result.noJava).toBe(true)
    expect(result.java).toBeUndefined()
  })

  test('returns undefined java (install pending) when installed javas do not match', () => {
    // MC 1.21 needs >=16; only Java 8 present => no match, so the picker
    // should offer to download instead of pinning an incompatible java.
    const java8 = rec({ majorVersion: 8, path: '/opt/java8' })
    const result = getAutoSelectedJava([java8], '1.21.1', undefined)
    expect(result.java).toBeUndefined()
    expect(result.noJava).toBeUndefined()
  })

  test('sets noVersion when the resolved version is not provided', () => {
    const java21 = rec({ majorVersion: 21, path: '/opt/java21' })
    const withoutVersion = getAutoSelectedJava([java21], '1.21.1', undefined)
    expect(withoutVersion.noVersion).toBe(true)
    const withVersion = getAutoSelectedJava([java21], '1.21.1', undefined, {
      javaVersion: { component: 'java-runtime-gamma', majorVersion: 17 },
    } as any)
    expect(withVersion.noVersion).toBe(false)
  })

  test('returns the matched java as a valid record', () => {
    const java21 = rec({ majorVersion: 21, path: '/opt/java21' })
    const result = getAutoSelectedJava([java21], '1.21.1', undefined)
    expect(result.java?.path).toBe(java21.path)
    expect(result.java?.valid).toBe(true)
  })
})

describe('getAutoOrManuallJava - pinned java quality classification', () => {
  const criteriaFor = (mc: string, all: JavaRecord[]) => getAutoSelectedJava(all, mc, undefined)

  test('no java installed short-circuits to { auto } only', async () => {
    const criteria = getAutoSelectedJava([], '1.21.1', undefined)
    const result = await getAutoOrManuallJava(criteria, async () => undefined, '/pinned')
    expect(result.java).toBeUndefined()
    expect(result.auto).toBe(criteria)
  })

  test('no pin returns { auto } only', async () => {
    const auto = rec({ majorVersion: 21, path: '/auto' })
    const criteria = criteriaFor('1.21.1', [auto])
    const result = await getAutoOrManuallJava(criteria, async () => { throw new Error('should not resolve') }, undefined)
    expect(result.java).toBeUndefined()
    expect(result.auto).toBe(criteria)
  })

  test('pinned java that matches is classified Matched', async () => {
    const auto = rec({ majorVersion: 21, path: '/auto' })
    const criteria = criteriaFor('1.21.1', [auto])
    const pinned = rec({ majorVersion: 17, path: '/pinned' })
    const result = await getAutoOrManuallJava(criteria, async () => pinned, pinned.path)
    expect(result.java?.path).toBe(pinned.path)
    expect(result.quality).toBe(JavaCompatibleState.Matched)
  })

  test('pinned java that is okay-but-not-match is MayIncompatible', async () => {
    const auto = rec({ majorVersion: 21, path: '/auto' })
    const criteria = criteriaFor('1.21.1', [auto])
    const pinned = rec({ majorVersion: 8, path: '/pinned' }) // <16 => okay (permissive), not match
    const result = await getAutoOrManuallJava(criteria, async () => pinned, pinned.path)
    expect(result.java?.path).toBe(pinned.path)
    expect(result.quality).toBe(JavaCompatibleState.MayIncompatible)
  })

  test('pinned java that is neither match nor okay is VeryLikelyIncompatible', async () => {
    const auto = rec({ majorVersion: 8, path: '/auto' })
    const criteria = criteriaFor('1.12.2', [auto])
    const pinned = rec({ majorVersion: 21, path: '/pinned' }) // legacy MC rejects 21 entirely
    const result = await getAutoOrManuallJava(criteria, async () => pinned, pinned.path)
    expect(result.java?.path).toBe(pinned.path)
    expect(result.quality).toBe(JavaCompatibleState.VeryLikelyIncompatible)
  })
})

describe('global Java preference - end-to-end selection & fallback', () => {
  // These document the feature contract: in auto mode the launcher tries the
  // globally preferred java first, and only falls back to auto-detection /
  // download when that java is not fully compatible with the version.
  const preferredPathFor = (globalJava: string) => globalJava || undefined

  test('preferred java is used when it is compatible with the version', () => {
    const graal = rec({ majorVersion: 21, path: '/opt/graal-21/bin/java' })
    const temurin = rec({ majorVersion: 21, path: '/opt/temurin-21/bin/java' })
    const result = getAutoSelectedJava([temurin, graal], '1.21.1', undefined, undefined, preferredPathFor(graal.path))
    expect(result.java?.path).toBe(graal.path)
  })

  test('preferred java wins even over the HotSpot-vs-OpenJ9 tie-breaker', () => {
    const hotspot = rec({ majorVersion: 21, path: '/opt/temurin-21/bin/java' })
    const openj9 = rec({ majorVersion: 21, path: '/opt/openj9-21/bin/java' })
    // Without a preference HotSpot would win; the explicit pin overrides that.
    const result = getAutoSelectedJava([hotspot, openj9], '1.21.1', undefined, undefined, preferredPathFor(openj9.path))
    expect(result.java?.path).toBe(openj9.path)
  })

  test('incompatible preferred java falls back to a compatible one', () => {
    const java8 = rec({ majorVersion: 8, path: '/opt/java8/bin/java' })
    const java21 = rec({ majorVersion: 21, path: '/opt/java21/bin/java' })
    // MC 1.21 needs >=16, preferred Java 8 is a bad match => auto picks 21.
    const result = getAutoSelectedJava([java8, java21], '1.21.1', undefined, undefined, preferredPathFor(java8.path))
    expect(result.java?.path).toBe(java21.path)
  })

  test('incompatible preferred java with no compatible alternative => install pending', () => {
    const java8 = rec({ majorVersion: 8, path: '/opt/java8/bin/java' })
    // Only Java 8 present, MC 1.21 needs >=16; the preference cannot rescue
    // it, so the auto-selector reports "no compatible java" (install pending)
    // rather than pinning the incompatible Java 8.
    const result = getAutoSelectedJava([java8], '1.21.1', undefined, undefined, preferredPathFor(java8.path))
    expect(result.java).toBeUndefined()
    expect(result.noJava).toBeUndefined()
  })

  test('empty global preference behaves exactly like plain auto-selection', () => {
    const a = rec({ majorVersion: 17, path: '/a' })
    const b = rec({ majorVersion: 21, path: '/b' })
    const withEmpty = getAutoSelectedJava([a, b], '1.21.1', undefined, undefined, preferredPathFor(''))
    const plain = getAutoSelectedJava([a, b], '1.21.1', undefined)
    expect(withEmpty.java?.path).toBe(plain.java?.path)
  })

  test('a per-instance pin still overrides the global preference', async () => {
    // instance.java (pin) is resolved by getAutoOrManuallJava AFTER the
    // global-preference auto-detection; launch.ts prefers the valid pin.
    const globalPreferred = rec({ majorVersion: 21, path: '/opt/global-21/bin/java' })
    const instancePinned = rec({ majorVersion: 17, path: '/opt/instance-17/bin/java' })
    const criteria = getAutoSelectedJava(
      [globalPreferred, instancePinned], '1.21.1', undefined, undefined, globalPreferred.path,
    )
    expect(criteria.java?.path).toBe(globalPreferred.path)
    const result = await getAutoOrManuallJava(criteria, async () => instancePinned, instancePinned.path)
    const picked = (result.java?.valid ? result.java : undefined) || result.auto.java
    expect(picked?.path).toBe(instancePinned.path)
  })
})
