import { parseJavaVersion, parseJavaVersionOutput } from './java'
import { describe, test, expect } from 'vitest'

describe('JavaInstaller', () => {
  describe('#parseJavaVersion', () => {
    test('should resolve old java version', async () => {
      const version = `java version "1.7.0_55"
            Java(TM) SE Runtime Environment (build 1.7.0_55-b13)
            Java HotSpot(TM) 64-Bit Server VM (build 24.55-b03, mixed mode)`
      const inf = parseJavaVersion(version)
      expect(inf).toEqual({ version: '1.7.0_55', majorVersion: 7, patch: 55 })
    })
    test('should resolve new java version', async () => {
      const version = `java 10.0.1 2018-04-17
            Java(TM) SE Runtime Environment 18.3 (build 10.0.1+10)
            Java HotSpot(TM) 64-Bit Server VM 18.3 (build 10.0.1+10, mixed mode)`
      const inf = parseJavaVersion(version)
      expect(inf).toEqual({ version: '10.0.1', majorVersion: 10, patch: 1 })
    })
    test('should return undefined if version is not valid', async () => {
      const version = 'java aaaa 2018-04-17'
      const inf = parseJavaVersion(version)
      expect(inf).toEqual(undefined)
    })
    test('should parse', () => {
      const inf = parseJavaVersion(`openjdk version "1.8.0-262"
OpenJDK Runtime Environment (build 1.8.0-262-b10)
OpenJDK 64-Bit Server VM (build 25.71-b10, mixed mode)`)
      expect(inf).toEqual({ version: '1.8.0', majorVersion: 8, patch: -1 })
    })
    test('should resolve Oracle JDK 25 GA (no patch component)', () => {
      const version = `java version "25" 2025-09-16 LTS
Java(TM) SE Runtime Environment (build 25+36-LTS-3489)
Java HotSpot(TM) 64-Bit Server VM (build 25+36-LTS-3489, mixed mode, sharing)`
      const inf = parseJavaVersion(version)
      expect(inf).toEqual({ version: '25', majorVersion: 25, patch: -1 })
    })
    test('should resolve OpenJDK 25 GA (no patch component)', () => {
      const version = `openjdk version "25" 2025-09-16
OpenJDK Runtime Environment (build 25+36-3489)
OpenJDK 64-Bit Server VM (build 25+36-3489, mixed mode)`
      const inf = parseJavaVersion(version)
      expect(inf).toEqual({ version: '25', majorVersion: 25, patch: -1 })
    })
    test('should resolve Oracle JDK 21 GA (no patch component)', () => {
      const version = 'java version "21" 2023-09-19 LTS'
      const inf = parseJavaVersion(version)
      expect(inf).toEqual({ version: '21', majorVersion: 21, patch: -1 })
    })
    test('should accept version output written to stdout', () => {
      expect(parseJavaVersionOutput('openjdk version "21.0.7" 2025-04-16', ''))
        .toEqual({ version: '21.0.7', majorVersion: 21, patch: 7 })
    })
    test('should resolve JAVA_VERSION line from JDK release file with major-only version', () => {
      const inf = parseJavaVersion('JAVA_VERSION="25"')
      expect(inf).toEqual({ version: '25', majorVersion: 25, patch: -1 })
    })
  })
})
