import { describe, test, expect } from 'vitest'
import {
  getAutoOrManuallJava,
  getAutoSelectedJava,
  getVersionPreference,
  selectJavaByPreference,
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
