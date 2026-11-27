import { describe, expect, test } from 'vitest'
import { analyzeCrashReport } from './instanceCrashAnalyze'

describe('analyzeCrashReport', () => {
  test('detects OutOfMemoryError and sets needsMoreMemory', () => {
    const result = analyzeCrashReport(
      'crash-2026-11-19.txt',
      'java.lang.OutOfMemoryError: Java heap space\n\tat net.minecraft.client.main.Main.main(Main.java:1)',
    )
    expect(result.causes).toEqual(['oom'])
    expect(result.needsMoreMemory).toBe(true)
    expect(result.details[0]).toContain('OutOfMemoryError')
  })

  test('detects UnsupportedClassVersionError and maps Java major version', () => {
    const result = analyzeCrashReport(
      'crash-java.txt',
      'java.lang.UnsupportedClassVersionError: net/minecraft/Main has been compiled by a more recent version of the Java Runtime (class file version 65.0)',
    )
    expect(result.causes).toEqual(['javaVersion'])
    expect(result.suggestedJavaMajor).toBe(21)
  })

  test('detects mixin and missing mod errors together', () => {
    const result = analyzeCrashReport(
      'crash-mods.txt',
      'org.spongepowered.asm.mixin.transformer.throwables.MixinTransformerError: An unexpected critical error was encountered\nCould not find required mod: fabric-api',
    )
    expect(result.causes).toContain('mixin')
    expect(result.causes).toContain('missingMod')
  })

  test.each(['Metaspace', 'Direct buffer memory', 'unable to create native thread'])('does not suggest increasing heap for %s', (reason) => {
    const result = analyzeCrashReport('crash.txt', `java.lang.OutOfMemoryError: ${reason}`)
    expect(result.causes).toEqual(['oom'])
    expect(result.needsMoreMemory).toBe(false)
  })
})
