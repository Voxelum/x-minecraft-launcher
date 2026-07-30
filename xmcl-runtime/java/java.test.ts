import { describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  JavaValidation,
  classifyJavaInstallFailure,
  detectExecutableLibc,
  getWindowsNativeArchForIa32,
  sanitizeJavaResolveOutput,
} from './java'

describe('classifyJavaInstallFailure', () => {
  it('reports download-or-extract when the binary never landed', () => {
    expect(classifyJavaInstallFailure({ exeExists: false, validation: undefined }))
      .toBe('download-or-extract')
    // Missing binary dominates even if validation somehow computed.
    expect(classifyJavaInstallFailure({ exeExists: false, validation: JavaValidation.NotExisted }))
      .toBe('download-or-extract')
  })

  it('reports permission when the binary exists but is not executable', () => {
    expect(classifyJavaInstallFailure({ exeExists: true, validation: JavaValidation.NoPermission }))
      .toBe('permission')
  })

  it('reports parse-or-spawn when the binary exists and is accessible but unresolvable', () => {
    expect(classifyJavaInstallFailure({ exeExists: true, validation: JavaValidation.Okay }))
      .toBe('parse-or-spawn')
    // Unknown validation with an existing exe still points at spawn/parse.
    expect(classifyJavaInstallFailure({ exeExists: true, validation: undefined }))
      .toBe('parse-or-spawn')
  })

  it('redacts absolute paths and truncates Java process output for telemetry', () => {
    expect(sanitizeJavaResolveOutput('Error loading C:\\Users\\Alice\\.minecraftx\\jre\\bin\\server\\jvm.dll'))
      .toBe('Error loading <path>')
    expect(sanitizeJavaResolveOutput('Failed: /home/alice/.minecraftx/jre/bin/java'))
      .toBe('Failed: <path>')
    expect(sanitizeJavaResolveOutput('x'.repeat(2000))?.length).toBe(1024)
  })

  it('only selects a native 64-bit Java runtime for WOW64 processes', () => {
    expect(getWindowsNativeArchForIa32('win32', 'ia32', { PROCESSOR_ARCHITEW6432: 'AMD64' }))
      .toBe('x64')
    expect(getWindowsNativeArchForIa32('win32', 'ia32', { PROCESSOR_ARCHITEW6432: 'ARM64' }))
      .toBe('arm64')
    expect(getWindowsNativeArchForIa32('win32', 'ia32', {})).toBeUndefined()
    expect(getWindowsNativeArchForIa32('win32', 'x64', { PROCESSOR_ARCHITEW6432: 'AMD64' }))
      .toBeUndefined()
  })
})

describe('detectExecutableLibc', () => {
  /** Build a minimal little-endian ELF64 file carrying a single PT_INTERP. */
  function makeElf64(interp: string): Buffer {
    const interpBuf = Buffer.from(interp + '\0', 'utf-8')
    const ehSize = 64
    const phEntSize = 56
    const phOff = ehSize
    const interpOff = ehSize + phEntSize
    const total = interpOff + interpBuf.length

    const buf = Buffer.alloc(total)
    // e_ident
    buf[0] = 0x7f; buf[1] = 0x45; buf[2] = 0x4c; buf[3] = 0x46
    buf[4] = 2 // EI_CLASS = ELFCLASS64
    buf[5] = 1 // EI_DATA = little endian
    buf[6] = 1 // EI_VERSION
    buf.writeUInt16LE(2, 0x10) // e_type = ET_EXEC
    buf.writeUInt16LE(0x3e, 0x12) // e_machine = x86-64
    buf.writeBigUInt64LE(BigInt(phOff), 0x20) // e_phoff
    buf.writeUInt16LE(phEntSize, 0x36) // e_phentsize
    buf.writeUInt16LE(1, 0x38) // e_phnum
    // program header (PT_INTERP)
    buf.writeUInt32LE(3, phOff + 0x00) // p_type = PT_INTERP
    buf.writeBigUInt64LE(BigInt(interpOff), phOff + 0x08) // p_offset
    buf.writeBigUInt64LE(BigInt(interpBuf.length), phOff + 0x20) // p_filesz
    interpBuf.copy(buf, interpOff)
    return buf
  }

  const dir = mkdtempSync(join(tmpdir(), 'xmcl-elf-'))
  const write = (name: string, buf: Buffer) => {
    const p = join(dir, name)
    writeFileSync(p, buf)
    return p
  }

  it('detects a glibc-linked ELF from its interpreter', async () => {
    const p = write('glibc', makeElf64('/lib64/ld-linux-x86-64.so.2'))
    expect(await detectExecutableLibc(p)).toBe('glibc')
  })

  it('detects a musl-linked ELF from its interpreter', async () => {
    const p = write('musl', makeElf64('/lib/ld-musl-x86-64.so.1'))
    expect(await detectExecutableLibc(p)).toBe('musl')
  })

  it('returns undefined for a non-ELF file', async () => {
    const p = write('script', Buffer.from('#!/bin/sh\necho hi\n', 'utf-8'))
    expect(await detectExecutableLibc(p)).toBeUndefined()
  })

  it('returns undefined for a missing file', async () => {
    expect(await detectExecutableLibc(join(dir, 'does-not-exist'))).toBeUndefined()
  })
})
