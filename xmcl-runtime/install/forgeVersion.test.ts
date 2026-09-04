import { describe, expect, it } from 'vitest'
import { isBrokenJavaRuntimeError, normalizeForgeVersion } from './forgeVersion'

describe('normalizeForgeVersion', () => {
  it('restores a missing Minecraft patch segment', () => {
    expect(normalizeForgeVersion('1.20.1', '1.20-46.0.14')).toBe('1.20.1-46.0.14')
  })

  it('preserves valid and unrelated coordinates', () => {
    expect(normalizeForgeVersion('1.20.1', '1.20.1-47.4.0')).toBe('1.20.1-47.4.0')
    expect(normalizeForgeVersion('1.20.1', '1.19-43.2.0')).toBe('1.19-43.2.0')
  })

  it('recognizes incomplete JVM failures from Forge processors', () => {
    expect(isBrokenJavaRuntimeError(new Error(
      "Error: missing `server' JVM at `C:\\java\\bin\\server\\jvm.dll'.",
    ))).toBe(true)
    expect(isBrokenJavaRuntimeError(new Error('Could not create the Java Virtual Machine.'))).toBe(true)
    expect(isBrokenJavaRuntimeError(new Error('processor exited with code 1'))).toBe(false)
  })
})
